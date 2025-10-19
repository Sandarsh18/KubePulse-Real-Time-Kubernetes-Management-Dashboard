import express from 'express'
import http from 'http'
import cors from 'cors'
import morgan from 'morgan'
import dotenv from 'dotenv'
import cookieParser from 'cookie-parser'
import k8sRoutes from './api/k8sRoutes.js'
import chatRoutes from './api/chatRoutes.js'
import authRoutes from './routes/authRoutes.js'
import initChatSocket from './sockets/chat.js'
import initLogSocket from './sockets/logs.js'
import client from 'prom-client'
import { k8sConfig as kc } from './utils/k8sClient.js'
import { connectDB, disconnectDB } from './utils/database.js'

dotenv.config()

const app = express()

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true // Allow cookies
}))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())
app.use(morgan('dev'))

// Connect to MongoDB
connectDB()

const demo = String(process.env.DEMO_MODE || '').toLowerCase() === 'true'
if (demo) console.log('DEMO_MODE enabled; serving mock Kubernetes data')
else console.log('DEMO_MODE disabled; using real Kubernetes cluster if available:', kc.getCurrentCluster()?.server)

// Routes
app.get('/api/health', (req, res) => res.json({status:'ok'}))
app.use('/api/auth', authRoutes)
app.use('/api/k8s', k8sRoutes)
app.use('/api/chat', chatRoutes)

// metrics
const register = new client.Registry()
client.collectDefaultMetrics({ register })
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType)
  res.end(await register.metrics())
})

const server = http.createServer(app)
const io = initChatSocket(server)
initLogSocket(io)

const PORT = process.env.PORT || 8080
server.listen(PORT, () => console.log(`🚀 Backend listening on ${PORT}`))

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} received. Closing server gracefully...`)
  
  server.close(async () => {
    console.log('HTTP server closed')
    await disconnectDB()
    process.exit(0)
  })
  
  // Force close after 10 seconds
  setTimeout(() => {
    console.error('Forcing shutdown after timeout')
    process.exit(1)
  }, 10000)
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))
