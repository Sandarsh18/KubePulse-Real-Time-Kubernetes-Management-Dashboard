import { Server } from 'socket.io'
import { saveMessage } from '../api/chatRoutes.js'

export default function initChatSocket(server) {
  const io = new Server(server, { cors: { origin: '*' } })
  
  // Track online users
  const onlineUsers = new Map() // socketId -> username
  
  const broadcastOnlineUsers = () => {
    const users = Array.from(new Set(onlineUsers.values()))
    io.emit('chat:users', users)
  }

  io.on('connection', (socket) => {
    console.log(`Chat: Client connected ${socket.id}`)
    
    // Register user
    socket.on('chat:register', ({ user }) => {
      onlineUsers.set(socket.id, user || 'Anonymous')
      broadcastOnlineUsers()
      console.log(`User registered: ${user}`)
    })
    
    // Handle sending messages
    socket.on('chat:send', async (payload) => {
      const user = payload.user || 'anon'
      const text = String(payload.text || '')
      const replyTo = payload.replyTo
      
      const msg = { 
        id: Date.now(), 
        user, 
        text, 
        timestamp: new Date().toISOString(),
        replyTo,
        reactions: {}
      }
      
      await saveMessage(msg)
      io.emit('chat:message', msg)
      
      // Auto-response for help messages
      if (text.toLowerCase().includes('help')) {
        const bot = { 
          id: Date.now() + 1, 
          user: 'DevOpsBot', 
          text: "👋 Hi! I'm your DevOps assistant. Available commands:\n• 'status' - Check cluster status\n• 'help' - Show this message\n• 'docs' - View documentation", 
          timestamp: new Date().toISOString(),
          reactions: {}
        }
        await saveMessage(bot)
        setTimeout(() => io.emit('chat:message', bot), 500)
      }
    })
    
    // Handle typing indicators
    socket.on('chat:typing', ({ user, isTyping }) => {
      socket.broadcast.emit('chat:typing', { user, isTyping })
    })
    
    // Handle reactions
    socket.on('chat:reaction', ({ messageId, reaction, user }) => {
      io.emit('chat:reaction', { messageId, reaction, user })
    })
    
    // Handle message editing
    socket.on('chat:edit', ({ messageId, newText }) => {
      io.emit('chat:edit', { messageId, newText })
    })
    
    // Handle message deletion
    socket.on('chat:delete', ({ messageId, user }) => {
      io.emit('chat:delete', { messageId, user })
    })
    
    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`Chat: Client disconnected ${socket.id}`)
      onlineUsers.delete(socket.id)
      broadcastOnlineUsers()
    })
  })

  return io
}
