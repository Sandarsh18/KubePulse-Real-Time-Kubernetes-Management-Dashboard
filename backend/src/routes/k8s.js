const express = require('express');
const k8s = require('@kubernetes/client-node');
const router = express.Router();
const { k8sApi, k8sAppsApi, k8sCustomApi, k8sLog } = require('../services/kubernetesClient');
const { protect, authorize } = require('../middlewares/auth');
const { getIO } = require('../services/websocketBroker');
const { PassThrough } = require('stream');

// Helper for error handling
const handleK8sError = (err, res) => {
    console.error('K8s API Error:', err.body || err);
    res.status(err.statusCode || 500).json({ message: err.body?.message || 'Kubernetes API Error' });
};

// GET /api/k8s/namespaces
router.get('/namespaces', protect, async (req, res) => {
    try {
        const response = await k8sApi.listNamespace();
        const namespaces = response.body.items.map(ns => ns.metadata.name);
        res.json(namespaces);
    } catch (err) {
        handleK8sError(err, res);
    }
});

// GET /api/k8s/pods?ns=<ns>
router.get('/pods', protect, async (req, res) => {
    const ns = req.query.ns || 'default';
    try {
        const response = await k8sApi.listNamespacedPod(ns);
        const pods = response.body.items.map(pod => {
            // Determine actual pod status including CrashLoopBackOff, Error, etc.
            let actualStatus = pod.status.phase;
            
            // Check container statuses for more accurate status
            if (pod.status.containerStatuses && pod.status.containerStatuses.length > 0) {
                for (const containerStatus of pod.status.containerStatuses) {
                    // Check waiting state (CrashLoopBackOff, ImagePullBackOff, etc.)
                    if (containerStatus.state?.waiting) {
                        actualStatus = containerStatus.state.waiting.reason || actualStatus;
                        break;
                    }
                    // Check terminated state
                    if (containerStatus.state?.terminated) {
                        if (containerStatus.state.terminated.reason === 'Error' || 
                            containerStatus.state.terminated.exitCode !== 0) {
                            actualStatus = 'Failed';
                            break;
                        }
                    }
                    // If container is not ready and running, might be failing
                    if (!containerStatus.ready && containerStatus.state?.running && 
                        containerStatus.restartCount > 0) {
                        actualStatus = 'CrashLoopBackOff';
                    }
                }
            }
            
            return {
                name: pod.metadata.name,
                namespace: pod.metadata.namespace,
                status: actualStatus,
                ip: pod.status.podIP,
                node: pod.spec.nodeName,
                startTime: pod.status.startTime,
                containers: pod.spec.containers.map(c => ({
                    name: c.name,
                    image: c.image,
                    ready: pod.status.containerStatuses?.find(cs => cs.name === c.name)?.ready || false,
                    resources: c.resources || {}
                }))
            };
        });
        res.json(pods);
    } catch (err) {
        handleK8sError(err, res);
    }
});

// GET /api/k8s/deployments?ns=<ns>
router.get('/deployments', protect, async (req, res) => {
    const ns = req.query.ns || 'default';
    try {
        const toWorkload = (item, kind) => ({
            name: item.metadata.name,
            namespace: item.metadata.namespace,
            replicas: item.spec.replicas,
            availableReplicas: item.status?.availableReplicas || 0,
            readyReplicas: item.status?.readyReplicas || 0,
            creationTimestamp: item.metadata.creationTimestamp,
            kind
        });

        const deploymentResp = await k8sAppsApi.listNamespacedDeployment(ns);
        const deployments = deploymentResp.body.items.map(dep => toWorkload(dep, 'Deployment'));

        let statefulsets = [];
        try {
            const statefulResp = await k8sAppsApi.listNamespacedStatefulSet(ns);
            statefulsets = statefulResp.body.items.map(sts => toWorkload(sts, 'StatefulSet'));
        } catch (statefulErr) {
            if (statefulErr.statusCode === 403) {
                console.warn('Skipping StatefulSet listing due to RBAC restrictions');
            } else {
                throw statefulErr;
            }
        }

        res.json([...deployments, ...statefulsets]);
    } catch (err) {
        handleK8sError(err, res);
    }
});

// GET /api/k8s/events?ns=<ns>
router.get('/events', protect, async (req, res) => {
    const ns = req.query.ns || 'default';
    try {
        const response = await k8sApi.listNamespacedEvent(ns);
        const events = response.body.items.map(event => ({
            type: event.type,
            reason: event.reason,
            message: event.message,
            object: event.involvedObject.kind + '/' + event.involvedObject.name,
            count: event.count,
            lastTimestamp: event.lastTimestamp
        }));
        res.json(events);
    } catch (err) {
        handleK8sError(err, res);
    }
});

// GET /api/k8s/metrics?ns=<ns>
router.get('/metrics', protect, async (req, res) => {
    const ns = req.query.ns || 'default';
    try {
        // Using metrics.k8s.io/v1beta1
        const response = await k8sCustomApi.listNamespacedCustomObject(
            'metrics.k8s.io',
            'v1beta1',
            ns,
            'pods'
        );

        const metrics = response.body.items.map(item => ({
            name: item.metadata.name,
            namespace: item.metadata.namespace,
            containers: item.containers.map(c => ({
                name: c.name,
                usage: c.usage
            }))
        }));
        res.json(metrics);
    } catch (err) {
        // Metrics server might not be installed
        console.warn('Metrics API failed (metrics-server might be missing):', err.body || err.message);
        res.json([]); // Return empty to avoid breaking UI
    }
});

// POST /api/k8s/scale (Admin only)
router.post('/scale', protect, authorize('admin', 'operator'), async (req, res) => {
    const { deployment, ns, replicas, kind = 'Deployment' } = req.body;
    try {
        const desiredReplicas = Math.max(0, parseInt(replicas, 10) || 0);
        const patchBody = { spec: { replicas: desiredReplicas } };
        const jsonPatch = [
            {
                op: 'replace',
                path: '/spec/replicas',
                value: desiredReplicas
            }
        ];

        const jsonPatchOptions = { headers: { 'Content-Type': k8s.PatchUtils.PATCH_FORMAT_JSON_PATCH } };
        const mergeOptions = { headers: { 'Content-Type': 'application/merge-patch+json' } };
        const strategicOptions = { headers: { 'Content-Type': k8s.PatchUtils.PATCH_FORMAT_STRATEGIC_MERGE_PATCH } };

        let scaled = false;

        const resourceKind = kind === 'StatefulSet' ? 'StatefulSet' : 'Deployment';

        const logScaleFailure = (stage, error) => {
            console.warn(`[Scale:${resourceKind}] ${stage} failed (${error.statusCode || 'no-status'}):`, error.body?.message || error.message || error);
        };

        const scaleApi = resourceKind === 'StatefulSet'
            ? {
                read: (name, namespace) => k8sAppsApi.readNamespacedStatefulSetScale(name, namespace),
                replace: (name, namespace, body) => k8sAppsApi.replaceNamespacedStatefulSetScale(name, namespace, body),
                patchScale: (name, namespace, body, options) => k8sAppsApi.patchNamespacedStatefulSetScale(name, namespace, body, undefined, undefined, undefined, undefined, options),
                patchResource: (name, namespace, body, options) => k8sAppsApi.patchNamespacedStatefulSet(name, namespace, body, undefined, undefined, undefined, undefined, options)
            }
            : {
                read: (name, namespace) => k8sAppsApi.readNamespacedDeploymentScale(name, namespace),
                replace: (name, namespace, body) => k8sAppsApi.replaceNamespacedDeploymentScale(name, namespace, body),
                patchScale: (name, namespace, body, options) => k8sAppsApi.patchNamespacedDeploymentScale(name, namespace, body, undefined, undefined, undefined, undefined, options),
                patchResource: (name, namespace, body, options) => k8sAppsApi.patchNamespacedDeployment(name, namespace, body, undefined, undefined, undefined, undefined, options)
            };

        try {
            const scaleResource = await scaleApi.read(deployment, ns);
            const updatedScale = {
                ...scaleResource.body,
                spec: {
                    ...scaleResource.body.spec,
                    replicas: desiredReplicas
                }
            };
            await scaleApi.replace(deployment, ns, updatedScale);
            scaled = true;
        } catch (error) {
            logScaleFailure('replace scale resource', error);
        }

        const tryPatch = async (stage, fn, body, options) => {
            try {
                await fn(body, options);
                scaled = true;
            } catch (error) {
                logScaleFailure(stage, error);
                if (![403, 404, 415].includes(error.statusCode)) {
                    throw error;
                }
            }
        };

        if (!scaled) {
            await tryPatch(
                'json patch scale subresource',
                (body, options) => scaleApi.patchScale(
                    deployment,
                    ns,
                    body,
                    options
                ),
                jsonPatch,
                jsonPatchOptions
            );
        }

        if (!scaled) {
            await tryPatch(
                'merge patch scale subresource',
                (body, options) => scaleApi.patchScale(
                    deployment,
                    ns,
                    body,
                    options
                ),
                patchBody,
                mergeOptions
            );
        }

        if (!scaled) {
            await tryPatch(
                resourceKind === 'StatefulSet' ? 'strategic patch statefulset' : 'strategic patch deployment',
                (body, options) => scaleApi.patchResource(
                    deployment,
                    ns,
                    body,
                    options
                ),
                patchBody,
                strategicOptions
            );
        }

        if (!scaled) {
            throw new Error(`Unable to scale ${resourceKind} due to Kubernetes API restrictions`);
        }
        res.json({ message: `Scaled ${resourceKind} ${deployment} to ${replicas} replicas` });
    } catch (err) {
        handleK8sError(err, res);
    }
});

// POST /api/k8s/pods/:podName/restart (Admin only)
router.post('/pods/:podName/restart', protect, authorize('admin'), async (req, res) => {
    const { podName } = req.params;
    const ns = req.body.ns || 'default';
    try {
        await k8sApi.deleteNamespacedPod(podName, ns);
        res.json({ message: `Pod ${podName} deleted (restart initiated)` });
    } catch (err) {
        handleK8sError(err, res);
    }
});

// DELETE /api/k8s/pods/:podName (Admin only)
router.delete('/pods/:podName', protect, authorize('admin'), async (req, res) => {
    const { podName } = req.params;
    const ns = req.body?.ns || req.query.ns || 'default';
    try {
        await k8sApi.deleteNamespacedPod(
            podName,
            ns,
            undefined,
            undefined,
            0,
            undefined,
            'Foreground'
        );
        res.json({ message: `Pod ${podName} deleted` });
    } catch (err) {
        handleK8sError(err, res);
    }
});

// GET /api/k8s/streamLogs
router.get('/streamLogs', protect, async (req, res) => {
    const { ns, pod, container } = req.query;
    if (!ns || !pod) return res.status(400).json({ message: 'Missing ns or pod' });

    const room = `pod:${ns}:${pod}`;
    const io = getIO();

    // We don't keep a persistent HTTP connection here, we trigger the stream to the socket room.
    // In a real app, we might manage stream lifecycle more robustly.
    // For this demo, we'll start streaming if not already streaming? 
    // Actually, the prompt says "backend uses to fetch stream... and forward lines to WebSocket log room".
    // We can just start a stream and let it push to the room.

    try {
        const logStream = new PassThrough();

        // This is a simplified approach. In prod, we need to manage multiple streams and clean them up.
        // We'll attach a listener to the socket room disconnect to kill the stream? 
        // Hard to map HTTP request to socket lifecycle directly without passing socketId.
        // Let's assume the frontend calls this once when opening the logs page.

        console.log(`Starting log stream for ${ns}/${pod}`);

        // Ensure container name is string (even if empty)
        const containerName = container || '';

        const stream = await k8sLog.log(ns, pod, containerName, logStream, {
            follow: true,
            tailLines: 100,
            pretty: false,
            timestamps: true
        });

        logStream.on('data', (chunk) => {
            io.of('/logs').to(room).emit('log_line', chunk.toString());
        });

        logStream.on('end', () => {
            console.log(`Log stream ended for ${ns}/${pod}`);
            io.of('/logs').to(room).emit('log_end', 'Stream ended');
        });

        logStream.on('error', (err) => {
            console.error(`Log stream error for ${ns}/${pod}:`, err);
            io.of('/logs').to(room).emit('log_error', err.message);
        });

        res.json({ message: `Streaming logs to room ${room}` });

    } catch (err) {
        handleK8sError(err, res);
    }
});

module.exports = router;
