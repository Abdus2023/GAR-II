# API Reference — Claude Hub Gateway

This document provides the complete reference for the public `workspace` tool and internal kernel APIs.

---

## 1. The `workspace` Tool (What Claude Sees)

This is the **only tool** exposed to Claude on the Free tier.

### Signature

```ts
workspace(action: string, params?: Record<string, any>)
```

### Available Actions

| Action | Description | Example Params | Returns |
|--------|-------------|----------------|---------|
| `search` | Unified search across all connected sources | `{ query, sources? }` | Search results |
| `memory` | Read/write persistent memory | `{ action: "get\|set\|search", key?, value? }` | Memory entries |
| `files` | Filesystem operations | `{ action: "read\|write\|list\|search", path?, content? }` | File content or list |
| `github` | GitHub operations | `{ action: "search_repo\|read_file\|review_pr\|create_issue", ... }` | GitHub data |
| `workflow` | Run named automation workflows | `{ name, inputs }` | Workflow result / task_id |
| `notes` | Personal knowledge base | `{ action: "create\|search\|get", title?, content? }` | Note objects |
| `admin` | Administrative functions | `{ action: "list_modules\|reload\|metrics" }` | System info |
| `task_status` | Check background task progress | `{ task_id }` | Task status |

### Example Calls

```json
// Search across GitHub + Notion + files
{ "action": "search", "params": { "query": "authentication middleware", "sources": ["github", "notion", "files"] } }

// Review a pull request
{ "action": "github", "params": { "action": "review_pr", "owner": "anthropics", "repo": "claude", "pr_number": 42 } }

// Store something in memory
{ "action": "memory", "params": { "action": "set", "key": "project:auth:stack", "value": "JWT + Better Auth + Turso" } }
```

---

## 2. Internal Kernel API

The kernel exposes these methods to modules and the gateway.

### Core Methods

```ts
class Kernel {
  async invoke(action: string, params: any, ctx: { userId: string }): Promise<any>
  getRegisteredTools(): Tool[]
  getLoadedModules(): Module[]
  on(event: string, handler: Function)
  emit(event: string, data: any)
}
```

### Context Object (injected into every module)

```ts
interface ModuleContext {
  logger: PinoLogger
  events: EventEmitter
  config: ConfigStore
  cache: CacheClient
  invoke: (action: string, params: any) => Promise<any>
}
```

---

## 3. Tool Schema Standard

Every tool must expose a Zod schema. The schema is automatically converted to JSON Schema for Claude.

```ts
{
  id: "github.search_repo",
  description: "...",
  inputSchema: z.object({
    query: z.string().min(1).max(500),
    limit: z.number().int().min(1).max(30).default(10),
  }),
  execute: async (input, ctx) => { ... }
}
```

---

## 4. Error Response Format

All tools must return structured errors:

```json
{
  "success": false,
  "error": "rate_limited",
  "message": "GitHub API rate limit exceeded",
  "retry_after": 1240,
  "suggestion": "Wait before retrying or reduce request frequency"
}
```

---

## 5. Event Types

### Standard Events Emitted by Core Modules

| Event | Payload | Description |
|-------|---------|-------------|
| `tool:executed` | `{ toolId, userId, duration, success }` | Every tool call |
| `github:search_performed` | `{ query, results }` | GitHub search |
| `github:pr_reviewed` | `{ owner, repo, pr_number, findings }` | PR reviewed |
| `memory:updated` | `{ key, userId }` | Memory changed |
| `workflow:started` | `{ workflow, taskId }` | Background workflow |
| `module:loaded` | `{ moduleId }` | Module initialized |

---

## 6. Resource URIs

Resources are read-only context objects.

| URI | Description |
|-----|-------------|
| `workspace://schema` | Full schema of all available actions |
| `github://schema` | GitHub API schema |
| `skills://list` | List of all loaded skills |
| `skills://pr-review` | Full content of the PR review skill |

---

This reference is the contract between Claude and your Hub Gateway. Keep it stable.