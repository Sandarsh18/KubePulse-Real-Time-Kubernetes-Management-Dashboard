import k8s from '@kubernetes/client-node'
import fs from 'fs'

const kc = new k8s.KubeConfig()

const kubeconfigInline = process.env.KUBECONFIG_DATA
const kubeconfigPath = process.env.KUBECONFIG
const inCluster = !!process.env.KUBERNETES_SERVICE_HOST
const saCaPath = '/var/run/secrets/kubernetes.io/serviceaccount/ca.crt'

function tryLoadConfig() {
  if (kubeconfigInline && kubeconfigInline.trim().length > 0) {
    kc.loadFromString(kubeconfigInline)
  } else if (kubeconfigPath && fs.existsSync(kubeconfigPath)) {
    kc.loadFromFile(kubeconfigPath)
  } else if (inCluster && fs.existsSync(saCaPath)) {
    kc.loadFromCluster()
  } else {
    kc.loadFromDefault()
  }
  // if no current cluster, try first context as a fallback
  if (!kc.getCurrentCluster()) {
    const ctxs = kc.getContexts()
    if (ctxs && ctxs.length > 0) kc.setCurrentContext(ctxs[0].name)
  }
}

try {
  tryLoadConfig()
} catch (e) {
  // swallow; we'll expose null clients
  console.warn('Kubernetes config load failed:', e?.message)
}

let k8sCore = null
let k8sApps = null
let log = null
try {
  if (kc.getCurrentCluster()) {
    k8sCore = kc.makeApiClient(k8s.CoreV1Api)
    k8sApps = kc.makeApiClient(k8s.AppsV1Api)
    log = new k8s.Log(kc)
  } else {
    console.warn('No active Kubernetes cluster in config; API clients not initialized.')
  }
} catch (e) {
  console.warn('Failed to initialize Kubernetes clients:', e?.message)
}

export { k8sCore, k8sApps, log, kc as k8sConfig }
export default kc
