import express from 'express'
import { k8sCore, k8sApps, log as k8sLog, k8sConfig } from '../utils/k8sClient.js'

const router = express.Router()
const DEMO = String(process.env.DEMO_MODE || '').toLowerCase() === 'true'
if (DEMO) console.log('K8s routes using DEMO data');

function ensureClientOrDemo(res) {
  if (!k8sCore || !k8sApps) {
    if (DEMO) return 'demo'
    res.status(503).json({ error: 'Kubernetes client not initialized. Ensure kubeconfig is mounted or run inside a cluster.' })
    return false
  }
  return true
}

router.get('/namespaces', async (req, res) => {
  const ok = ensureClientOrDemo(res)
  if (ok === false) return
  if (ok === 'demo') return res.json(['default', 'kube-system', 'devops-demo'])
  try {
    const { body } = await k8sCore.listNamespace()
    res.json(body.items.map(n => n.metadata.name))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/pods', async (req, res) => {
  const ok = ensureClientOrDemo(res)
  if (ok === false) return
  const ns = req.query.ns || 'devops-demo'
  if (ok === 'demo') {
    return res.json([
      { metadata: { name: 'api-779d8c7d9b-abcde', namespace: ns }, status: { phase: 'Running' } },
      { metadata: { name: 'worker-7b6b8dd7cc-fghij', namespace: ns }, status: { phase: 'Pending' } }
    ])
  }
  try {
    const { body } = await k8sCore.listNamespacedPod(ns)
    res.json(body.items)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/deployments', async (req, res) => {
  const ok = ensureClientOrDemo(res)
  if (ok === false) return
  const ns = req.query.ns || 'devops-demo'
  if (ok === 'demo') {
    return res.json([
      { metadata: { name: 'api', namespace: ns }, spec: { replicas: 2 }, status: { replicas: 2, availableReplicas: 2 } },
      { metadata: { name: 'worker', namespace: ns }, spec: { replicas: 1 }, status: { replicas: 1, availableReplicas: 0 } }
    ])
  }
  try {
    const { body } = await k8sApps.listNamespacedDeployment(ns)
    res.json(body.items)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/scale', async (req, res) => {
  const ok = ensureClientOrDemo(res)
  if (ok === false) return
  const { ns = 'devops-demo', name } = req.body
  let { replicas } = req.body
  replicas = Number(replicas)

  console.log(`[SCALE] Request received: ns=${ns}, name=${name}, replicas=${replicas}`)
  if (!name || Number.isNaN(replicas)) {
    return res.status(400).json({ error: 'name and numeric replicas are required' })
  }
  if (replicas < 0) {
    return res.status(400).json({ error: 'replicas cannot be negative' })
  }
  if (ok === 'demo') return res.json({ status: 'scaled', name, ns, replicas })

  const patchHeaders = { headers: { 'Content-Type': 'application/merge-patch+json' } }
  const scaleBody = { spec: { replicas } }

  // Helper to try patching a specific workload kind
  async function tryPatch(kind) {
    switch (kind) {
      case 'deployment':
        return k8sApps.patchNamespacedDeploymentScale(name, ns, scaleBody, undefined, undefined, undefined, undefined, patchHeaders)
      case 'statefulset':
        return k8sApps.patchNamespacedStatefulSetScale(name, ns, scaleBody, undefined, undefined, undefined, undefined, patchHeaders)
      case 'replicaset':
        return k8sApps.patchNamespacedReplicaSetScale(name, ns, scaleBody, undefined, undefined, undefined, undefined, patchHeaders)
      default:
        throw new Error(`Unsupported kind: ${kind}`)
    }
  }

  try {
    // Prefer Deployment; if not found (404), try other common kinds
    try {
      console.log(`[SCALE] Patching Deployment ${name} in ${ns} to ${replicas}`)
      const { body } = await tryPatch('deployment')
      console.log(`[SCALE] Success (Deployment) ${name} -> ${replicas}`)
      return res.json(body)
    } catch (e) {
      const code = e?.response?.statusCode || e?.statusCode || e?.response?.status
      const msg = e?.body?.message || e?.message
      console.warn(`[SCALE] Deployment patch failed (${code}): ${msg}`)
      if (code !== 404) throw e
    }

    // Fallbacks
    try {
      console.log(`[SCALE] Trying StatefulSet ${name} in ${ns}`)
      const { body } = await tryPatch('statefulset')
      console.log(`[SCALE] Success (StatefulSet) ${name} -> ${replicas}`)
      return res.json(body)
    } catch (e) {
      const code = e?.response?.statusCode || e?.statusCode || e?.response?.status
      const msg = e?.body?.message || e?.message
      console.warn(`[SCALE] StatefulSet patch failed (${code}): ${msg}`)
      if (code !== 404) throw e
    }

    try {
      console.log(`[SCALE] Trying ReplicaSet ${name} in ${ns}`)
      const { body } = await tryPatch('replicaset')
      console.log(`[SCALE] Success (ReplicaSet) ${name} -> ${replicas}`)
      return res.json(body)
    } catch (e) {
      const code = e?.response?.statusCode || e?.statusCode || e?.response?.status
      const msg = e?.body?.message || e?.message
      console.warn(`[SCALE] ReplicaSet patch failed (${code}): ${msg}`)
      if (code === 404) {
        return res.status(404).json({ error: `Workload ${name} not found in namespace ${ns}` })
      }
      throw e
    }
  } catch (e) {
    const code = e?.response?.statusCode || e?.statusCode || e?.response?.status
    const msg = e?.body?.message || e?.message
    console.error(`[SCALE] Error scaling ${name}:`, code, msg)
    return res.status(code && Number.isInteger(code) ? code : 500).json({ error: msg || 'Failed to scale workload' })
  }
})

router.post('/pods/:name/restart', async (req, res) => {
  const ok = ensureClientOrDemo(res)
  if (ok === false) return
  const ns = req.body.ns || 'devops-demo'
  const name = req.params.name
  if (ok === 'demo') return res.json({ status: 'restarted', ns, name })
  try {
    await k8sCore.deleteNamespacedPod(name, ns)
    res.json({ status: 'restarted' })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.delete('/pods/:name', async (req, res) => {
  const ok = ensureClientOrDemo(res)
  if (ok === false) return
  const ns = req.query.ns || 'devops-demo'
  const name = req.params.name
  if (ok === 'demo') return res.json({ status: 'deleted', ns, name })
  try {
    await k8sCore.deleteNamespacedPod(name, ns)
    res.json({ status: 'deleted' })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/logs', async (req, res) => {
  const ok = ensureClientOrDemo(res)
  if (ok === false) return
  const ns = req.query.ns || 'devops-demo'
  const pod = req.query.pod
  const container = req.query.container
  if (!pod) return res.status(400).json({error:'pod required'})
  if (ok === 'demo') {
    return res.type('text/plain').send(`Simulated logs for ${pod} in ${ns}\n` +
      Array.from({length:50}).map((_,i)=>`[demo] line ${i+1} - ${new Date().toISOString()}`).join('\n'))
  }
  try {
    const { body } = await k8sCore.readNamespacedPodLog(pod, ns, container, undefined, true, undefined, undefined, 200, true)
    res.type('text/plain').send(body)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/events', async (req, res) => {
  const ok = ensureClientOrDemo(res)
  if (ok === false) return
  const ns = req.query.ns || 'devops-demo'
  if (ok === 'demo') return res.json([])
  try {
    const { body } = await k8sCore.listNamespacedEvent(ns)
    res.json(body.items)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default router
