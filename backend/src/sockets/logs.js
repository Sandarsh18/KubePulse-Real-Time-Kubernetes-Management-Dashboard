import { Log } from '@kubernetes/client-node'
import { k8sConfig } from '../utils/k8sClient.js'
import { PassThrough } from 'stream'

export default function initLogSocket(io) {
  const log = new Log(k8sConfig)
  const DEMO = String(process.env.DEMO_MODE || '').toLowerCase() === 'true'

  io.of('/logs').on('connection', (socket) => {
    let stream
    let timer

    socket.on('subscribe', async ({ ns='devops-demo', pod, container }) => {
      if (!pod) return
      // clear previous
      if (stream) stream.end()
      if (timer) clearInterval(timer)

      if (DEMO) {
        let count = 0
        timer = setInterval(() => {
          socket.emit('log', `[demo] ${pod} ${ns} line ${++count} - ${new Date().toISOString()}\n`)
        }, 500)
        return
      }

      stream = new PassThrough()
      stream.on('data', (chunk) => {
        socket.emit('log', chunk.toString())
      })
      try {
        await log.log(ns, pod, container, stream, { follow: true, tailLines: 100 })
      } catch (e) {
        socket.emit('error', e.message)
      }
    })

    socket.on('disconnect', () => {
      if (stream) stream.end()
      if (timer) clearInterval(timer)
    })
  })
}
