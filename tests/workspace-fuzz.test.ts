import { beforeAll, describe, expect, it } from 'vitest'
import { app, bootstrap } from '../src/index'

async function issueFuzzToken() {
  const registerResponse = await app.request('/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      client_name: 'Workspace Fuzz Test Client',
      redirect_uris: ['http://localhost/workspace-fuzz/callback'],
    }),
  })
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
  const token = await tokenResponse.json()
  return token.access_token as string
}

describe('workspace payload fuzzing', () => {
  let token: string

  beforeAll(async () => {
    await bootstrap()
    token = await issueFuzzToken()
  })

  it('rejects malformed or schema-invalid JSON payloads without 500s', async () => {
    const cases = [
      { label: 'malformed-json', body: '{', expectedStatus: 400 },
      { label: 'empty-object', body: '{}', expectedStatus: 400 },
      { label: 'array-root', body: '[]', expectedStatus: 400 },
      { label: 'null-root', body: 'null', expectedStatus: 400 },
      { label: 'wrong-action-type', body: JSON.stringify({ action: 42, params: {} }), expectedStatus: 400 },
      { label: 'wrong-params-type', body: JSON.stringify({ action: 'echo', params: 'not-object' }), expectedStatus: 400 },
      { label: 'unknown-action', body: JSON.stringify({ action: 'does.not.exist', params: {} }), expectedStatus: 404 },
    ]

    for (const testCase of cases) {
      const response = await app.request('/api/workspace', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: testCase.body,
      })

      expect(response.status, testCase.label).toBe(testCase.expectedStatus)
      expect(response.status, testCase.label).not.toBe(500)
    }
  })

  it('rejects oversized workspace payloads before parsing', async () => {
    const response = await app.request('/api/workspace', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': String(2_000_000),
      },
      body: JSON.stringify({ action: 'echo', params: { message: 'too large by header' } }),
    })

    expect(response.status).toBe(413)
    await expect(response.json()).resolves.toMatchObject({
      error: 'payload_too_large',
      max_bytes: 1_048_576,
    })
  })

  it('still accepts valid workspace payloads', async () => {
    const response = await app.request('/api/workspace', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ action: 'echo', params: { message: 'fuzz-ok' } }),
    })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toMatchObject({
      success: true,
      result: {
        success: true,
        message: 'Echo: fuzz-ok',
      },
    })
  })
})
