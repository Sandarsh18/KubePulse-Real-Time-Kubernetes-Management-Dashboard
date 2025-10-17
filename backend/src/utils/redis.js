import Redis from 'ioredis'

let redis = null
const url = process.env.REDIS_URL || process.env.REDIS_HOST
if (url) {
  try {
    redis = new Redis(url)
    redis.on('error', (e) => console.error('Redis error:', e.message))
  } catch (e) {
    console.error('Failed to init Redis:', e.message)
  }
}

export default redis
