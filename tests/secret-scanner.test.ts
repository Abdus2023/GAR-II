import { describe, expect, it } from 'vitest'
import { scanForSecrets } from '../src/security/secret-scanner'

describe('scanForSecrets', () => {
  it('detects regex-known secrets without leaking regex state between calls', () => {
    const content = 'const token = "ghp_abcdefghijklmnopqrstuvwxyzABCDEFGHIJ"'

    expect(scanForSecrets(content)).toMatchObject({
      blocked: true,
      pattern: 'GitHub Personal Access Token',
    })
    expect(scanForSecrets(content)).toMatchObject({
      blocked: true,
      pattern: 'GitHub Personal Access Token',
    })
  })

  it('detects AST-assigned hardcoded secrets that generic regexes miss', () => {
    const content = `
      export const config = {
        clientSecret: "super-secret-value",
      }
    `

    const result = scanForSecrets(content)

    expect(result.blocked).toBe(true)
    expect(result.pattern).toContain('clientSecret')
  })

  it('allows environment-variable based secret references', () => {
    const content = `
      export const config = {
        clientSecret: process.env.CLIENT_SECRET,
        token: process.env.ACCESS_TOKEN,
      }
    `

    expect(scanForSecrets(content)).toEqual({ blocked: false })
  })
})
