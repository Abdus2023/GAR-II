import { Hono } from 'hono'
import { sign } from 'hono/jwt'

export const authRouter = new Hono()

// Dynamic Client Registration (simplified for Phase 1)
authRouter.post('/register', async (c) => {
  const body = await c.req.json()
  const clientId = crypto.randomUUID()

  return c.json({
    client_id: clientId,
    client_secret: 'dev-secret',
    redirect_uris: body.redirect_uris,
  })
})

// Simple token endpoint for development
authRouter.post('/token', async (c) => {
  const body = await c.req.parseBody()

  const accessToken = await sign({
    sub: 'dev-user',
    aud: process.env.MCP_SERVER_URL || 'http://localhost:3000',
    iss: process.env.MCP_SERVER_URL || 'http://localhost:3000',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  }, process.env.JWT_SECRET || 'dev-secret')

  return c.json({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: 3600,
  })
})

// OAuth metadata
authRouter.get('/.well-known/oauth-authorization-server', (c) => {
  const base = process.env.MCP_SERVER_URL || 'http://localhost:3000'
  return c.json({
    issuer: base,
    authorization_endpoint: `${base}/auth/authorize`,
    token_endpoint: `${base}/auth/token`,
    registration_endpoint: `${base}/auth/register`,
  })
})