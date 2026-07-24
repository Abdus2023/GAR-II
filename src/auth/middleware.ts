import { createMiddleware } from 'hono/factory'
import { verify } from 'hono/jwt'
import { config } from '../config'
import { logger } from '../logger'

const CLOCK_SKEW_SECONDS = 30
let warnedAboutDevBypass = false

export const validateAuth = createMiddleware(async (c, next) => {
  const authHeader = c.req.header('Authorization')

  // Development convenience: local MCP clients can connect before OAuth is configured.
  if (config.nodeEnv === 'development' && !authHeader) {
    if (!warnedAboutDevBypass) {
      logger.warn('Authentication bypass enabled because NODE_ENV=development and no Authorization header was supplied')
      warnedAboutDevBypass = true
    }

    c.set('userId', 'dev-user')
    await next()
    return
  }

  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing authorization' }, 401)
  }

  const token = authHeader.slice(7)

  try {
    const payload = await verify(token, config.jwtSecret, 'HS256')
    const now = Math.floor(Date.now() / 1000)

    if (payload.aud !== config.mcpServerUrl) {
      logger.warn({ aud: payload.aud }, 'Invalid token audience')
      return c.json({ error: 'Invalid token audience' }, 401)
    }

    if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
      return c.json({ error: 'Invalid token subject' }, 401)
    }

    if (typeof payload.exp !== 'number' || payload.exp <= now) {
      return c.json({ error: 'Token expired' }, 401)
    }

    if (typeof payload.nbf === 'number' && payload.nbf > now + CLOCK_SKEW_SECONDS) {
      return c.json({ error: 'Token not yet valid' }, 401)
    }

    if (typeof payload.iat === 'number' && payload.iat > now + CLOCK_SKEW_SECONDS) {
      return c.json({ error: 'Token issued in the future' }, 401)
    }

    c.set('userId', payload.sub)
    await next()
  } catch (error) {
    logger.warn({ error }, 'Token validation failed')
    return c.json({ error: 'Invalid token' }, 401)
  }
})
