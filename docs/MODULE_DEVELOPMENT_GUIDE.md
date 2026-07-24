# Module Development Guide — Claude Hub Gateway

This guide explains exactly how to create a new capability module for the Claude Hub Gateway.

---

## 1. Module Philosophy

Every module should follow these principles:

- **Single responsibility** — One module = one external system or domain
- **Self-describing** — Manifest contains everything the kernel needs
- **Independently testable** — No hard dependencies on other modules
- **Event-driven** — Communicate via the Event Bus, never direct imports
- **Least privilege** — Declare only the permissions you actually need

---

## 2. Module Folder Structure

```
modules/<module-name>/
├── manifest.yaml          # Required — kernel reads this first
├── src/
│   ├── index.ts           # Implements the Module interface
│   ├── client.ts          # External API client (optional)
│   └── tools/             # One file per tool (recommended)
│       ├── search.ts
│       ├── read.ts
│       └── write.ts
├── prompts/               # Reusable prompt templates
│   └── review.md
├── resources/             # Read-only context objects
│   └── schema.json
├── tests/
│   └── tools.test.ts
├── package.json
└── README.md
```

---

## 3. The Manifest (`manifest.yaml`)

This is the single source of truth for the kernel.

```yaml
id: github
kind: connector
version: 2.1.0
author: "Your Name"
category: developer
description: "GitHub repository, PR, and issue operations"

permissions:
  - github.read
  - github.write

dependencies:
  - auth
  - cache

tools:
  - id: search_repo
    description: Search GitHub repositories by keyword or topic
    input:
      query: { type: string, minLength: 1, maxLength: 500 }
      limit: { type: number, minimum: 1, maximum: 30, default: 10 }
    output:
      total: number
      repositories: array
    cost: low
    latency: medium
    example: { query: "typescript http framework", limit: 5 }

  - id: review_pr
    description: Fetch PR metadata and diff for code review
    requires_confirmation: false
    permissions: [github.read]

events:
  emits:
    - pull_request.created
    - issue.updated
  listens:
    - workspace.sync

prompts:
  - review_pr
  - summarize_diff

resources:
  - github_api_schema
```

---

## 4. The Module Interface (`src/index.ts`)

```typescript
import { z } from 'zod'
import type { Module, ModuleContext, Tool } from '../../packages/kernel/types'

export default class GitHubModule implements Module {
  private ctx!: ModuleContext
  private octokit: any

  manifest() {
    return {
      id: 'github',
      version: '2.1.0',
      permissions: ['github.read', 'github.write'],
      dependencies: ['auth', 'cache'],
    }
  }

  async initialize(ctx: ModuleContext) {
    this.ctx = ctx
    const token = ctx.config.get('GITHUB_TOKEN')
    if (!token) throw new Error('GITHUB_TOKEN required')

    // Initialize Octokit or any client
    this.octokit = new (await import('octokit')).Octokit({ auth: token })
    ctx.logger.info('GitHub module initialized')
  }

  tools(): Tool[] {
    return [
      {
        id: 'search_repo',
        description: 'Search GitHub repositories',
        inputSchema: z.object({
          query: z.string().min(1).max(500),
          limit: z.number().int().min(1).max(30).default(10),
        }),
        execute: this.searchRepo.bind(this),
      },
      // ... more tools
    ]
  }

  resources() {
    return [{
      id: 'github_api_schema',
      uri: 'github://schema',
      description: 'GitHub REST API schema',
    }]
  }

  prompts() {
    return [{
      id: 'review_pr',
      description: 'Code review prompt template',
      template: `Review this PR for security, logic, and style issues...`,
    }]
  }

  async shutdown() {
    this.ctx.logger.info('GitHub module shutting down')
  }

  // Tool implementations
  private async searchRepo(input: any, ctx: any) {
    // Implementation here
    // Always validate, handle errors gracefully, emit events
    this.ctx.events.emit('github:search_performed', { query: input.query })
    return { total: 42, repositories: [...] }
  }
}
```

---

## 5. Error Handling Standard

Every tool **must** return structured errors. Never throw raw exceptions to Claude.

```typescript
try {
  const result = await this.octokit.rest.search.repos({ q: input.query })
  return { success: true, ...result }
} catch (error) {
  if (error.status === 404) {
    return {
      success: false,
      error: 'not_found',
      message: 'Repository not found',
      suggestion: 'Check the owner and repo name',
    }
  }
  if (error.status === 429) {
    return {
      success: false,
      error: 'rate_limited',
      retry_after: error.headers['x-ratelimit-reset'],
    }
  }
  
  this.ctx.logger.error({ error, input }, 'Unexpected GitHub error')
  return {
    success: false,
    error: 'internal_error',
    message: 'GitHub operation failed. Please try again.',
  }
}
```

---

## 6. Testing Pattern

```typescript
// modules/github/tests/search.test.ts
import { describe, it, expect, mock, beforeEach } from 'bun:test'
import GitHubModule from '../index'

describe('GitHubModule', () => {
  let module: GitHubModule
  let mockOctokit: any

  beforeEach(() => {
    mockOctokit = {
      rest: {
        search: {
          repos: mock(() => Promise.resolve({
            data: { total_count: 5, items: [...] }
          }))
        }
      }
    }
    module = new GitHubModule()
    // @ts-ignore - test injection
    module['octokit'] = mockOctokit
  })

  it('returns formatted results', async () => {
    const result = await module['searchRepo']({ query: 'bun', limit: 5 }, {})
    expect(result.success).toBe(true)
    expect(result.repositories).toHaveLength(5)
  })

  it('handles rate limits gracefully', async () => {
    mockOctokit.rest.search.repos.mockRejectedValueOnce({ status: 429 })
    const result = await module['searchRepo']({ query: 'test' }, {})
    expect(result.error).toBe('rate_limited')
  })
})
```

---

## 7. Event Emission Guidelines

```typescript
// Good — loose coupling
this.ctx.events.emit('github:pr_reviewed', {
  owner,
  repo,
  pr_number,
  findings_count: 3,
})

// Bad — direct module-to-module call
// import { notificationModule } from '../notification'
// notificationModule.send(...)
```

---

## 8. Checklist Before Submitting a Module

- [ ] `manifest.yaml` is valid and complete
- [ ] All tools use Zod schemas
- [ ] Every tool returns structured `{ success, ... }` or `{ success: false, error, message }`
- [ ] Errors are never raw stack traces
- [ ] Events are emitted for important actions
- [ ] Tests cover happy path + error paths
- [ ] README documents required environment variables
- [ ] Permissions declared match actual usage
- [ ] No hardcoded secrets or tokens

---

## 9. Common Pitfalls

| Pitfall | Correct Approach |
|---------|------------------|
| Returning raw Octokit response | Extract only what Claude needs |
| Hardcoding `GITHUB_TOKEN` in code | Read from `ctx.config.get()` |
| Direct import of another module | Emit events instead |
| Throwing errors to Claude | Return structured error objects |
| No pagination on list tools | Always implement `page` + `limit` |
| Missing idempotency on write tools | Check for existing records first |

---

**Next step after creating a module**: Add it to the `modules/` directory. The kernel will automatically discover and load it on next startup.