import { Server } from 'socket.io'
import { saveMessage } from '../api/chatRoutes.js'

export default function initChatSocket(server) {
  const io = new Server(server, { cors: { origin: '*' } })

  io.on('connection', (socket) => {
    socket.on('chat:send', async (payload) => {
      const user = payload.user || 'anon'
      const text = String(payload.text || '')
      const msg = { id: Date.now(), user, text, ts: new Date().toISOString() }
      await saveMessage(msg)
      io.emit('chat:message', msg)
      if (text.toLowerCase().includes('help')) {
        const bot = { id: Date.now()+1, user: 'DevOpsBot', text: "Hi! I’m your DevOps assistant.", ts: new Date().toISOString() }
        await saveMessage(bot)
        io.emit('chat:message', bot)
      }
    })
  })

  return io
}
