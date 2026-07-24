import { beforeAll, describe, expect, it } from 'vitest'
import { app, bootstrap } from '../src/index'

describe('Hono application routing', () => {
  beforeAll(async () => {
    await bootstrap()
  })

  it('serves health checks through the composed app and preserves correlation IDs', async () => {
    const response = await app.request('/health', {
      headers: { 'X-Request-ID': 'test-request-123' },
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('X-Request-ID')).toBe('test-request-123')
    await expect(response.json()).resolves.toMatchObject({ status: 'ok' })
  })

  it('serves discovery metadata with dynamically loaded modules', async () => {
    const response = await app.request('/.well-known/mcp/server-card.json')

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toMatchObject({
      id: 'claude-hub',
      transport: 'streamable-http',
    })
    expect(body.modules).toEqual(expect.arrayContaining(['filesystem', 'github', 'notes']))
  })

  it('runs OAuth client registration and token issuance through the full app', async () => {
    const registerResponse = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        client_name: 'Full App Test Client',
        redirect_uris: ['http://localhost/full-app/callback'],
      }),
    })

    expect(registerResponse.status).toBe(200)
    const registered = await registerResponse.json()

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
    expect(token.access_token).toBeTruthy()
    expect(token.token_type).toBe('Bearer')
  })
})
