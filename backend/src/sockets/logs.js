import { Log } from '@kubernetes/client-node'
import { k8sConfig, k8sCore as core } from '../utils/k8sClient.js'
import { PassThrough } from 'stream'

export default function initLogSocket(io) {
  const log = new Log(k8sConfig)
  const DEMO = String(process.env.DEMO_MODE || '').toLowerCase() === 'true'

  io.of('/logs').on('connection', (socket) => {
    let state = { id: 0, stream: null, timer: null, closed: false }

    socket.on('subscribe', async ({ ns='devops-demo', pod, container }) => {
      if (!pod) return

      // End previous stream (intentional close)
      if (state.stream) {
        state.closed = true
        try { state.stream.end() } catch {}
      }
      if (state.timer) { clearInterval(state.timer); state.timer = null }

      // Advance subscription id to invalidate any in-flight handlers
      const myId = ++state.id
      state.closed = false

      if (DEMO) {
        let count = 0
        state.timer = setInterval(() => {
          // Only emit if this subscription is current
          if (state.id === myId) {
            socket.emit('log', `[demo] ${pod} ${ns} line ${++count} - ${new Date().toISOString()}\n`)
          }
        }, 500)
        return
      }

      // Resolve container automatically if not provided (first container)
      let chosenContainer = container
      if (!chosenContainer && core) {
        try {
          const { body } = await core.readNamespacedPod(pod, ns)
          const containers = body?.spec?.containers || []
          if (containers.length > 0) chosenContainer = containers[0].name
        } catch {
          // best-effort; continue without container
        }
      }

      const stream = new PassThrough()
      state.stream = stream

      stream.on('data', (chunk) => {
        if (state.id === myId) socket.emit('log', chunk.toString())
      })

      try {
        await log.log(ns, pod, chosenContainer, stream, { follow: true, tailLines: 100 })
      } catch (e) {
        // Ignore stale or intentionally closed streams
        if (state.id !== myId || state.closed) return
        const raw = e?.body?.message || e?.message || 'Log stream failed'
        // Suppress common abort/transport noises when switching pods
        if (/HTTP request failed|aborted|socket hang up|The operation was aborted/i.test(raw)) return
        socket.emit('error', raw)
      }
    })

    socket.on('disconnect', () => {
      state.closed = true
      try { if (state.stream) state.stream.end() } catch {}
      if (state.timer) clearInterval(state.timer)
      state.stream = null
      state.timer = null
    })
  })
}
