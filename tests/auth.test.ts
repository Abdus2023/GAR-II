import { describe, expect, it } from 'vitest'
import { Hono } from 'hono'
import { sign } from 'hono/jwt'
import { authRouter } from '../src/auth/router'
import { validateAuth } from '../src/auth/middleware'
import { config } from '../src/config'
import { initializeDatabase } from '../src/database'

describe('OAuth registration and token flow', () => {
  it('registers a client and issues a JWT only for the matching client secret', async () => {
    await initializeDatabase()
    const app = new Hono()
    app.route('/auth', authRouter)

    const registerResponse = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        client_name: 'Integration Test Client',
        redirect_uris: ['http://localhost/callback'],
      }),
    })

    expect(registerResponse.status).toBe(200)
    const registered = await registerResponse.json()
    expect(registered.client_id).toBeTruthy()
    expect(registered.client_secret).toBeTruthy()
    expect(registered.client_secret).not.toBe('dev-secret')

    const badSecretResponse = await app.request('/auth/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: registered.client_id,
        client_secret: 'wrong-secret',
      }),
    })

    expect(badSecretResponse.status).toBe(401)

    const tokenResponse = await app.request('/auth/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: registered.client_id,
        client_secret: registered.client_secret,
      }),
    })

    expect(tokenResponse.status).toBe(200)
    const token = await tokenResponse.json()
    expect(token).toMatchObject({
      token_type: 'Bearer',
      expires_in: config.authTokenTtlSeconds,
    })
    expect(token.access_token).toBeTruthy()
  })
})

describe('validateAuth middleware', () => {
  it('rejects tokens that do not contain an expiration', async () => {
    const app = new Hono()
    app.use('/protected', validateAuth)
    app.get('/protected', c => c.json({ userId: c.get('userId') }))

    const now = Math.floor(Date.now() / 1000)
    const tokenWithoutExp = await sign({
      sub: 'user-1',
      aud: config.mcpServerUrl,
      iss: config.mcpServerUrl,
      iat: now,
    }, config.jwtSecret)

    const response = await app.request('/protected', {
      headers: {
        authorization: `Bearer ${tokenWithoutExp}`,
      },
    })

    expect(response.status).toBe(401)
  })

  it('accepts valid non-expired tokens', async () => {
    const app = new Hono()
    app.use('/protected', validateAuth)
    app.get('/protected', c => c.json({ userId: c.get('userId') }))

    const now = Math.floor(Date.now() / 1000)
    const token = await sign({
      sub: 'user-1',
      aud: config.mcpServerUrl,
      iss: config.mcpServerUrl,
      iat: now,
      exp: now + 300,
    }, config.jwtSecret)

    const response = await app.request('/protected', {
      headers: {
        authorization: `Bearer ${token}`,
      },
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ userId: 'user-1' })
  })
})
