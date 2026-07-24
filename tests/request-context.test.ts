import { describe, expect, it } from 'vitest'
import {
  getCurrentCorrelationId,
  getCurrentUserId,
  runWithRequestContext,
} from '../src/request-context'

describe('request context', () => {
  it('propagates user and correlation IDs across async boundaries', async () => {
    const result = await runWithRequestContext(
      { userId: 'user-123', correlationId: 'request-abc' },
      async () => {
        await Promise.resolve()
        return {
          userId: getCurrentUserId(),
          correlationId: getCurrentCorrelationId(),
        }
      }
    )

    expect(result).toEqual({
      userId: 'user-123',
      correlationId: 'request-abc',
    })
  })

  it('falls back when no request context is active', () => {
    expect(getCurrentUserId('fallback-user')).toBe('fallback-user')
    expect(getCurrentCorrelationId()).toBeUndefined()
  })
})
