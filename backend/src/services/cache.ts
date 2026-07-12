import { Redis } from 'ioredis'

let redis: Redis | null = null
const memoryCache = new Map<string, { value: string; expireAt: number }>()

function useRedis() {
  return process.env.REDIS_ENABLED === 'true'
}

export function getRedis(): Redis | null {
  if (!useRedis()) return null
  if (redis) return redis
  redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  })
  redis.on('error', (err: Error) => console.warn('[Redis]', err.message))
  return redis
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const client = getRedis()
    if (client) {
      const raw = await client.get(key)
      return raw ? (JSON.parse(raw) as T) : null
    }
  } catch {
    // fallback memory
  }
  const hit = memoryCache.get(key)
  if (!hit) return null
  if (Date.now() > hit.expireAt) {
    memoryCache.delete(key)
    return null
  }
  return JSON.parse(hit.value) as T
}

export async function cacheSet(key: string, value: unknown, ttlSeconds = 300) {
  const raw = JSON.stringify(value)
  try {
    const client = getRedis()
    if (client) {
      await client.set(key, raw, 'EX', ttlSeconds)
      return
    }
  } catch {
    // fallback memory
  }
  memoryCache.set(key, { value: raw, expireAt: Date.now() + ttlSeconds * 1000 })
}
