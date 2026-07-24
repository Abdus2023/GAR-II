import { createMiddleware } from 'hono/factory'
import { verify } from 'hono/jwt'
import { logger } from '../logger'

export const validateAuth = createMiddleware(async (c, next) => {
  const authHeader = c.req.header('Authorization')

  // For Phase 1 development: allow requests without auth
  if (process.env.NODE_ENV === 'development' && !authHeader) {
    c.set('userId', 'dev-user')
    await next()
    return
  }

  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing authorization' }, 401)
  }

  if (process.env.NODE_ENV !== 'development' && (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'dev-secret')) {
    return c.json({ error: 'Server misconfiguration: JWT_SECRET not set' }, 500)
  }

  const token = authHeader.slice(7)

  try {
    const payload = await verify(token, process.env.JWT_SECRET || 'dev-secret', 'HS256')

    if (payload.aud !== (process.env.MCP_SERVER_URL || 'http://localhost:3000')) {
      logger.warn({ aud: payload.aud }, 'Invalid token audience')
      return c.json({ error: 'Invalid token audience' }, 401)
    }

    c.set('userId', payload.sub as string)
    await next()
  } catch (error) {
    logger.warn({ error }, 'Token validation failed')
    return c.json({ error: 'Invalid token' }, 401)
  }
})