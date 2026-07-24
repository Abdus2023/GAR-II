import { describe, expect, it } from 'vitest'
import { Hono } from 'hono'
import { createRateLimitMiddleware, MemoryRateLimitStore, type RateLimitStore } from '../src/middleware/rate-limit'

function createRateLimitedApp(store: RateLimitStore, maxRequests = 2) {
  const app = new Hono()
  app.use('*', createRateLimitMiddleware({
    store,
    maxRequests,
    windowMs: 60_000,
    keyPrefix: `test-${crypto.randomUUID()}`,
  }))
  app.get('/limited', c => c.json({ ok: true }))
  return app
}

describe('rateLimit middleware', () => {
  it('limits requests by client identifier and emits standard headers', async () => {
    const app = createRateLimitedApp(new MemoryRateLimitStore(), 2)
    const headers = { 'CF-Connecting-IP': '203.0.113.10' }

    const first = await app.request('/limited', { headers })
    const second = await app.request('/limited', { headers })
    const third = await app.request('/limited', { headers })

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(third.status).toBe(429)
    expect(first.headers.get('X-RateLimit-Limit')).toBe('2')
    expect(second.headers.get('X-RateLimit-Remaining')).toBe('0')
    expect(third.headers.get('Retry-After')).toBeTruthy()
    await expect(third.json()).resolves.toMatchObject({ error: 'rate_limit_exceeded' })
  })

  it('allows requests when the configured external store fails closed-open', async () => {
    const failingStore: RateLimitStore = {
      increment: async () => {
        throw new Error('redis unavailable')
      },
    }
    const app = createRateLimitedApp(failingStore, 1)

    const first = await app.request('/limited')
    const second = await app.request('/limited')

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
  })
})
