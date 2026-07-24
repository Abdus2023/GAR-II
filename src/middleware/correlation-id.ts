import { createMiddleware } from 'hono/factory'

export const CORRELATION_ID_HEADER = 'X-Request-ID'

function isSafeRequestId(value: string) {
  return /^[A-Za-z0-9._:-]{1,128}$/.test(value)
}

export const correlationId = createMiddleware(async (c, next) => {
  const inboundId = c.req.header(CORRELATION_ID_HEADER) || c.req.header('X-Correlation-ID')
  const requestId = inboundId && isSafeRequestId(inboundId)
    ? inboundId
    : crypto.randomUUID()

  c.set('correlationId', requestId)
  c.header(CORRELATION_ID_HEADER, requestId)

  await next()
})
