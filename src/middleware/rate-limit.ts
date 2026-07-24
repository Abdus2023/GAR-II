import { createMiddleware } from 'hono/factory'
import { config } from '../config'
import { logger } from '../logger'

export interface RateLimitRecord {
  count: number
  resetTime: number
}

export interface RateLimitStore {
  increment(key: string, windowMs: number): Promise<RateLimitRecord>
}

export interface RateLimitOptions {
  windowMs?: number
  maxRequests?: number
  store?: RateLimitStore
  keyPrefix?: string
}

export class MemoryRateLimitStore implements RateLimitStore {
  private requestCounts = new Map<string, RateLimitRecord>()

  async increment(key: string, windowMs: number): Promise<RateLimitRecord> {
    const now = Date.now()
    let current = this.requestCounts.get(key)

    if (!current || now > current.resetTime) {
      current = { count: 0, resetTime: now + windowMs }
    }

    current.count += 1
    this.requestCounts.set(key, current)
    this.cleanupExpired(now)

    return current
  }

  private cleanupExpired(now: number) {
    if (this.requestCounts.size <= 1_000) return

    for (const [key, value] of this.requestCounts) {
      if (value.resetTime <= now) {
        this.requestCounts.delete(key)
      }
    }

    while (this.requestCounts.size > 1_000) {
      const oldestKey = this.requestCounts.keys().next().value
      if (!oldestKey) break
      this.requestCounts.delete(oldestKey)
    }
  }
}

export class UpstashRedisRateLimitStore implements RateLimitStore {
  private readonly baseUrl: string
  private readonly token: string

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
    this.token = token
  }

  async increment(key: string, windowMs: number): Promise<RateLimitRecord> {
    const ttlCommand = ['PTTL', key]
    const response = await fetch(`${this.baseUrl}/pipeline`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify([
        ['SET', key, '0', 'PX', windowMs, 'NX'],
        ['INCR', key],
        ttlCommand,
      ]),
    })

    if (!response.ok) {
      throw new Error(`Upstash Redis rate-limit request failed: ${response.status} ${response.statusText}`)
    }

    const body = await response.json() as Array<{ result?: unknown; error?: string }>
    const count = Number(body[1]?.result || 0)
    let ttlMs = Number(body[2]?.result || windowMs)

    if (!Number.isFinite(ttlMs) || ttlMs < 0) {
      ttlMs = windowMs
    }

    return {
      count,
      resetTime: Date.now() + ttlMs,
    }
  }
}

function getClientIdentifier(c: any) {
  const userId = c.get?.('userId')
  if (typeof userId === 'string' && userId.length > 0) return `user:${userId}`

  const forwardedFor = c.req.header('X-Forwarded-For')?.split(',')[0]?.trim()
  const ip = c.req.header('CF-Connecting-IP')
    || c.req.header('X-Real-IP')
    || forwardedFor
    || 'anonymous'

  return `ip:${ip}`
}

function createDefaultStore() {
  if (config.upstashRedisUrl && config.upstashRedisToken) {
    logger.info('Using Upstash Redis-backed rate limiter')
    return new UpstashRedisRateLimitStore(config.upstashRedisUrl, config.upstashRedisToken)
  }

  logger.info('Using in-memory rate limiter')
  return new MemoryRateLimitStore()
}

export function createRateLimitMiddleware(options: RateLimitOptions = {}) {
  const windowMs = options.windowMs ?? config.rateLimitWindowMs
  const maxRequests = options.maxRequests ?? config.rateLimitMaxRequests
  const store = options.store ?? createDefaultStore()
  const keyPrefix = options.keyPrefix ?? 'rate-limit'

  return createMiddleware(async (c, next) => {
    const now = Date.now()
    const windowKey = Math.floor(now / windowMs)
    const clientId = getClientIdentifier(c)
    const key = `${keyPrefix}:${clientId}:${windowKey}`

    let current: RateLimitRecord

    try {
      current = await store.increment(key, windowMs)
    } catch (error: any) {
      logger.warn({ error: error.message }, 'Configured rate-limit store failed; allowing request')
      await next()
      return
    }

    const remaining = Math.max(0, maxRequests - current.count)
    const retryAfter = Math.max(0, Math.ceil((current.resetTime - now) / 1000))

    c.header('X-RateLimit-Limit', String(maxRequests))
    c.header('X-RateLimit-Remaining', String(remaining))
    c.header('X-RateLimit-Reset', String(current.resetTime))

    if (current.count > maxRequests) {
      c.header('Retry-After', String(retryAfter))
      return c.json({
        error: 'rate_limit_exceeded',
        message: 'Too many requests. Please slow down.',
        retry_after: retryAfter,
      }, 429)
    }

    await next()
  })
}

export const rateLimit = createRateLimitMiddleware()
