import { describe, expect, it, beforeAll } from 'vitest'
import { app, bootstrap } from '../src/index'

async function issueTestToken() {
  const registerResponse = await app.request('/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      client_name: 'API Workflow Test Client',
      redirect_uris: ['http://localhost/api-workflow/callback'],
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

describe('API workflow endpoints', () => {
  beforeAll(async () => {
    await bootstrap()
  })

  it('lists loaded modules for authenticated callers', async () => {
    const token = await issueTestToken()
    const response = await app.request('/api/modules', {
      headers: { authorization: `Bearer ${token}` },
    })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.modules).toEqual(expect.arrayContaining(['filesystem', 'github', 'notes']))
    expect(body.tools.map((tool: any) => tool.id)).toEqual(expect.arrayContaining(['github.review_pr']))
  })

  it('runs an ad-hoc workflow definition over HTTP', async () => {
    const token = await issueTestToken()
    const response = await app.request('/api/workflows/run', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        workflow: {
          id: 'echo_workflow_api_test',
          name: 'Echo Workflow API Test',
          description: 'Runs a single echo tool step',
          steps: [
            {
              id: 'echo',
              tool: 'echo',
              input: { message: 'Hello {{name}}' },
            },
          ],
        },
        inputs: { name: 'Arena' },
      }),
    })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toMatchObject({ success: true })
    expect(body.results.echo).toMatchObject({ message: 'Echo: Hello Arena' })
  })
})
