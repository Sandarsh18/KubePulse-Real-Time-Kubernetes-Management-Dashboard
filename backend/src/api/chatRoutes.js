import express from 'express'
import redis from '../utils/redis.js'

const messages = []

const router = express.Router()

router.get('/messages', async (req, res) => {
  if (redis) {
    const items = await redis.lrange('chat:messages', -100, -1)
    return res.json(items.map(i => JSON.parse(i)))
  }
  res.json(messages.slice(-100))
})

router.post('/messages', async (req, res) => {
  const { user='anon', text } = req.body
  if (!text) return res.status(400).json({error:'text required'})
  const msg = { id: Date.now(), user, text, ts: new Date().toISOString() }
  messages.push(msg)
  if (redis) await redis.rpush('chat:messages', JSON.stringify(msg))
  res.json(msg)
})

export async function saveMessage(msg) {
  messages.push(msg)
  if (redis) await redis.rpush('chat:messages', JSON.stringify(msg))
}

export default router
