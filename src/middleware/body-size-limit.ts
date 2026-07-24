import { createMiddleware } from 'hono/factory'
import { config } from '../config'

export interface BodySizeLimitOptions {
  maxBytes?: number
}

export function createBodySizeLimitMiddleware(options: BodySizeLimitOptions = {}) {
  const maxBytes = options.maxBytes ?? config.maxJsonBodyBytes

  return createMiddleware(async (c, next) => {
    const method = c.req.method.toUpperCase()
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      await next()
      return
    }

    const contentLength = c.req.header('content-length')
    if (contentLength) {
      const parsedLength = Number(contentLength)
      if (Number.isFinite(parsedLength) && parsedLength > maxBytes) {
        return c.json({
          error: 'payload_too_large',
          message: `Request body exceeds ${maxBytes} bytes`,
          max_bytes: maxBytes,
        }, 413)
      }
    }

    await next()
  })
}

export const jsonBodyLimit = createBodySizeLimitMiddleware()
