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
  const { ns='devops-demo', name, replicas } = req.body
  console.log(`[SCALE] Request received: ns=${ns}, name=${name}, replicas=${replicas}`)
  if (!name || replicas === undefined) return res.status(400).json({error:'name and replicas required'})
  if (ok === 'demo') return res.json({ status: 'scaled', name, ns, replicas })
  try {
    // First, read the current scale
    console.log(`[SCALE] Reading current scale for ${name} in namespace ${ns}`)
    const { body: currentScale } = await k8sApps.readNamespacedDeploymentScale(name, ns)
    
    // Update the replicas
    currentScale.spec.replicas = replicas
    
    // Replace the scale
    console.log(`[SCALE] Updating deployment ${name} in namespace ${ns} to ${replicas} replicas`)
    const { body } = await k8sApps.replaceNamespacedDeploymentScale(name, ns, currentScale)
    console.log(`[SCALE] Success! Deployment ${name} scaled to ${replicas} replicas`)
    res.json(body)
  } catch (e) {
    console.error(`[SCALE] Error scaling ${name}:`, e.message, e.body?.message || '')
    res.status(500).json({ error: e.body?.message || e.message })
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
