import { beforeAll, describe, expect, it } from 'vitest'
import { app, bootstrap } from '../src/index'

async function issueMetricsToken() {
  const registerResponse = await app.request('/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      client_name: 'Metrics Test Client',
      redirect_uris: ['http://localhost/metrics/callback'],
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

describe('metrics route', () => {
  beforeAll(async () => {
    await bootstrap()
  })

  it('requires authentication outside development mode', async () => {
    const response = await app.request('/metrics')

    expect(response.status).toBe(401)
  })

  it('serves Prometheus metrics for authenticated callers', async () => {
    const token = await issueMetricsToken()
    const response = await app.request('/metrics', {
      headers: { authorization: `Bearer ${token}` },
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/plain')
    const body = await response.text()

    expect(body).toContain('# HELP claude_hub_modules_loaded')
    expect(body).toContain('claude_hub_modules_loaded')
    expect(body).toContain('claude_hub_tools_registered')
    expect(body).toContain('claude_hub_tool_calls_total')
    expect(body).toContain('claude_hub_telemetry_pending_spans')
  })
})
