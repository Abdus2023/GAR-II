import { Hono } from 'hono'
import { sign } from 'hono/jwt'
import { z } from 'zod'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { config } from '../config'
import { authCodes, db, initializeDatabase, oauthClients } from '../database'

export const authRouter = new Hono()

const RegisterClientInput = z.object({
  redirect_uris: z.array(z.string().url()).min(1),
  client_name: z.string().min(1).max(120).optional(),
  name: z.string().min(1).max(120).optional(),
})

const TokenInput = z.object({
  grant_type: z.enum(['client_credentials', 'authorization_code']).default('client_credentials'),
  client_id: z.string().min(1),
  client_secret: z.string().min(1),
  code: z.string().optional(),
  redirect_uri: z.string().url().optional(),
})

function hashClientSecret(secret: string) {
  return createHash('sha256').update(secret).digest('hex')
}

function verifyClientSecret(rawSecret: string, storedHash: string) {
  const candidate = Buffer.from(hashClientSecret(rawSecret), 'hex')
  const expected = Buffer.from(storedHash, 'hex')

  return candidate.length === expected.length && timingSafeEqual(candidate, expected)
}

function generateClientSecret() {
  return randomBytes(32).toString('base64url')
}

function formValueToString(value: unknown) {
  if (typeof value === 'string') return value
  if (typeof File !== 'undefined' && value instanceof File) return value.name
  if (Array.isArray(value)) return formValueToString(value[0])
  return undefined
}

async function readRequestBody(c: any) {
  const contentType = c.req.header('content-type') || ''

  if (contentType.includes('application/json')) {
    return c.req.json()
  }

  const form = await c.req.parseBody()
  return Object.fromEntries(
    Object.entries(form).map(([key, value]) => [key, formValueToString(value)])
  )
}

async function signAccessToken(subject: string) {
  const now = Math.floor(Date.now() / 1000)

  return sign({
    sub: subject,
    aud: config.mcpServerUrl,
    iss: config.mcpServerUrl,
    iat: now,
    exp: now + config.authTokenTtlSeconds,
  }, config.jwtSecret)
}

function parseRedirectUris(value: string) {
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// Dynamic Client Registration backed by SQLite/Turso.
authRouter.post('/register', async (c) => {
  await initializeDatabase()

  const body = await c.req.json().catch(() => null)
  const parsed = RegisterClientInput.safeParse(body)

  if (!parsed.success) {
    return c.json({
      error: 'invalid_client_metadata',
      details: parsed.error.issues,
    }, 400)
  }

  const clientId = crypto.randomUUID()
  const clientSecret = generateClientSecret()
  const displayName = parsed.data.client_name || parsed.data.name || 'Claude Hub Client'

  await db.insert(oauthClients).values({
    id: clientId,
    secret: hashClientSecret(clientSecret),
    redirectUris: JSON.stringify(parsed.data.redirect_uris),
    name: displayName,
    createdAt: Date.now(),
  })

  return c.json({
    client_id: clientId,
    client_secret: clientSecret,
    client_secret_expires_at: 0,
    client_name: displayName,
    redirect_uris: parsed.data.redirect_uris,
    token_endpoint_auth_method: 'client_secret_post',
    grant_types: ['client_credentials', 'authorization_code'],
  })
})

// Token endpoint for registered clients.
authRouter.post('/token', async (c) => {
  await initializeDatabase()

  const body = await readRequestBody(c)
  const parsed = TokenInput.safeParse(body)

  if (!parsed.success) {
    return c.json({
      error: 'invalid_request',
      details: parsed.error.issues,
    }, 400)
  }

  const input = parsed.data
  const client = await db.query.oauthClients.findFirst({
    where: eq(oauthClients.id, input.client_id),
  })

  if (!client || !verifyClientSecret(input.client_secret, client.secret)) {
    return c.json({ error: 'invalid_client' }, 401)
  }

  const redirectUris = parseRedirectUris(client.redirectUris)
  let subject = `client:${client.id}`

  if (input.grant_type === 'authorization_code') {
    if (!input.code || !input.redirect_uri) {
      return c.json({ error: 'invalid_request', error_description: 'code and redirect_uri are required' }, 400)
    }

    if (!redirectUris.includes(input.redirect_uri)) {
      return c.json({ error: 'invalid_grant', error_description: 'redirect_uri is not registered for this client' }, 400)
    }

    const codeRecord = await db.query.authCodes.findFirst({
      where: and(
        eq(authCodes.code, input.code),
        eq(authCodes.clientId, input.client_id),
        eq(authCodes.redirectUri, input.redirect_uri)
      ),
    })

    if (!codeRecord) {
      return c.json({ error: 'invalid_grant' }, 400)
    }

    await db.delete(authCodes).where(eq(authCodes.code, input.code))

    if (codeRecord.expiresAt <= Date.now()) {
      return c.json({ error: 'invalid_grant', error_description: 'authorization code expired' }, 400)
    }

    subject = codeRecord.userId
  }

  const accessToken = await signAccessToken(subject)

  return c.json({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: config.authTokenTtlSeconds,
  })
})

// OAuth metadata
authRouter.get('/.well-known/oauth-authorization-server', (c) => {
  const base = config.mcpServerUrl
  return c.json({
    issuer: base,
    authorization_endpoint: `${base}/auth/authorize`,
    token_endpoint: `${base}/auth/token`,
    registration_endpoint: `${base}/auth/register`,
    token_endpoint_auth_methods_supported: ['client_secret_post'],
    grant_types_supported: ['client_credentials', 'authorization_code'],
  })
})
