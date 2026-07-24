import { createMiddleware } from 'hono/factory'
import { telemetry } from '../telemetry'

export const telemetryMiddleware = createMiddleware(async (c, next) => {
  if (!telemetry.isEnabled()) {
    await next()
    return
  }

  await telemetry.withSpan('http.request', {
    'http.request.method': c.req.method,
    'url.path': new URL(c.req.url).pathname,
    'http.route': c.req.path,
    'request.id': c.get('correlationId'),
  }, async span => {
    await next()
    span.setAttribute('http.response.status_code', c.res.status)
    if (c.res.status >= 500) {
      span.setStatus('ERROR', `HTTP ${c.res.status}`)
    }
  })
})
