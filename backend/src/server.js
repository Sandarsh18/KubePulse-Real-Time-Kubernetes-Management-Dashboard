import express from 'express'
import http from 'http'
import cors from 'cors'
import morgan from 'morgan'
import dotenv from 'dotenv'
import k8sRoutes from './api/k8sRoutes.js'
import chatRoutes from './api/chatRoutes.js'
import initChatSocket from './sockets/chat.js'
import initLogSocket from './sockets/logs.js'
import client from 'prom-client'
import { k8sConfig as kc } from './utils/k8sClient.js'

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())
app.use(morgan('dev'))

const demo = String(process.env.DEMO_MODE || '').toLowerCase() === 'true'
if (demo) console.log('DEMO_MODE enabled; serving mock Kubernetes data')
else console.log('DEMO_MODE disabled; using real Kubernetes cluster if available:', kc.getCurrentCluster()?.server)

app.get('/api/health', (req, res) => res.json({status:'ok'}))
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
server.listen(PORT, () => console.log(`Backend listening on ${PORT}`))
