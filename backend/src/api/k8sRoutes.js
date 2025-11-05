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

  // Helper to scale using READ then REPLACE method (works around 415 errors)
  async function scaleWithReplace(readFn, replaceFn, kind) {
    try {
      console.log(`[SCALE] Reading current ${kind} scale ${ns}/${name}`)
      const { body: currentScale } = await readFn(name, ns)
      
      // Update replicas in the scale object
      currentScale.spec.replicas = replicas
      
      console.log(`[SCALE] Replacing ${kind} scale ${ns}/${name} with ${replicas} replicas`)
      await replaceFn(name, ns, currentScale)
      
      console.log(`✅ Scaled ${kind} ${ns}/${name} to ${replicas}`)
      return { status: 'scaled', name, ns, replicas, kind }
    } catch (err) {
      if (err.statusCode === 404) {
        throw err // Resource doesn't exist, try next kind
      }
      console.error(`[SCALE] ${kind} error (${err.statusCode}):`, err.body?.message || err.message)
      throw err
    }
  }

  try {
    const result = await scaleWithReplace(
      (n, ns) => k8sApps.readNamespacedDeploymentScale(n, ns),
      (n, ns, body) => k8sApps.replaceNamespacedDeploymentScale(n, ns, body),
      'Deployment'
    )
    return res.json(result)
  } catch (err) {
    if (err.statusCode !== 404) {
      console.log(`[SCALE] Not a Deployment: ${err.body?.message || err.message}`)
    }
  }

  try {
    const result = await scaleWithReplace(
      (n, ns) => k8sApps.readNamespacedStatefulSetScale(n, ns),
      (n, ns, body) => k8sApps.replaceNamespacedStatefulSetScale(n, ns, body),
      'StatefulSet'
    )
    return res.json(result)
  } catch (err) {
    if (err.statusCode !== 404) {
      console.log(`[SCALE] Not a StatefulSet: ${err.body?.message || err.message}`)
    }
  }

  try {
    const result = await scaleWithReplace(
      (n, ns) => k8sApps.readNamespacedReplicaSetScale(n, ns),
      (n, ns, body) => k8sApps.replaceNamespacedReplicaSetScale(n, ns, body),
      'ReplicaSet'
    )
    return res.json(result)
  } catch (err) {
    console.error(`[SCALE] Failed to scale ${ns}/${name}:`, err.body || err.message)
    return res.status(500).json({ 
      error: 'Resource not found or cannot be scaled', 
      details: err.body?.message || err.message 
    })
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
