# Claude Hub Gateway (GAR-II) — Comprehensive Traceability Documentation v10

**Date**: 2026-07-24  
**Status**: Stabilized prototype / active hardening  
**Current validation snapshot**: `npm run build`, `npm run build:sdk`, and `npm test` pass locally.  
**Automated tests**: 29 test files, 65 tests passing.  
**Previous target-state docs**: v8/v9 remain useful architecture references, but v10 is the current implementation traceability source.

---

## 1. Executive Summary

GAR-II has progressed from a non-compiling prototype into a working, tested gateway foundation. The runtime now starts, serves MCP over Streamable HTTP, loads modules dynamically, executes tools through a kernel, records audit logs asynchronously, exposes HTTP/CLI workflow automation, and includes an operational dashboard, metrics, migrations, and CI.

It is **not yet fully production-ready for untrusted multi-tenant use**. The largest remaining blockers are sandboxing untrusted modules, operationalizing signed-module enforcement, Cloudflare Workers deployment validation, and completing some external integration depth such as calendar OAuth refresh flows and browser automation for JavaScript-rendered pages.

---

## 2. Maturity Classification

| Dimension | Current State | Notes |
|---|---|---|
| Build health | Stable | `npm run build` passes. ESM post-build specifier fix is required. |
| Runtime health | Stable local Node runtime | `npm start` starts `dist/src/node.js`. |
| MCP compatibility | Validated | Official MCP SDK client e2e test passes over Streamable HTTP. |
| Tests | Strong prototype coverage | 29 files / 65 tests. No coverage thresholds yet. |
| Module loading | Implemented | Dynamic trusted local module discovery and registration. |
| External integrations | Partial/functional | GitHub, filesystem, notes, search, browser fetch, calendar bearer-token REST. |
| Security | Hardened prototype | OAuth, JWT checks, secret scanning, confirmation gates, module signing support. |
| Production isolation | Incomplete | No VM/worker sandbox for untrusted code yet. |
| Observability | Good prototype | Pino, correlation IDs, audit queue, dashboard, metrics, OTLP trace exporter. |
| Release ecosystem | Started | SDK package structure exists; CI/release workflow files are pending repository workflow permission. |

---

## 3. Source-of-Truth Entry Points

| Area | Source |
|---|---|
| Application bootstrap | `src/index.ts`, `src/node.ts` |
| MCP server | `src/mcp/server.ts` |
| Kernel and module loading | `src/kernel/index.ts`, `src/kernel/types.ts` |
| Auth | `src/auth/router.ts`, `src/auth/middleware.ts` |
| Database schema/migrations | `src/database/schema.ts`, `src/database/migrations.ts`, `drizzle/0001_initial_schema.sql` |
| Capability modules | `modules/*` |
| Workflow engine | `src/workflow/index.ts`, `src/planner/executor.ts` |
| Security controls | `src/security/*`, `src/middleware/*` |
| CLI | `packages/cli/src/index.ts` |
| SDK | `packages/sdk/src/index.ts`, `packages/sdk/src/plugin.ts` |
| Tests | `tests/*` |
| CI/release | Pending repository workflow permission; use `npm run build`, `npm run build:sdk`, `npm test` locally |

---

## 4. Implementation Traceability Matrix

### 4.1 Adapter and Protocol Layer

| Requirement | Implementation | Status | Evidence |
|---|---|---|---|
| Single MCP connector surface | Unified `workspace` tool plus `_search_tools` | Implemented | `src/mcp/server.ts`, `tests/mcp-e2e.test.ts` |
| Streamable HTTP transport | Web-standard MCP transport with session map | Implemented | `src/mcp/server.ts` |
| MCP session continuity | Session ID mapped to server/transport pair | Implemented | `tests/mcp-e2e.test.ts` |
| MCP session lifecycle | TTL/capacity bounded session store | Implemented | `src/mcp/session-store.ts`, `tests/mcp-session-store.test.ts` |
| Authenticated MCP requests | Hono middleware validates bearer token/dev bypass | Implemented | `src/auth/middleware.ts` |
| Request user available inside MCP callbacks | Async request context | Implemented | `src/request-context.ts`, `tests/request-context.test.ts` |
| MCP schema/resource exposure | `workspace://schema`, `skills://list`, `skills://{name}` | Implemented | `src/mcp/server.ts` |

### 4.2 Kernel and Capability Runtime

| Requirement | Implementation | Status | Evidence |
|---|---|---|---|
| Built-in tools | `echo`, `memory.get`, `memory.set`, `memory.search` | Implemented | `src/kernel/index.ts` |
| Dynamic module loading | Scans `modules/` or `dist/modules/` | Implemented | `src/kernel/index.ts`, `tests/kernel-modules.test.ts` |
| Namespaced tools | `module.tool` IDs | Implemented | `src/kernel/index.ts` |
| Module dependencies | Built-in and module dependency checks | Implemented | `src/kernel/index.ts` |
| Tool input validation | Zod `safeParse` before execute | Implemented | `src/kernel/index.ts` |
| Structured errors | `GatewayError` and serializer | Implemented | `src/errors.ts` |
| Direct tool timeout | Kernel-level timeout | Implemented | `src/kernel/index.ts`, `tests/kernel-timeout.test.ts` |
| Async audit logging | Non-blocking queue and flush | Implemented | `src/kernel/index.ts` |
| Lifecycle hooks | `beforeInvoke`, `afterInvoke`, `onInvokeError` | Implemented | `src/kernel/index.ts`, `tests/kernel-hooks.test.ts` |
| Confirmation gate | `confirm: true` for high-impact actions | Implemented | `tests/kernel-confirmation.test.ts` |
| Registry metadata | Tool category/cost/module/confirmation metadata | Implemented | `src/kernel/index.ts` |

### 4.3 Capability Modules

| Module | Tools | Status | Evidence |
|---|---|---|---|
| `echo` | `echo.echo` | Implemented | `modules/echo/index.ts` |
| built-in memory | `memory.get`, `memory.set`, `memory.search` | Implemented | `src/kernel/index.ts` |
| `filesystem` | read/write/list/search | Implemented | `modules/filesystem/src/index.ts`, `tests/filesystem-module.test.ts` |
| `github` | search repo, read file, review PR, create issue | Implemented | `modules/github/src/index.ts`, `tests/github-module.test.ts` |
| `notes` | create/get/search/list | Implemented | `modules/notes/src/index.ts` |
| `search` | memory/notes search | Implemented | `modules/search/src/index.ts` |
| `browser` | fetch page, extract simple selectors | Functional non-Playwright implementation | `modules/browser/src/index.ts`, `tests/browser-module.test.ts` |
| `calendar` | list events, create event | Functional with Google bearer token | `modules/calendar/src/index.ts`, `tests/calendar-module.test.ts` |

### 4.4 Authentication and Authorization

| Requirement | Implementation | Status | Evidence |
|---|---|---|---|
| Dynamic client registration | Stores clients in DB | Implemented | `src/auth/router.ts`, `tests/auth.test.ts` |
| Client secret protection | SHA-256 hash + timing-safe compare | Implemented | `src/auth/router.ts` |
| Token endpoint | Client credentials + partial auth code support | Implemented | `src/auth/router.ts` |
| JWT checks | Audience, subject, expiration, nbf, iat | Implemented | `src/auth/middleware.ts` |
| Dev auth bypass | Development-only and warning logged once | Implemented | `src/auth/middleware.ts` |
| Confirmation authorization | Kernel-level `AUTHORIZATION_ERROR` | Implemented | `tests/kernel-confirmation.test.ts` |

### 4.5 Database and Persistence

| Requirement | Implementation | Status | Evidence |
|---|---|---|---|
| libSQL/SQLite client | Drizzle + `@libsql/client` | Implemented | `src/database/index.ts` |
| Schema | memory, tool_calls, oauth_clients, auth_codes, notes | Implemented | `src/database/schema.ts` |
| Runtime migrations | `schema_migrations` table and checksum validation | Implemented | `src/database/migrations.ts` |
| Migration CLI | `npm run db:migrate` | Implemented | `src/database/migrate.ts` |
| Drizzle generation config | `drizzle.config.ts` | Implemented | `drizzle.config.ts` |
| Migration tests | Idempotency + checksum mismatch | Implemented | `tests/database-migrations.test.ts` |

### 4.6 Memory and Retrieval

| Requirement | Implementation | Status | Evidence |
|---|---|---|---|
| L2 memory | SQLite/libSQL memory table | Implemented | `src/kernel/index.ts`, `src/database/schema.ts` |
| L3 semantic memory | LanceDB table | Implemented | `src/memory/semantic.ts` |
| Embeddings | Local hashing provider + optional API provider | Implemented | `src/memory/semantic.ts`, `tests/semantic.test.ts` |
| Embedding cache | LRU-style cache | Implemented | `src/memory/semantic.ts` |
| LanceDB file locking | Atomic directory lock | Implemented | `src/memory/file-lock.ts`, `tests/file-lock.test.ts` |
| Memory-to-semantic feed | `memory.set` submits to semantic memory best-effort | Implemented | `src/kernel/index.ts` |

### 4.7 Workflow and Planning

| Requirement | Implementation | Status | Evidence |
|---|---|---|---|
| Planner skeleton | Basic plan creation | Implemented skeleton | `src/planner/index.ts` |
| DAG executor | Dependency validation, parallel ready nodes, timeouts | Implemented | `src/planner/executor.ts`, `tests/executor.test.ts` |
| Workflow registry | Built-in workflows | Implemented | `src/workflow/index.ts` |
| Ad-hoc workflow execution | HTTP API workflow definition support | Implemented | `src/routes/api.ts`, `tests/api-workflow.test.ts` |
| CLI workflow runner | Runs workflow files or registered workflow IDs | Implemented | `packages/cli/src/index.ts` |

### 4.8 Security Controls

| Requirement | Implementation | Status | Evidence |
|---|---|---|---|
| Secret scanning | Regex + AST-assisted JavaScript/TypeScript scanning | Implemented | `src/security/secret-scanner.ts`, `tests/secret-scanner.test.ts` |
| Kernel-level write scanning | Before-invoke hook | Implemented | `src/kernel/index.ts`, `tests/kernel-hooks.test.ts` |
| Body-size limits | Content-Length guard for API routes | Implemented | `src/middleware/body-size-limit.ts`, `tests/workspace-fuzz.test.ts` |
| Rate limiting | Memory store + optional Upstash Redis store | Implemented | `src/middleware/rate-limit.ts`, `tests/rate-limit.test.ts` |
| Filesystem isolation | Workspace path resolution and traversal block | Implemented | `modules/filesystem/src/index.ts` |
| Module signing verification | Ed25519 signature sidecar validation | Implemented optional | `src/security/module-signing.ts`, `tests/module-signing.test.ts` |
| Module signing CLI | `npm run module:sign` | Implemented | `src/security/sign-module.ts`, `tests/sign-module-cli.test.ts` |
| Untrusted code sandboxing | Not implemented | Open | Future worker/VM isolation |

### 4.9 Observability and Operations

| Requirement | Implementation | Status | Evidence |
|---|---|---|---|
| Structured logging | Pino with redaction | Implemented | `src/logger.ts` |
| Request correlation IDs | `X-Request-ID` middleware | Implemented | `src/middleware/correlation-id.ts` |
| Health endpoints | `/health`, `/health/ready`, `/health/diagnostics` | Implemented | `src/routes/health.ts` |
| Dashboard | Protected HTML + JSON dashboard | Implemented | `src/routes/dashboard.ts`, `tests/dashboard.test.ts` |
| Prometheus metrics | Protected `/metrics` endpoint | Implemented | `src/routes/metrics.ts`, `tests/metrics.test.ts` |
| OTLP traces | Lightweight OTLP/HTTP exporter | Implemented optional | `src/telemetry/index.ts`, `tests/telemetry.test.ts` |
| CI | Build/test workflow | Pending workflow permission | Local commands: `npm run build`, `npm test` |
| Release workflow | Tag-triggered release + SDK pack | Pending workflow permission | SDK can be packed with `npm pack ./packages/sdk` |

### 4.10 Developer Ecosystem

| Requirement | Implementation | Status | Evidence |
|---|---|---|---|
| CLI | Module listing and workflow runner | Implemented | `packages/cli/src/index.ts` |
| SDK package structure | ESM exports, types, build script | Implemented | `packages/sdk/package.json`, `packages/sdk/tsconfig.json` |
| SDK types | Plugin, ToolDefinition, PluginRegistry | Implemented | `packages/sdk/src/plugin.ts` |
| SDK tests | Registry and duplicate validation | Implemented | `tests/sdk.test.ts` |
| Example workflow | Echo workflow JSON | Implemented | `examples/workflows/echo.json` |

---

## 5. Runtime Surface Traceability

| Endpoint | Auth | Purpose | Implementation |
|---|---|---|---|
| `/mcp` | Bearer/dev | MCP Streamable HTTP | `src/mcp/server.ts` |
| `/auth/register` | Public | OAuth dynamic client registration | `src/auth/router.ts` |
| `/auth/token` | Client credentials | JWT issuance | `src/auth/router.ts` |
| `/health` | Public | Liveness | `src/routes/health.ts` |
| `/health/ready` | Public | Readiness | `src/routes/health.ts` |
| `/health/diagnostics` | Public | Diagnostics | `src/routes/health.ts` |
| `/.well-known/mcp/server-card.json` | Public | MCP server card | `src/routes/discovery.ts` |
| `/.well-known/oauth-protected-resource` | Public | OAuth resource metadata | `src/routes/discovery.ts` |
| `/api/modules` | Bearer/dev | Module/tool registry JSON | `src/routes/api.ts` |
| `/api/workspace` | Bearer/dev | HTTP workspace invoke | `src/routes/api.ts` |
| `/api/workflows` | Bearer/dev | Workflow list | `src/routes/api.ts` |
| `/api/workflows/run` | Bearer/dev | Workflow execution | `src/routes/api.ts` |
| `/dashboard` | Bearer/dev | Runtime HTML dashboard | `src/routes/dashboard.ts` |
| `/dashboard/data` | Bearer/dev | Dashboard JSON | `src/routes/dashboard.ts` |
| `/metrics` | Bearer/dev | Prometheus metrics | `src/routes/metrics.ts` |

---

## 6. Test Traceability

| Test File | Purpose |
|---|---|
| `tests/app-routing.test.ts` | Composed app routing, discovery, OAuth flow |
| `tests/api-workflow.test.ts` | HTTP workflow APIs |
| `tests/auth.test.ts` | OAuth registration/token and JWT middleware |
| `tests/browser-module.test.ts` | Browser page fetch and extraction |
| `tests/budget.test.ts` | Context budget tool ranking |
| `tests/calendar-module.test.ts` | Google Calendar client/module behavior |
| `tests/dashboard.test.ts` | Dashboard auth/data/HTML |
| `tests/database-migrations.test.ts` | Migration idempotency and checksum safety |
| `tests/executor.test.ts` | DAG executor behavior |
| `tests/file-lock.test.ts` | Cross-process lock semantics |
| `tests/filesystem-module.test.ts` | Filesystem isolation and writes |
| `tests/github-module.test.ts` | GitHub search/read/issue behavior |
| `tests/kernel-confirmation.test.ts` | Confirmation gate |
| `tests/kernel-hooks.test.ts` | Kernel hook lifecycle and secret hook |
| `tests/kernel-modules.test.ts` | Dynamic module loader |
| `tests/kernel-timeout.test.ts` | Direct tool timeout |
| `tests/mcp-e2e.test.ts` | Official MCP SDK client e2e |
| `tests/mcp-session-store.test.ts` | MCP session TTL/capacity lifecycle |
| `tests/metrics.test.ts` | Prometheus metrics endpoint |
| `tests/module-signing.test.ts` | Signature verification |
| `tests/planner.test.ts` | Planner skeleton |
| `tests/rate-limit.test.ts` | Rate limiter behavior |
| `tests/request-context.test.ts` | Async request context |
| `tests/sdk.test.ts` | SDK registry |
| `tests/secret-scanner.test.ts` | Regex + AST scanner |
| `tests/semantic.test.ts` | Embeddings/cache |
| `tests/sign-module-cli.test.ts` | Module signing tool |
| `tests/telemetry.test.ts` | OTLP trace exporter |
| `tests/workspace-fuzz.test.ts` | Malformed/oversized payload handling |

> Run `npm test` for the exact current count. At this update: 29 files / 65 tests passing.

---

## 7. Configuration Traceability

| Config | Purpose | Default |
|---|---|---|
| `NODE_ENV` | Runtime mode | `development` |
| `PORT` | Node server port | `3000` |
| `TURSO_DATABASE_URL` | libSQL URL | `file:local.db` |
| `TURSO_AUTH_TOKEN` | Turso token | unset |
| `JWT_SECRET` | JWT signing secret | `dev-secret` in development; rejected in production |
| `MCP_SERVER_URL` | Public issuer/audience URL | `http://localhost:3000` |
| `GITHUB_TOKEN` | GitHub API token | unset |
| `WORKSPACE_DIR` | Filesystem module root | `./workspace` |
| `EXECUTOR_NODE_TIMEOUT_MS` | DAG node timeout | `30000` |
| `KERNEL_TOOL_TIMEOUT_MS` | Direct tool timeout | `30000` |
| `RATE_LIMIT_WINDOW_MS` | Rate-limit window | `60000` |
| `RATE_LIMIT_MAX_REQUESTS` | Rate-limit max | `60` |
| `UPSTASH_REDIS_URL` | Optional Redis REST URL | unset |
| `UPSTASH_REDIS_TOKEN` | Optional Redis token | unset |
| `MAX_JSON_BODY_BYTES` | API body size limit | `1048576` |
| `MCP_SESSION_TTL_MS` | MCP session idle TTL | `1800000` |
| `MCP_MAX_SESSIONS` | Maximum retained MCP sessions | `1000` |
| `MODULE_SIGNATURE_MODE` | off/warn/enforce | `off` |
| `MODULE_SIGNATURE_PUBLIC_KEYS` | Trusted public keys | unset |
| `OTEL_ENABLED` | Enable OTLP export | `false` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OTLP endpoint base URL | unset |
| `EMBEDDING_PROVIDER` | `hash` or `api` | `hash` |
| `EMBEDDING_API_URL` | Optional embedding API URL | unset |
| `LANCEDB_PATH` | LanceDB storage path | `./data/lancedb` |
| `LANCEDB_LOCK_TIMEOUT_MS` | LanceDB lock acquire timeout | `5000` |
| `BROWSER_FETCH_TIMEOUT_MS` | Browser fetch timeout | `15000` |
| `GOOGLE_CALENDAR_ACCESS_TOKEN` | Google Calendar token | unset |

See `.env.example` for the full list.

---

## 8. Open Production Risks

| Risk | Status | Required Work |
|---|---|---|
| Untrusted code execution | Open | Worker/VM sandboxing for third-party modules. |
| Module signing operationalization | Partial | Sign deployment modules, configure trusted keys, enforce in production. |
| Cloudflare Workers deployment | Needs validation | Confirm Node APIs, LanceDB path, and adapters in Workers. |
| Browser JS rendering | Partial | Optional Playwright/browserless renderer for dynamic pages. |
| Calendar OAuth lifecycle | Partial | Refresh token/consent flow beyond bearer-token env config. |
| Enterprise RBAC/policy | Open | Role/policy model and per-action authorization. |
| Distributed audit queue | Partial | Current queue is in-process; external queue recommended for scale. |
| LanceDB multi-instance semantics | Partial | File lock helps local multiprocess; distributed vector store needed for horizontal cloud. |

---

## 9. Phase Status

| Phase | Name | Current Status |
|---|---|---|
| 1 | Stabilization | Mostly complete |
| 2 | Capability loading and auth | Mostly complete |
| 3 | Capability expansion | Partially complete |
| 4 | Scale and observability | Partially complete |
| 5 | Production hardening and SDK ecosystem | Started |

---

## 10. Recommended Next Updates

1. Add sandboxed execution for untrusted modules.
2. Enforce module signatures in a production deployment profile.
3. Validate Cloudflare Workers deployment with the current Node adapter and dependencies.
4. Add OpenTelemetry metrics/log correlation and sampling controls.
5. Add richer GitHub write operations behind confirmation gates.
6. Add Playwright/browserless optional rendering.
7. Add Google OAuth refresh-token support for calendar.
8. Add coverage thresholds and test coverage reporting.

---

## 11. Compatibility Notes for Historical Traceability Docs

- `COMPREHENSIVE_TRACEABILITY_v6.md` and `v7.md` are historical snapshots.
- `COMPREHENSIVE_TRACEABILITY_v8.md` and `v9.md` contain target-state architecture and wiki material.
- This v10 document is the current implementation traceability baseline and should be updated with future code changes.
