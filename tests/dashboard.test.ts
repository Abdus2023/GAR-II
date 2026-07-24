import { beforeAll, describe, expect, it } from 'vitest'
import { app, bootstrap } from '../src/index'

async function issueDashboardToken() {
  const registerResponse = await app.request('/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      client_name: 'Dashboard Test Client',
      redirect_uris: ['http://localhost/dashboard/callback'],
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

describe('dashboard routes', () => {
  beforeAll(async () => {
    await bootstrap()
  })

  it('requires authentication outside development mode', async () => {
    const response = await app.request('/dashboard/data')

    expect(response.status).toBe(401)
  })

  it('serves dashboard data to authenticated callers', async () => {
    const token = await issueDashboardToken()
    const response = await app.request('/dashboard/data', {
      headers: { authorization: `Bearer ${token}` },
    })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toMatchObject({
      status: 'ok',
      module_count: expect.any(Number),
      tool_count: expect.any(Number),
      registry_version: expect.any(Number),
    })
    expect(body.modules).toEqual(expect.arrayContaining(['filesystem', 'github']))
    expect(body.tools.map((tool: any) => tool.id)).toEqual(expect.arrayContaining(['github.review_pr']))
  })

  it('serves the HTML dashboard to authenticated callers', async () => {
    const token = await issueDashboardToken()
    const response = await app.request('/dashboard', {
      headers: { authorization: `Bearer ${token}` },
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/html')
    const html = await response.text()
    expect(html).toContain('Claude Hub Gateway Dashboard')
    expect(html).toContain('Registered Tools')
  })
})
