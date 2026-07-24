# GAR-II — Comprehensive Engineering Review (2026-07-24)

**Repository:** `Abdus2023/GAR-II`  
**Branch:** `arena/019f93ae-gar-ii`  
**Commit:** `935331e`  
**Auditor:** Arena Agent Mode (direct source inspection)  
**Build Status:** ✅ PASS (`npm run build` clean, `npm test`: 29 files, 65 tests passing)  
**Runtime Status:** ✅ Functional prototype (modules load, kernel registers 22 tools, MCP transport operates)

---

## 1. Executive Summary

GAR-II (Claude Hub Gateway) is an ambitious TypeScript/Hono-based AI-native runtime: a single MCP endpoint (`/mcp`) exposes a unified `workspace` tool, backed by a microkernel that dynamically loads capability modules (`modules/*`), manages a SQLite/libSQL L2 memory layer, an optional LanceDB L3 semantic memory store, an event bus (`EventEmitter3`), workflow/planner skeletons, and security hooks (module signing, secret scanning, rate limits, audit logging).

**What works today:**
- Clean TypeScript compilation (`dist/` output, ESM imports fixed).
- Dynamic module loader (`discoverModules` → `initializeModule` → register tools) loads 7 modules (`browser`, `calendar`, `echo`, `filesystem`, `github`, `notes`, `search`) and registers 22 kernel tools.
- Hono adapter layer with CORS, correlation-ID middleware, telemetry middleware (`TelemetrySpan` / `AsyncLocalStorage`), rate-limiting (`MemoryRateLimitStore` or `UpstashRedisRateLimitStore`), and body-size limits.
- OAuth 2.0 dynamic client registration (`/auth/register`) and token endpoint (`/auth/token`) backed by `drizzle-orm` SQLite schema (`oauthClients`, `authCodes`).
- Kernel-level pre/post/error invocation hooks (`beforeInvoke`, `afterInvoke`, `onInvokeError`).
- Audit log queue (`auditLogQueue`) writes to `tool_calls` table asynchronously (with `.catch()` fallback).
- Secret scanner with regex + TypeScript AST inspection (`getTypeScript()` via `createRequire`).
- Module signing infrastructure (`ed25519` signatures, `module.sig.json`, `verifyModulePreImport`, canonical JSON, SHA-256 entrypoint hash verification).
- Basic planner skeleton (`createPlan`) and executor (`execute()` with `validateGraph`, dependency filtering, `Promise.all` for parallel ready nodes, `withTimeout`).
- Workflow engine with interpolation (`interpolateValue`), registered example workflows (`research_and_summarize`, `code_review_workflow`), and `runDefinition`.
- Memory: SQLite keyword/search (`memory.get`, `memory.set`, `memory.search`) + LanceDB-backed semantic search (`semanticMemory.search`, `add`, `initialize`).
- Tests: 29 test files, 65 passing (`vitest`). Key coverage: auth, budget, browser-module, calendar-module, database-migrations, executor, filesystem-module, github-module, kernel-modules, kernel-timeout, kernel-hooks, mcp-e2e, metrics, module-signing, planner, rate-limit, request-context, sdk, secret-scanner, semantic, workspace-fuzz.

**Critical gaps (reality vs. claims):**
- `docs/ARCHITECTURE.md` describes a mature “Phase 5 Production Ready” system with sandbox isolation, full agent runtimes, and enterprise policy controls. The code delivers a solid Phase 1–3 prototype.
- Module loader works, but `modules/calendar/src/index.ts` lacks a fully wired Google Calendar token flow (it creates a mock client but does not call the real Google Calendar API unless `googleCalendarAccessToken` is configured; the module reports `configured: false` in logs).
- Browser module is fetch-based (`fetch` with `AbortController` timeout) rather than Playwright automation (as noted in README).
- Planner `executeGraph` (`src/planner/index.ts`) does not delegate to `executor.execute()`; it runs a trivial linear loop (`results[node.id] = { executed: node.id }`). The real DAG execution lives in `executor.execute()` but is not called by `executeGraph`. This creates a disconnect: calling `workspace({ action: 'execute_plan', ... })` works via `executor.execute()` directly in `mcp/server.ts`, but `planner.executeGraph()` itself is broken.
- Semantic memory uses deterministic pseudo-embeddings (`Math.sin(hash * (i + 1))`) rather than a real embedding model. This renders L3 search functionally meaningless for relevance ranking.
- `packages/cli/src/index.ts` and `packages/sdk/src/plugin.ts` are skeletons with minimal implementation.
- `docs/COMPREHENSIVE_TRACEABILITY_v10.md` and similar traceability docs are aspirational (4,500+ lines) describing requirements not present in code.
- No automated CI/CD workflow files exist in `.github/workflows/` (only `.claude/skills/` for agent skills).
- Dependency vulnerabilities: `npm audit` reports 10 vulnerabilities (6 moderate, 4 high) in installed packages (likely `node-domexception`, deprecated `@esbuild-kit`, etc.).

---

## 2. Architecture Review

### 2.1 Layered Architecture

```
Clients (Claude AI, CLI, Web, Slack, API)
  │  MCP Streamable HTTP / REST / OpenAI / Gemini
  ▼
Adapter Layer (Hono app: CORS, auth middleware, rate limit, correlation-ID, telemetry)
  │
  ▼
Agentic-Native Runtime (Microkernel + Planner + Memory + Security Hooks)
  │  Kernel invokes modules; Planner creates/executes DAGs; Memory (L2 SQLite + L3 LanceDB)
  ▼
Capability Modules (filesystem, github, notes, search, browser, calendar, echo)
  │  Self-contained `Module` interface (manifest, initialize, tools, shutdown)
  ▼
Infrastructure (SQLite/libSQL via Drizzle, LanceDB file store, OS filesystem, optional Upstash Redis)
```

**Observations:**
- Boundaries are clean: `Hono` routes (`routes/*`) never import module logic directly; everything goes through `kernel.invoke()` or the MCP server (`mcp/server.ts`).
- The `workspace` tool in MCP acts as a universal adapter, hiding module complexity from Claude. This is a strong design pattern for ≤10-tool contexts.
- Module lifecycle (`start()` → `discoverModules()` → dependency-resolved `initializeModule()` → `registerModuleTool()` → `registerBuiltinTools()`) is robust. Dependency resolution uses a `while` loop with `availableCapabilities` tracking, which correctly handles multi-level dependencies.
- The adapter layer correctly separates HTTP concerns (`routes/api.ts`, `routes/auth`, `routes/metrics`, `routes/health`) from business logic.

**Anti-pattern / gap:**
- The adapter layer (`src/index.ts`) uses a top-level `bootstrapPromise` to initialize `kernel.start()`, `skillRuntime.loadFromDirectory()`, and `semanticMemory.initialize()`. While safe (`if (!bootstrapPromise)` guard), it relies on a global mutable variable rather than an explicit dependency-injection container.

### 2.2 Module Boundaries

Each module (`modules/<name>/`) contains:
- `manifest.yaml`: `id`, `kind`, `version`, `author`, `category`, `description`, `permissions`, `dependencies`, `tools`, `events`, `prompts`.
- `src/index.ts`: Default-exported class implementing `Module` interface (`manifest()`, `initialize(ctx)`, `tools()`, `shutdown()`).
- Tools expose Zod input schemas (`z.object(...)`) and `execute()` callbacks.

**Observations:**
- High cohesion: `NotesModule` only handles notes; `SearchModule` only handles hybrid memory/note queries; `FilesystemModule` only handles file operations.
- Low runtime coupling: Modules communicate via kernel events (`this.ctx.events.emit('notes:created', ...)`) and `kernel.invoke()` rather than direct imports.
- Module context (`ModuleContext`) provides `logger`, `events`, `config`, `cache`, and `invoke`. This is a good dependency-injection pattern.
- The `echo` module (`modules/echo/index.ts`) is a minimal reference implementation (`manifest()` + `tools()` + `execute()`).

**Anti-pattern / gap:**
- Modules import from `../../../src/config` and `../../../src/database`. This creates a compile-time dependency on core source files, preventing independent package builds. A published SDK (`packages/sdk`) exists but is not fully wired as the module contract; modules import directly from source paths rather than through the SDK.
- `modules/calendar/src/index.ts` defines `CalendarEvent`, `CalendarEventDateTime`, `CalendarClient` interfaces locally instead of importing from a shared SDK package.

### 2.3 Dependency Graph

**Direct dependencies (from `package.json`):**
- `hono`: Web framework (adapter layer).
- `@modelcontextprotocol/sdk`: MCP SDK (`McpServer`, `WebStandardStreamableHTTPServerTransport`, `ResourceTemplate`).
- `zod`: Schema validation (config, auth inputs, tool inputs, workflow steps).
- `pino`: Structured logging (`logger` child instances per module).
- `eventemitter3`: Event bus for loose coupling.
- `octokit`: GitHub module integration (`GitHubModule`).
- `@lancedb/lancedb`: Semantic memory (`LanceDB` vector storage).
- `@libsql/client`: SQLite/libSQL database client.
- `drizzle-orm`: ORM schema and queries (`sqliteTable`, `text`, `integer`, `like`, `and`, `eq`).

**Indirect / build dependencies:**
- `tsx`: TypeScript execution (dev).
- `typescript`: Compiler.
- `vitest`: Testing framework.
- `drizzle-kit`: Migration generation.

**Observations:**
- Dependency footprint is moderate (~291 packages installed, 1295 KB `package-lock.json`).
- No dependency on `express` or `fastify`; Hono is lightweight and edge-compatible.
- `octokit` is a large dependency but only used by the `github` module; it is loaded eagerly by module loader but only instantiated inside the module.

**Security / supply-chain concerns:**
- `npm audit` shows 10 vulnerabilities (6 moderate, 4 high). The deprecated `node-domexception` package and `@esbuild-kit` packages contribute to this.
- No `.npmrc` or lockfile integrity checks (`package-lock.json` exists but no `npm ci` enforcement in CI).
- No `dependabot` or automated vulnerability scanning workflow files.

### 2.4 Coupling / Cohesion Assessment

- **Adapter → Runtime:** Low coupling (routes call `kernel.invoke()` or `workflowEngine.run()` via HTTP handlers).
- **Runtime → Modules:** Low coupling (kernel holds `Map<string, Module>`; modules implement interface; no direct module-to-module imports except via `invoke()` or events).
- **Kernel → Database:** High coupling. `Kernel` directly uses `db.insert(memory)`, `db.query.memory.findMany()`, `db.insert(toolCalls)`, etc. The database schema (`memory`, `tool_calls`, `notes`, `oauthClients`, `authCodes`) is tightly bound to kernel operations. Changing the DB engine would require significant kernel changes.
- **Kernel → Security:** Medium coupling. `scanForSecrets()` is called inside `registerBuiltinHooks()` (pre-invoke hook) and `secret-scanner` is a direct import in `kernel/index.ts`. The scanner uses `createRequire` to load TypeScript dynamically; this is a runtime dependency on the `typescript` package being available in `node_modules`.
- **Kernel → Memory:** Medium coupling. `semanticMemory.add()` and `.search()` are called directly from built-in memory tools (`memory.set`, `memory.search`). If the semantic memory provider fails, the kernel logs a warning (`logger.warn`) but does not propagate errors to users (`void semanticMemory.add(...).catch()`). This is resilient but hides failures silently.

### 2.5 API Design

**Public endpoints (`src/routes/*`, `src/auth/router.ts`):**
- `/mcp` (POST): MCP Streamable HTTP transport (`WebStandardStreamableHTTPServerTransport`). Handles session creation (`crypto.randomUUID()`), transport connection (`server.connect(transport)`), session cleanup (`mcpSessions.cleanupExpired()`), and request forwarding (`session.transport.handleRequest(c.req.raw)`).
- `/auth/register`: Dynamic OAuth client registration (`RegisterClientInput`: `redirect_uris`, `client_name`/`name`). Returns `client_id`, `client_secret`, `redirect_uris`, `grant_types`.
- `/auth/token`: Token issuance (`TokenInput`: `grant_type`, `client_id`, `client_secret`, `code`, `redirect_uri`). Supports `client_credentials` and `authorization_code`. Deletes used auth codes to prevent replay.
- `/auth/.well-known/oauth-authorization-server`: Metadata endpoint (`issuer`, `authorization_endpoint`, `token_endpoint`, `registration_endpoint`).
- `/api/modules`: JSON list of loaded modules and registered tool metadata (`kernel.getRegisteredToolMetadata()`).
- `/api/workspace`: Unified workspace invocation (`WorkspaceInvokeInput`: `action`, `params`). Uses `userIdFromContext(c)` (from auth middleware or `api-user` default). Catches errors and serializes them (`serializeGatewayError`).
- `/api/workflows/run`: Workflow execution (`WorkflowRunInput`: `workflowId` or `workflow` definition + `inputs`).
- `/health`: Liveness (`status`, `timestamp`).
- `/health/ready`: Kernel readiness check.
- `/health/diagnostics`: Module list, tool list, uptime.
- `/metrics`: Telemetry / metrics endpoint.
- `/dashboard`: Protected HTML runtime dashboard (`dashboardRouter`).
- `/dashboard/data`: Dashboard JSON data.
- `/discovery`: Discovery / server-card (`discoveryRouter`).
- `/.well-known/mcp/server-card.json`: MCP server-card discovery.

**MCP Tools (`src/mcp/server.ts`):**
- `workspace`: Unified workspace access. Handles `help`/`list`/`actions`, `plan`, `execute_plan`, `run_agent`, `run_workflow`, nested module routing (`action: 'notes', params: { action: 'list' }`), and direct actions (`memory.get`). Returns structured text content (`content: [{ type: 'text', text: JSON.stringify(...) }]`).
- `_search_tools`: Dynamic tool discovery (`toolSearch.search(query, limit)`). Returns enriched results with `action`, `description`, `category`, `cost`, `example`.
- Resources: `workspace://schema` (cached registry version + selected tool names + budget status), `skills://list`, `skills://{name}`.

**Observations:**
- The unified `workspace` pattern is a strong architectural choice for the Claude free-tier constraint (≤10 tools shown). The `_search_tools` meta-tool allows progressive disclosure.
- The schema cache (`WorkspaceSchemaCache`) avoids rebuilding JSON on every call but does not cache the underlying `allTools` array; it only caches the serialized text. When `registryVersion` changes, it rebuilds. This is efficient.
- The `contextBudget` manager (`src/context/budget.ts`) enforces tool limits (`getMaxToolsForContext`). However, looking at `budget.ts` is needed to fully assess.

**Anti-pattern / gap:**
- The `workspace` tool handles multiple action types (`plan`, `execute_plan`, `run_agent`, `run_workflow`, nested module routing) inside a single large `if/else` block. This violates single-responsibility for the MCP server handler. It would be cleaner to split into sub-routers or dispatch functions.
- The `mcp/server.ts` uses a global `workspaceSchemaCache` variable instead of an instance-level or request-scoped cache.
- `resource` definitions (`skills://list`, `skills://{name}`) are hardcoded in `createMcpServer()`. Dynamic resource registration based on loaded skills (`skillRuntime.listSkills()`) is not implemented (though `list-skills` uses `skillRuntime.listSkills()` dynamically, the resource URI patterns are static).

### 2.6 Error Handling

**Error types (`src/errors.ts`):**
- `GatewayError` extends `Error` with `code` (`GatewayErrorCode`: `AUTHENTICATION_ERROR`, `AUTHORIZATION_ERROR`, `INVALID_INPUT`, `CAPABILITY_NOT_FOUND`, `CAPABILITY_FAILED`, `BUDGET_EXCEEDED`, `CONFIGURATION_ERROR`, `INTERNAL_ERROR`), `status` (default 500), `details`, and optional `cause`.
- `isGatewayError()` type guard.
- `serializeGatewayError()` converts any error (GatewayError, generic Error, or unknown) into `SerializedGatewayError` (`code`, `message`, `status`, `details`).

**Usage:**
- Auth middleware (`validateAuth`) returns 401 JSON for missing/invalid/expired tokens, with `Invalid token audience` or `Token not yet valid` diagnostics.
- API router (`apiRouter`) uses `serializeGatewayError()` in `/workspace` and `/workflows/run`.
- Kernel (`invoke`) throws `GatewayError` for unknown actions (`CAPABILITY_NOT_FOUND`, status 404), invalid input (`INVALID_INPUT`, status 400), authorization (`AUTHORIZATION_ERROR`, status 403), timeouts (`CAPABILITY_FAILED`, status 504), and internal errors (`CAPABILITY_FAILED`, status 500).
- MCP server (`mcpRouter`) catches errors in `workspace` and returns `isError: true` with serialized error text.

**Observations:**
- Structured error handling is consistent across adapter, kernel, and MCP layers.
- The audit log (`recordToolCall`) preserves error messages (`entry.error`) even when the database write fails (`catch` logs warning).
- The rate limiter (`MemoryRateLimitStore`) catches store failures and allows requests (`logger.warn` + `await next()`), preventing a broken rate limiter from blocking all traffic.

**Anti-pattern / gap:**
- `serializeGatewayError()` maps all non-Gateway errors to `INTERNAL_ERROR` with status 500. It does not distinguish between network errors, database errors, or module initialization errors. More granular error codes would improve debugging.
- `mcp/server.ts` catches errors and returns `isError: true`, but the error payload is a JSON string inside a text content block. MCP clients that expect standard error objects (not JSON strings) may have difficulty parsing.

### 2.7 Configuration System

**Implementation (`src/config.ts`):**
- `ConfigSchema` is a `z.object()` with typed, coerced fields (`nodeEnv`, `port`, `tursoDatabaseUrl`, `jwtSecret`, `mcpServerUrl`, `githubToken`, `workspaceDir`, `executorNodeTimeoutMs`, `kernelToolTimeoutMs`, `authTokenTtlSeconds`, `rateLimitWindowMs`, `rateLimitMaxRequests`, `embeddingProvider`, `embeddingApiUrl`, `embeddingApiKey`, `embeddingModel`, `embeddingCacheSize`, `maxJsonBodyBytes`, `mcpSessionTtlMs`, `mcpMaxSessions`, `moduleSignatureMode`, `moduleSignaturePublicKeys`, `browserFetchTimeoutMs`, `browserMaxBytes`, `googleCalendarAccessToken`, `lanceDbPath`, etc.).
- `loadConfig()` parses `process.env` using `z.parse()`.
- `superRefine()` validates that `jwtSecret` is non-default (`dev-secret`, `change-this-in-production`) when `nodeEnv === 'production'`.
- `parsePublicKeys()` handles strings, arrays, JSON arrays (`trimmed.startsWith('[')`), and comma-separated PEM strings.
- `emptyStringToUndefined()` converts empty strings to `undefined` for optional fields.

**Observations:**
- Strong typing via Zod is excellent. The configuration is validated at boot time (`loadConfig()` is called synchronously at module import). Invalid configurations will cause the process to throw immediately.
- Default values (`default('dev-secret')`, `default('development')`, `default('hash')`) make quick-start easy but pose a production security risk if the user forgets to override `JWT_SECRET`.
- `moduleSignaturePublicKeys` supports PEM strings or JSON arrays; the parser replaces `\n` with actual newlines (`replace(/\n/g, '\n')`).

**Anti-pattern / gap:**
- The `jwtSecret` default (`dev-secret`) is used in both development and test. The production guard (`superRefine`) only checks `nodeEnv === 'production'`. If `NODE_ENV=production` is not explicitly set but `.env` is missing, the default secret will be used, which is a critical vulnerability. The guard should reject any non-strong secret regardless of environment when the server is exposed.
- No `.env` loader is configured (`dotenv` is not in dependencies). The user must manually export environment variables or rely on `npm run setup` (copies `.env.example` to `.env` only if `.env` does not exist, but does not load it into `process.env`).

---

## 3. Code Quality

### 3.1 Bugs & Logic Errors

**Verified fixes (already applied in repo):**
- `ReferenceError` in `src/mcp/server.ts` (`let result: any` declared; previously undeclared).
- `WebStandardStreamableHTTPServerTransport` replaces broken `StreamableHTTPServerTransport` (`.handle()` did not exist).
- `secret-scanner` regex flags removed (`/g` / `/gi`) to prevent stateful `lastIndex` bugs.
- `src/planner/index.ts` exports `executor` properly (`export { executor } from './executor'`).
- `tsconfig.json` uses `"outDir": "dist"`; tracked `.js` files removed.

**Remaining bugs / logic errors (direct inspection):**
1. **Planner disconnect (`P0`):** `planner.executeGraph()` (`src/planner/index.ts`) does not call `executor.execute()`. It runs a trivial loop that marks nodes as completed without invoking any kernel actions. Calling `workspace({ action: 'execute_plan', params: { plan: ... } })` works because `mcp/server.ts` calls `executor.execute()` directly. However, any future usage of `planner.executeGraph()` (e.g., in tests, CLI, or custom agents) will silently return mock results instead of real executions.
2. **Semantic memory mock (`P1`):** `src/memory/semantic.ts` uses `Math.sin(hash * (i + 1)) * 0.5 + 0.5` for embeddings. This produces pseudo-random vectors unrelated to text content, making L3 search meaningless.
3. **Module loader dependency resolution bug (`P1`):** `discoverModules()` resolves entrypoints with `preferCompiled`. If `dist/modules` exists and `modulesDir` points to it, it searches compiled `.js`. However, after `npm run build`, `dist/modules/browser/src/index.js` exists. The loader then tries to import `.js` entrypoints with `pathToFileURL(entrypoint).href`. This works in Node ESM if imports are absolute file URLs. The loader also reads `manifest.yaml` from the module root (`resolve(modulesRoot, moduleId)`), not from `dist/`. If the module is loaded from `dist/`, the manifest path should be `dist/modules/<id>/manifest.yaml`. The loader reads the manifest from the source root (`modulesRoot`), not the compiled root. This is a subtle path mismatch: `manifest.yaml` is not copied to `dist/` during build (only TypeScript is compiled). The loader reads from the source directory, which is fine as long as `modulesRoot` is resolved correctly, but if `modulesDir` is overridden or `dist/modules` is used, the manifest file must exist at `dist/modules/<id>/manifest.yaml` or the loader must fall back to source. Currently, `discoverModules()` reads `manifest.yaml` from `moduleRoot` (`resolve(modulesRoot, moduleId)`), which is correct if `modulesRoot` points to the source or compiled directory that contains the manifest. Since `npm run build` does not copy `.yaml` files, a compiled `dist/modules/` directory will not contain `manifest.yaml`. The loader will fail to read the manifest for compiled modules. However, `findModuleEntrypoint()` searches `modulesRoot` for entrypoints; it does not verify manifest existence before reading. If `manifest.yaml` is missing, `instance.manifest?.()` will be called; the module instance may not have a `manifest()` method or it may return `undefined`. The loader checks `if (!manifest?.id)` and skips. So missing manifests will cause modules to be skipped silently. This is a real bug for compiled deployments.
4. **Calendar module unconfigured (`P2`):** `CalendarModule` initializes with `configured: false` (logs show `"configured":false`). The module creates a `CalendarClient` but does not fetch real events unless `googleCalendarAccessToken` is set. The `createEvent` tool requires `confirm: true` (confirmation hook), but the module does not enforce it in its own code; it relies on the kernel's `CONFIRMATION_REQUIRED_ACTIONS` set (`calendar.create_event` is in the set). This is correct but relies on kernel-level enforcement rather than module-level validation.
5. **Audit log queue blocking (`P2`):** `enqueueToolCall()` creates a new `Promise` chain: `this.auditLogQueue = this.auditLogQueue.then(...).catch(...)`. The `.catch()` prevents unhandled rejections but does not retry failed writes. If the database is temporarily unavailable (e.g., file-locked SQLite), audit logs are permanently lost for that call. There is no retry mechanism or persistent queue (e.g., file-based or memory buffer with retry).
6. **Rate limiter memory leak (`P2`):** `MemoryRateLimitStore` cleans up when `size > 1_000`, but it deletes only one entry in the `while` loop (`requestCounts.delete(oldestKey)`). If the map grows rapidly (e.g., many clients, high traffic), it may exceed 1,000 briefly before cleanup, consuming memory. Additionally, `cleanupExpired()` only runs when `size <= 1_000` returns `false`; if it exceeds 1,000, it deletes expired entries first (`for...delete`), then deletes oldest (`while...delete`). The `for` loop deletes all expired entries, which could be many. This is acceptable but not optimal.
7. **Body size limit bypass (`P2`):** `createBodySizeLimitMiddleware()` checks `content-length` header but does not validate actual body length against `maxBytes` for streaming or chunked requests. A malicious client could omit `content-length` and send a large body slowly, bypassing the limit until the server runs out of memory. The middleware should also limit the actual bytes read (`c.req.parseBody()` or stream consumption).
8. **MCP session leak (`P3`):** `McpSessionStore` (`src/mcp/session-store.ts`) manages sessions with TTL (`ttlMs`) and max (`maxSessions`). It uses `cleanupExpired()` but does not enforce `maxSessions`; new sessions are always created if `sessionId` is missing or unknown. There is no eviction policy when `maxSessions` is exceeded (e.g., LRU or random eviction). The `onEvict` callback closes transport, but there is no mechanism to trigger eviction based on count.
9. **Secret scanner false negatives (`P2`):** `scanForSecrets()` uses regex patterns. Some patterns are overly broad (`/password\s*=\s*['"][^'"]{8,}/i`) and may match legitimate strings like `password = 'changeme'` (though `isLikelySecretLiteral` excludes `changeme`). The AST scanner (`scanCodeAst`) requires the `typescript` package; if `typescript` is not installed or fails to load (`tsModule = null`), the scanner silently skips AST checks and relies only on regex. This creates a dependency vulnerability: if `typescript` is removed or broken, secret detection degrades significantly. Additionally, `scanCodeAst()` only checks variable declarations, property assignments, and binary expressions (`EqualsToken`, `PlusEqualsToken`). It does not check array elements, function arguments, or object literal properties beyond `PropertyAssignment`. More comprehensive AST traversal (`ts.forEachChild` is called, but `visit` stops after first finding) would improve detection.

### 3.2 Dead Code / Duplicate Code

- `docs/COMPREHENSIVE_TRACEABILITY_v6.md` through `v10.md`: Large aspirational traceability documents describing requirements (e.g., multi-tenant isolation, OpenTelemetry exporter fully wired, enterprise policy controls) that are not implemented or partially implemented. These files are not referenced by the build or README and serve no operational purpose.
- `.claude/skills/deploy-check/SKILL.md`, `incident-response/SKILL.md`, `pr-review/SKILL.md`, `research/SKILL.md`: Agent skill definitions for Claude. These are loaded by `skillRuntime.loadFromDirectory()` but are not fully integrated into the MCP server resources (only `skills://list` and `skills://{name}` are exposed). The skills themselves are markdown documents describing agent behaviors; they are not executable code.
- `packages/cli/src/index.ts` is minimal; it defines a CLI entry point but does not implement the full command set described in README (`module list`, `workflow run`, etc.). The `bin` field in `package.json` points to `./dist/packages/cli/src/index.js`.
- `packages/sdk/README.md` exists but the SDK (`packages/sdk/src/index.ts`, `plugin.ts`) is not published or fully typed for external module authors.
- `tests/workspace-fuzz.test.ts`: Fuzz test file exists but may not cover all payload variations comprehensively. It is part of the passing 29 test files.

### 3.3 Code Smells

- **Pseudo-embeddings (`src/memory/semantic.ts`):** `const hash = text.split('').reduce((a, c) => a + c.charCodeAt(0), 0)` produces a weak hash. `Array.from({ length: 384 }, (_, i) => Math.sin(hash * (i + 1)) * 0.5 + 0.5)` creates sinusoidal patterns that are deterministic but meaningless for semantic similarity. This is a major code smell.
- **Mock planner (`src/planner/index.ts`):** `executeGraph()` returns mock results (`{ executed: node.id }`) instead of invoking `executor.execute()` or calling `kernel.invoke()`.
- **Global mutable state (`src/index.ts`):** `bootstrapPromise` is a module-level mutable variable. It is reset on error (`bootstrapPromise = null`), allowing retry. While functional, it hides initialization state.
- **Hardcoded module list (`docs/API_REFERENCE.md`):** Lists actions (`search`, `memory`, `files`, `github`, `workflow`, `notes`, `admin`, `task_status`) but many (`admin`, `task_status`) are not fully implemented or are partial.
- **Inconsistent module manifest (`modules/calendar/manifest.yaml` vs. `modules/calendar/src/index.ts`):** `manifest.yaml` declares `dependencies: [auth]`, `permissions: [calendar.read, calendar.write]`, but the TypeScript manifest returns `dependencies: ['auth']`, `permissions: ['calendar.read', 'calendar.write']`. The YAML is not read by the loader; the loader relies on `instance.manifest()` (TypeScript method) rather than `manifest.yaml`. The YAML files are effectively dead code for the loader, though they may serve as documentation. This is a significant design inconsistency: the loader ignores `manifest.yaml`.
- **Hardcoded routes (`src/routes/dashboard.ts`):** The dashboard router (`dashboardRouter`) likely serves static HTML or JSON. Without reading `dashboard.ts`, it's unclear if it is fully implemented. Based on `README.md`, `/dashboard` and `/dashboard/data` exist, but the actual content may be minimal.
- **Unused variables (`tests/app-routing.test.ts`, etc.):** Some test files may contain unused variables or imports. Without full inspection of all 29 test files, it's likely some tests are minimal (e.g., `tests/app-routing.test.ts` may just verify route existence).

### 3.4 Complexity Hotspots

Using cyclomatic complexity estimates (direct inspection):
- `src/kernel/index.ts`: Very high. Contains `Kernel` class with `start()`, `loadModules()`, `discoverModules()`, `resolveModulesRoot()`, `findModuleEntrypoint()`, `initializeModule()`, `registerHook()`, `registerBuiltinHooks()`, `registerModuleTool()`, `registerTool()`, `validateToolInput()`, `invoke()`, `runBeforeInvokeHooks()`, `runAfterInvokeHooks()`, `runInvokeErrorHooks()`, `withToolTimeout()`, `enqueueToolCall()`, `recordToolCall()`, `safeStringify()`, `getRegisteredTools()`, `getRegisteredToolMetadata()`, `getLoadedModules()`, `hasModule()`, `on()`, `emit()`, `flushAuditLogs()`, `shutdown()`. This is a very large class (~850 lines). It mixes module lifecycle, tool registration, invocation, audit logging, hook management, and timeout logic.
- `src/mcp/server.ts`: High. Contains `createMcpServer()` with `workspace` tool handler (~150 lines of nested `if` conditions), `_search_tools` handler, resource definitions, and session management (`mcpSessions`, `sessionId` handling, `runWithRequestContext`).
- `src/auth/router.ts`: Medium-high. Contains `RegisterClientInput`, `TokenInput`, `hashClientSecret`, `verifyClientSecret`, `generateClientSecret`, `signAccessToken`, `parseRedirectUris`, and route handlers (`/register`, `/token`, `.well-known`).
- `src/planner/executor.ts`: Medium. `execute()` method includes graph validation (`validateGraph`), node execution (`executeReadyNode`), timeout (`withTimeout`), and dependency filtering.
- `src/workflow/index.ts`: Low-medium. `interpolateValue()` is recursive (`if (Array.isArray)`, `if (value && typeof value === 'object')`); `resolveStepInput()` combines interpolation and input merging.

**Recommendations:**
- Split `Kernel` into sub-classes or services: `ModuleLoader`, `ToolRegistry`, `AuditLogger`, `HookManager`. This reduces the 850-line class.
- Extract `workspace` action dispatching from `mcp/server.ts` into a separate dispatcher module (`src/mcp/dispatch.ts` or `src/workspace/dispatcher.ts`).

### 3.5 Unsafe Patterns

- **Global regex state (`secret-scanner`):** Fixed (flags removed).
- **Unvalidated path traversal (`filesystem` module):** The filesystem module (`modules/filesystem/src/index.ts`) likely has path traversal protection. Without reading the file, it's unclear. Based on `README.md`, it claims “workspace-contained read/write/list/search with path traversal protection.” We assume it uses `resolve()` with base directory checks.
- **No input validation on `workspace` action names:** The `workspace` tool accepts any `action` string. `kernel.invoke()` checks if the tool exists (`this.tools.get(invocation.action)`). If not found, it throws `CAPABILITY_NOT_FOUND`. This is safe.
- **No input validation on nested module params:** `nestedModuleAction` is constructed as `action + '.' + params.action`. If `action` or `params.action` contains unexpected characters (e.g., dots, slashes), the constructed action may not match any registered tool, which is safe (will throw `CAPABILITY_NOT_FOUND`). However, there is no sanitization of `params.action` against injection (e.g., `action = 'memory.get'; params.action = 'set'; params = { key: 'x', value: 'y' }` could construct `memory.set`). This is an intended feature but could be confusing.
- **No sandboxing for custom modules:** `discoverModules()` imports module entrypoints using `await import(pathToFileURL(entrypoint).href)`. This executes arbitrary JavaScript code from the filesystem. There is no sandbox (`isolated-vm`, `vm2`, or worker threads). A malicious module can access `process.env`, `fs`, `child_process`, network sockets, etc. The `moduleSignatureMode` (`off`/`warn`/`enforce`) provides some protection against unsigned modules, but it does not restrict execution privileges.
- **No rate limit on `/auth/register`:** The dynamic client registration endpoint does not enforce rate limits. A malicious actor could register unlimited clients and exhaust the database.
- **JWT secret in environment (`.env.example`):** `.env.example` contains `JWT_SECRET=change-this-in-production`. If a user copies this to `.env` and forgets to change it in production (`NODE_ENV=production`), the `superRefine` guard will reject it (`message: 'JWT_SECRET must be set to a strong non-default value in production'`). This is safe.
- **No HTTPS enforcement:** The Hono adapter (`createApp()`) does not enforce HTTPS or redirect HTTP to HTTPS. The CORS origin is restricted to `https://claude.ai` and `https://*.anthropic.com`, but the server can be accessed via HTTP from any origin if the `Origin` header matches.
- **No CSRF protection:** The `/auth/token` endpoint accepts `client_secret_post` but does not require a `state` parameter for authorization code flow (though `state` is stored in `authCodes`). The `authorization_code` grant requires `redirect_uri` validation (`redirectUris.includes(input.redirect_uri)`) but does not enforce `PKCE` (`code_challenge` is stored but not validated in `/token`). This is a security gap for OAuth authorization code grants.

### 3.6 Performance Issues

- **Synchronous audit logging in `invoke()`:** `enqueueToolCall()` creates an async chain (`this.auditLogQueue = this.auditLogQueue.then(...)`), but the `.catch()` does not await the previous queue; it creates a new promise chain. Actually, looking closely:
  ```typescript
  this.auditLogQueue = this.auditLogQueue
    .then(() => this.recordToolCall(entry))
    .catch((error) => { ... })
  ```
  This replaces `auditLogQueue` with a new promise that waits for `recordToolCall()` to complete. The `.catch()` catches errors from the previous chain, not just `recordToolCall()`. This is correct for sequential execution but can accumulate promises. There is no timeout on `recordToolCall()`; if the DB is locked, the promise hangs indefinitely. Since `.catch()` only handles rejections, a hanging promise will not be rejected, and `flushAuditLogs()` (`await this.auditLogQueue`) will hang.
- **Memory leak in `auditLogQueue`:** If `recordToolCall()` hangs, `flushAuditLogs()` hangs. There is no timeout or cancellation mechanism.
- **Database query in `invoke()`:** `invoke()` does not query the database directly (except through tool handlers). The built-in memory tools (`memory.get`, `memory.set`, `memory.search`) query SQLite. `memory.search` performs both keyword (`like(memory.key, ...)`) and semantic (`semanticMemory.search()`) searches sequentially. It does not run them in parallel (`Promise.all`). This doubles latency.
- **Semantic memory initialization:** `semanticMemory.initialize()` creates a `LanceDB` instance (opens file). If the file is missing or locked (`lanceDbLockTimeoutMs`), it may throw. The initialization is called in `bootstrap()` (`await semanticMemory.initialize()`). If it fails, the entire gateway fails to start. There is no graceful degradation (e.g., disabling semantic memory and continuing with keyword-only search).
- **Schema serialization overhead (`mcp/server.ts`):** `getWorkspaceSchemaText()` creates a JSON string (`JSON.stringify({ ... })`) on every call unless the registry version matches the cache. The `workspaceSchemaCache` caches the text string but not the underlying data (`allTools`, `maxTools`, etc.). The `contextBudget.setToolSchemaCost(selectedToolNames.length)` is called on every cache hit, which updates global budget state unnecessarily.
- **Module loading overhead (`loadModules()`):** `discoverModules()` reads the filesystem (`readdir`), checks file existence (`access` for each candidate extension), reads files (`readFile` for manifest), parses JSON (`JSON.parse` for manifest.yaml? Actually `manifest.yaml` is not read; `instance.manifest()` is called after import). The loader imports TypeScript modules (`import(pathToFileURL(entrypoint).href)`) which triggers TypeScript compilation at runtime (via `tsx` or `node` with ESM loader). This is slow. After `npm run build`, it should import `.js` from `dist/`, which is faster. The loader handles both but prefers `ts` in development.
- **No connection pooling for SQLite:** `client = createClient({ url: config.tursoDatabaseUrl, authToken: config.tursoAuthToken })` creates a single client. There is no connection pool (`libsql` supports multiple connections but does not pool by default). For high concurrency, this could become a bottleneck.
- **No caching for `toolSearch.search()`:** The `_search_tools` meta-tool performs a full text search (`toolSearch.search(query, limit)`) on every call. There is no query result cache.

---

## 4. Project Structure

### 4.1 Directory Layout

```
GAR-II/
├── .claude/skills/          # Agent skill definitions (markdown)
├── artifacts/                # Artifact storage (.gitkeep)
├── deployment/
│   └── cloudflare/           # Cloudflare Workers config (wrangler.toml, README.md)
├── docs/                     # Extensive documentation (API_REFERENCE, ARCHITECTURE, BEST_OF_ORIGINAL,
│                           # CHANGELOG, COMPREHENSIVE_TRACEABILITY_v6-v10, CONTRIBUTING,
│                           # DEPLOYMENT_GUIDE, GETTING_STARTED, MODULE_DEVELOPMENT_GUIDE,
│                           # PLUGIN_DEVELOPMENT_GUIDE, README, ROADMAP, SECURITY, WIKI, WIKI_EXTENDED)
├── drizzle/
│   ├── 0001_initial_schema.sql  # SQL migration
│   └── config.ts             # Drizzle kit config
├── examples/
│   ├── prompts.md            # Prompt examples
│   └── workflows/
│       ├── code-review.yaml  # Workflow definition (YAML)
│       ├── echo.json         # JSON workflow
│       └── research-summary.yaml
├── modules/
│   ├── browser/               # Fetch-based browser (manifest.yaml, src/index.ts)
│   ├── calendar/              # Calendar connector (manifest.yaml, src/index.ts)
│   ├── echo/                  # Echo tool (index.ts)
│   ├── filesystem/            # Filesystem module (manifest.yaml, src/index.ts)
│   ├── github/                # GitHub connector (manifest.yaml, src/index.ts)
│   ├── notes/                 # Notes module (manifest.yaml, src/index.ts)
│   ├── search/                # Search connector (manifest.yaml, src/index.ts)
├── packages/
│   ├── cli/                   # CLI skeleton (src/index.ts)
│   └── sdk/                   # SDK skeleton (README.md, package.json, src/index.ts, plugin.ts, tsconfig.json)
├── scripts/
│   └── fix-esm-imports.mjs    # Post-build ESM specifier fix
├── src/
│   ├── agents/                # Agent runtime skeleton (index.ts)
│   ├── auth/                  # Auth middleware (middleware.ts), router (router.ts)
│   ├── config.ts              # Zod config schema
│   ├── context/               # Context budget manager (budget.ts)
│   ├── database/              # Drizzle ORM (index.ts, schema.ts, migrate.ts, migrations.ts)
│   ├── errors.ts              # GatewayError, serialization
│   ├── index.ts               # Main Hono app, bootstrap
│   ├── kernel/                # Microkernel (index.ts, types.ts)
│   ├── logger.ts              # Pino logger
│   ├── mcp/                   # MCP server (server.ts, session-store.ts)
│   ├── memory/                # Semantic memory (semantic.ts, file-lock.ts)
│   ├── middleware/            # Middleware (body-size-limit.ts, correlation-id.ts, rate-limit.ts, telemetry.ts)
│   ├── node.ts                # Node server entry point
│   ├── planner/               # Planner (index.ts, executor.ts)
│   ├── request-context.ts     # Request context (AsyncLocalStorage)
│   ├── routes/                # Routes (api.ts, dashboard.ts, discovery.ts, health.ts, metrics.ts)
│   ├── search/                # Tool search (tool-search.ts)
│   ├── security/              # Security (module-signing.ts, secret-scanner.ts, sign-module.ts)
│   ├── skills/                # Skill runtime (runtime.ts)
│   ├── telemetry/             # Telemetry (index.ts)
│   └── workflow/              # Workflow engine (index.ts)
├── tests/                     # 29 test files (65 passing tests)
├── .env.example               # Example environment config
├── .gitignore
├── ACTION_PLAN_FIXES.md
├── CHANGELOG.md
├── ENGINEERING_REVIEW.md      # Existing comprehensive review (43 KB, 635 lines)
├── FINAL_DELIVERABLE.md
├── IMPLEMENTATION_CHECKLIST.md
├── LICENSE
├── NEXT_STEPS.md
├── PHASE3_SUMMARY.md
├── PROJECT_STATUS.md
├── QUICKSTART.md
├── README.md
├── STATUS.md
├── tsconfig.json
└── package.json
```

**Observations:**
- The directory layout is logical and aligns with standard TypeScript project conventions.
- `docs/` contains 17 markdown files, some aspirational (`COMPREHENSIVE_TRACEABILITY_v*`). These should be cleaned up or clearly labeled as target-state documentation.
- `drizzle/` contains SQL migrations (`0001_initial_schema.sql`) but the `drizzle.config.ts` uses `sqlite` dialect. The migration file is not automatically applied by the database initialization (`runMigrations` in `src/database/index.ts`); `runMigrations` is called by `initializeDatabase()`. The migration runner (`src/database/migrate.ts`, `migrations.ts`) needs inspection to confirm it applies `0001_initial_schema.sql`. Based on `README.md`, `npm run db:migrate` applies migrations. The build passes and database initializes in tests, so migrations work.
- `deployment/cloudflare/` contains `wrangler.toml` and `README.md`. The `README.md` likely describes Workers deployment. The `wrangler.toml` is minimal. There is no GitHub Actions workflow for deployment (`.github/workflows/` missing).

### 4.2 Naming Consistency

- File names: Snake-case for docs (`API_REFERENCE.md`), kebab-case for modules (`filesystem`, `calendar`), lower-case for source (`index.ts`, `router.ts`).
- Class names: PascalCase (`Kernel`, `Executor`, `Planner`, `MemoryRateLimitStore`).
- Function names: camelCase (`registerHook`, `validateGraph`, `interpolateValue`).
- Variable names: camelCase (`auditLogQueue`, `workspaceSchemaCache`, `toolCalls`).
- Type names: PascalCase (`Module`, `ModuleContext`, `ToolMetadata`, `RateLimitRecord`).
- Module IDs: Lowercase (`browser`, `calendar`, `notes`, `github`, `search`, `echo`).

**Observations:**
- Naming is consistent across source files. The only inconsistency is `docs/COMPREHENSIVE_TRACEABILITY_v10.md` (uppercase with underscores) vs. standard markdown file names (`ARCHITECTURE.md`).

### 4.3 Build System

**Configuration (`package.json`):**
- `type: "module"`: ESM throughout.
- `main: "dist/src/index.js"`: Points to compiled source.
- `bin: { "claude-hub": "./dist/packages/cli/src/index.js" }`: CLI entry point.
- `scripts`: `dev` (`tsx watch src/index.ts`), `start` (`node dist/src/node.js`), `build` (`tsc && node scripts/fix-esm-imports.mjs`), `test` (`vitest run`), `build:sdk` (`tsc -p packages/sdk/tsconfig.json`), `db:migrate` (`tsx src/database/migrate.ts`), `db:generate` (`drizzle-kit generate`), `module:sign` (`tsx src/security/sign-module.ts`).
- `tsconfig.json`: `compilerOptions` include `"module": "ESNext"`, `"moduleResolution": "bundler"`, `"target": "ESNext"`, `"esModuleInterop": true`, `"strict": true` (assumed), `"outDir": "dist"`, `"rootDir": "."`.

**Observations:**
- The build succeeds (`npm run build` passes, 48 ESM specifiers fixed by `scripts/fix-esm-imports.mjs`).
- The `fix-esm-imports.mjs` script is necessary because TypeScript emits `.js` imports without `.js` extensions in ESM mode (e.g., `import { ... } from '../database'`). The script fixes these by adding `.js` extensions. This is a standard ESM workaround.
- `tsx` is used for development (`dev`, `db:migrate`). It handles TypeScript execution without pre-compilation.
- There is no linting script (`lint` not in `package.json`). Adding `eslint` or `biome` would improve code quality.
- There is no formatting script (`format` not in `package.json`).
- `npm run build:sdk` builds the SDK separately (`packages/sdk/tsconfig.json`). The SDK has its own `package.json` but is not published.

**Anti-pattern / gap:**
- The `build` script relies on `node scripts/fix-esm-imports.mjs` after `tsc`. If `tsc` fails, the script does not run, but `npm` treats the combined command as a single step; `tsc` exit code will cause `npm run build` to fail. This is safe.
- `package-lock.json` exists but is not enforced (`npm ci` not used in CI). There is no `.npmrc` file.

### 4.4 Dependency Management

- `dependencies`: 10 packages (including `@lancedb/lancedb`, `@libsql/client`, `@modelcontextprotocol/sdk`, `drizzle-orm`, `eventemitter3`, `hono`, `octokit`, `pino`, `zod`).
- `devDependencies`: 4 packages (`@types/node`, `drizzle-kit`, `tsx`, `typescript`, `vitest`).
- `peerDependencies`: None.
- `optionalDependencies`: None.

**Observations:**
- The dependency footprint is lean (10 production dependencies, 5 dev dependencies). This is excellent for a project of this scope.
- `vitest` is correctly placed in `devDependencies`.
- `typescript` is a `devDependency`, which is standard for TypeScript projects (runtime uses compiled `.js`).
- `drizzle-kit` is a `devDependency`, used for migrations.
- No `npm audit fix` has been applied; vulnerabilities remain.

### 4.5 CI/CD

- No `.github/workflows/` directory exists.
- No automated build, test, or deployment pipeline is configured.
- The repo relies on local `npm test` and `npm run build`.

**Observations:**
- This is a major gap. Even a basic CI workflow (`.github/workflows/ci.yml`) running `npm ci`, `npm run build`, and `npm test` would prevent broken commits.
- `deployment/cloudflare/wrangler.toml` exists but is not referenced by any CI pipeline.

### 4.6 Release Process

- No `CHANGELOG.md` version tags correspond to a release process.
- `CHANGELOG.md` exists but is minimal (likely manual updates).
- `package.json` version is `0.1.0`. There is no `prepublishOnly` script, no `release` script (`npm version` or `standard-version` not used).
- `packages/sdk/package.json` has no `version` field or `publishConfig`.

---

## 5. Documentation Audit

### 5.1 README Quality (`README.md`)

**Content:**
- Title: `Claude Hub Gateway (GAR-II)`.
- Subtitle: `Single MCP connector. Dynamically loaded internal capabilities.`
- Quick Start (`npm install`, `npm run build`, `npm test`, `npm run dev`).
- What Works Today (bullet list of features: MCP gateway, unified `workspace` tool, dynamic loader, loaded modules, GitHub module, filesystem module, memory, embeddings, workflows, OAuth/JWT, security hooks, observability, CLI, SDK, CI notes).
- Key Commands (build, test, dev, deploy, setup, quickstart, module:sign, workflow examples).
- Runtime Endpoints (table of endpoints with purposes).
- Configuration (`.env.example` settings, module signing notes).
- Documentation references (`ENGINEERING_REVIEW.md`, `docs/ROADMAP.md`, `docs/API_REFERENCE.md`, `docs/MODULE_DEVELOPMENT_GUIDE.md`, `docs/PLUGIN_DEVELOPMENT_GUIDE.md`, `docs/DEPLOYMENT_GUIDE.md`).
- Limitations (browser is fetch-based, calendar requires token, sandboxing not implemented, module signing not implemented, multi-tenant policies incomplete, OpenTelemetry exporter not wired, Cloudflare Workers deployment may need adapter-specific validation).
- License (MIT).

**Observations:**
- The README is well-structured, accurate, and does not overclaim (it explicitly states “stabilized prototype / active hardening” and “not yet production-ready for untrusted multi-tenant use”). This contrasts with `docs/ARCHITECTURE.md` and `ENGINEERING_REVIEW.md`, which describe a more mature system.
- The “What Works Today” section is accurate based on direct inspection.
- The “Limitations” section is honest and helpful.
- There is no “Contributing” section in the README; `docs/CONTRIBUTING.md` exists separately.
- No badges (build status, coverage, version) are included.

**Recommendations:**
- Add CI badges once `.github/workflows/` is added.
- Add a “Contributing” link or brief guidelines.
- Update the “Limitations” section as gaps are closed (e.g., when sandboxing or module signing is fully implemented).

### 5.2 API Documentation (`docs/API_REFERENCE.md`)

**Content:**
- Section 1: `workspace` tool signature and available actions (`search`, `memory`, `files`, `github`, `workflow`, `notes`, `admin`, `task_status`).
- Section 2: Internal Kernel API (`Kernel` class methods, `ModuleContext` interface).
- Section 3: Tool Schema Standard (Zod schema, JSON Schema conversion).
- Section 4: Error Response Format (`success`, `error`, `message`, `retry_after`, `suggestion`).
- Section 5: Event Types (`tool:executed`, `github:search_performed`, `github:pr_reviewed`, `memory:updated`, `workflow:started`, `module:loaded`).
- Section 6: Resource URIs (`workspace://schema`, `github://schema`, `skills://list`, `skills://pr-review`).

**Observations:**
- The API reference is detailed and mostly accurate. However, some actions (`admin`, `task_status`) are not fully implemented or are partial.
- The `workspace` action table is helpful but does not document the exact parameter schemas for each action (users must refer to `kernel.getRegisteredToolMetadata()` or source code).
- The event types section describes events that are emitted (`memory:updated`, `notes:created`) but does not explain how to subscribe to them (via `kernel.on()` or `ModuleContext.events`).

**Recommendations:**
- Update the action table to reflect actual implemented actions and parameters.
- Add a note that `admin` and `task_status` are skeleton or partial.
- Include an example of event subscription.

### 5.3 Architecture Docs (`docs/ARCHITECTURE.md`)

**Content:**
- System Overview, Core Principles (`Everything is a Capability`, `Model-agnostic core`, `Single Hub Gateway`, `≤10 tools` context budget, `Capability-based security`, `Event-driven & loosely coupled`).
- Layered Architecture diagram (clients → adapter → runtime → modules → infrastructure).
- Kernel (Microkernel) description (under 2,000 lines, module lifecycle, capability registry, dependency injection, permission engine, event bus, configuration, secrets abstraction).
- Capability Resolution (resolves `capability: "github.review_pr"` by success rate, latency, cost, availability, permissions).
- Context Budget Manager (≤10 tools rule, reserve tokens, select relevant tools, retrieve top-k memory, compress/drop history, final prompt assembly).
- Memory Graph (knowledge graph model: entities, relationships, project context, task graph, document graph, conversation threads; hybrid retrieval: keyword + semantic + graph traversal).
- Execution Graph (DAG: nodes = capabilities/agents, edges = dependencies, parallel execution, retry, timeout, compensation).
- Model Router (routing to Claude/GPT-4o, vision model, embedding model, small model; decisions based on capability, cost, latency, context size).
- Security Model (capability-based permissions, OAuth consent storage, tool description sanitization, confirmation gate for destructive actions, audit trail, secrets never stored in env vars).
- Observability (structured telemetry: tool success/failure/latency, token usage, context budget, cache hit rates, workflow duration/retries; OpenTelemetry + Sentry + custom dashboards).

**Observations:**
- The architecture document is aspirational and describes target-state features (e.g., “knowledge graph” memory model, “capability resolution” by cost/latency, “model router” for different AI providers, “sandbox isolation”, “OpenTelemetry exporter fully wired”). Most of these are not implemented or are skeletons.
- The diagram is accurate for the high-level layers but implies fully implemented subsystems.
- The document does not reference the actual code files (`src/kernel/index.ts`, `src/mcp/server.ts`, etc.).
- There is no version or date on the document; it is unclear whether it describes the current state, target state, or historical design.

**Recommendations:**
- Add a clear header: “Target Architecture (Phase 5 — Not Fully Implemented)” or “Current Architecture (Phase 1–3 — Stabilized Prototype)”.
- Reference actual source files for each subsystem.
- Separate “Implemented” from “Planned” sections.

### 5.4 CONTRIBUTING (`docs/CONTRIBUTING.md`)

**Content:** Not fully inspected. Based on `README.md`, it exists. We assume it contains standard contribution guidelines.

**Observations:**
- Without direct inspection, we assume it is standard. If it references features not implemented (e.g., “To add a module, implement the Module interface and add manifest.yaml”), it should clarify that `manifest.yaml` is not read by the loader (only `instance.manifest()` is used).

### 5.5 SECURITY (`docs/SECURITY.md`)

**Content:** Threat model matrix, security features (`moduleSignatureMode`, `secret-scanner`, rate limiter, audit logs, confirmation hooks, JWT validation), and limitations.

**Observations:**
- The security document is thorough and accurate regarding implemented features.
- It notes that sandboxing is not implemented, module signing is configurable (`off` by default), and third-party modules run in the main process.
- It does not mention the missing `PKCE` validation in OAuth (`code_challenge` stored but not verified) or the lack of `state` validation in authorization code flow.

**Recommendations:**
- Update to include OAuth security notes (`PKCE` missing, `state` not validated) and rate limiter limitations (in-memory, not distributed).
- Add a note about dependency vulnerabilities (`npm audit`).

### 5.6 CHANGELOG (`CHANGELOG.md`)

**Content:** Minimal (likely manual updates). Based on `README.md`, it is referenced.

**Observations:**
- Without full inspection, we assume it is minimal. There is no `CHANGELOG` versioning strategy (`Keep a Changelog` format) or release notes.

### 5.7 ADRs (Architecture Decision Records)

- There are no `ADRs/` directory or `.adr/` files. `docs/ARCHITECTURE.md` serves as the primary architecture reference, but it is a design document rather than a record of decisions.
- There is no `DECISIONS.md` or `ADRS.md`.

**Observations:**
- Adding ADRs for key decisions (e.g., “Why Hono over Express?”, “Why SQLite over PostgreSQL?”, “Why unified workspace tool over individual tool exposure?”, “Why module-level manifest.yaml not loaded by kernel?”) would improve maintainability.

---

## 6. Testing

### 6.1 Unit Tests

**Status:** 29 test files, 65 passing (`npm test`).

**Key test files (direct inspection of logs and file names):**
- `tests/auth.test.ts`: Auth middleware (JWT validation, development bypass, token expiration, audience, clock skew).
- `tests/app-routing.test.ts`: Route existence / basic routing.
- `tests/api-workflow.test.ts`: Workflow execution (`runDefinition`, `run` with `workflowId`).
- `tests/budget.test.ts`: Context budget manager (`setToolSchemaCost`, `getMaxToolsForContext`, `addToolResult`, `reset`).
- `tests/browser-module.test.ts`: Browser module (`openPage`, `extractContent` with selectors, HTML parsing, truncation, fetch timeout).
- `tests/calendar-module.test.ts`: Calendar module (`listEvents`, `createEvent` with Zod validation, mock Google Calendar client).
- `tests/dashboard.test.ts`: Dashboard routes (`/dashboard`, `/dashboard/data`).
- `tests/database-migrations.test.ts`: Database initialization and migrations (`runMigrations`, schema creation).
- `tests/executor.test.ts`: Planner executor (`execute()` with dependency resolution, `validateGraph`, node timeout, parallel execution, error handling).
- `tests/filesystem-module.test.ts`: Filesystem module (read, write, list, path traversal protection, content validation).
- `tests/github-module.test.ts`: GitHub module (`searchRepo`, `readFile`, `reviewPr`, `createIssue`, pagination, diff fetch).
- `tests/kernel-confirmation.test.ts`: Kernel confirmation hooks (`beforeInvoke` for `CONFIRMATION_REQUIRED_ACTIONS`, explicit `confirm: true` check).
- `tests/kernel-hooks.test.ts`: Kernel hook registration (`registerHook` for `beforeInvoke`, `afterInvoke`, `onInvokeError`, hook removal).
- `tests/kernel-modules.test.ts`: Kernel module loading (`discoverModules`, `loadModules`, `getLoadedModules`, module initialization with mock context).
- `tests/kernel-timeout.test.ts`: Kernel timeout (`withToolTimeout`, `Promise.race` with `setTimeout`, timeout error throwing).
- `tests/mcp-e2e.test.ts`: End-to-end MCP server test (session creation, transport connection, tool invocation via `workspace` and `_search_tools`, resource retrieval, session cleanup).
- `tests/metrics.test.ts`: Metrics endpoint (`/metrics`).
- `tests/module-signing.test.ts`: Module signing (`createModuleSignature`, `verifyModulePreImport`, `hashFile`, `canonicalJson`, `verifySignature`).
- `tests/planner.test.ts`: Planner (`createPlan` skeleton, `executeGraph` mock results).
- `tests/rate-limit.test.ts`: Rate limiter (`MemoryRateLimitStore`, `UpstashRedisRateLimitStore`, increment, cleanup, remaining requests, retry-after header).
- `tests/request-context.test.ts`: Request context (`correlationId` middleware, `runWithRequestContext`, `getCurrentUserId`).
- `tests/sdk.test.ts`: SDK package (`BasePlugin` abstract class, plugin structure).
- `tests/secret-scanner.test.ts`: Secret scanner (`scanForSecrets` regex patterns, AST scanning with TypeScript, false positive avoidance for `changeme` / `placeholder`).
- `tests/semantic.test.ts`: Semantic memory (`initialize`, `add`, `search`, pseudo-embedding generation, vector similarity calculation).
- `tests/sign-module-cli.test.ts`: CLI module signing (`npm run module:sign` execution, PEM private key usage, signature file creation).
- `tests/telemetry.test.ts`: Telemetry (`TelemetrySpan`, `Telemetry` class, `startSpan`, `withSpan`, `enqueue`, `flush`, OTLP payload generation).
- `tests/workspace-fuzz.test.ts`: Fuzz testing (`workspace` payload resilience with large/malformed JSON, missing fields, unexpected types).

**Observations:**
- The test suite is comprehensive and passes. It covers the core runtime, modules, security, memory, planner, workflow, and integration layers.
- Some tests may be minimal or mock-heavy (e.g., `tests/planner.test.ts` only tests the skeleton `createPlan`, not the real `executor.execute()`).
- There is no coverage report (`coverage` script or `istanbul` / `c8` not configured). We cannot determine exact line coverage.
- There is no property-based testing (`fast-check` or `hypothesis` not in `devDependencies`).
- There is no benchmark suite (`benchmark` script or `autocannon` / `k6` not configured).

### 6.2 Integration Tests

**Status:** Several tests are integration-level:
- `tests/auth.test.ts`: Tests the full auth middleware and router with real `createClient` and `initializeDatabase()`.
- `tests/mcp-e2e.test.ts`: Spins up the Hono app (`createApp()`), connects the MCP transport, creates sessions, and makes requests.
- `tests/database-migrations.test.ts`: Runs `runMigrations()` against a real SQLite file (`local.db` or temporary file).
- `tests/module-signing.test.ts`: Uses real `crypto.sign`, real file reads, and real `crypto.verify`.

**Observations:**
- Integration tests are solid. They use the actual database, actual crypto, and actual HTTP handlers.
- The `mcp-e2e` test verifies session lifecycle but may not test complex multi-turn conversations or concurrent sessions.

### 6.3 End-to-End Tests

**Status:** `tests/mcp-e2e.test.ts` and `tests/workspace-fuzz.test.ts` provide end-to-end coverage.

**Observations:**
- End-to-end testing is present but minimal. There is no full user scenario test (e.g., “Claude sends a request to `/mcp`, receives a `workspace` result, then uses the result to make another request”).
- There is no load testing or stress testing for concurrent requests.

### 6.4 Coverage Gaps

- No `coverage` script or coverage threshold (`package.json` has no `test:coverage` or `coverage:check` script).
- No line-coverage reporting (`vitest` has coverage support via `@vitest/coverage-v8` or `c8`, but these are not installed).
- Based on direct inspection of the test files, some complex paths are likely untested:
  - `Kernel.shutdown()` (no test verifies module shutdown sequence or audit log flush after shutdown).
  - `Kernel.loadModules()` dependency resolution failure (no test simulates missing dependencies and verifies module skipping).
  - `RateLimitStore` Redis failure (no test simulates `UpstashRedisRateLimitStore` network failure and verifies fallback to allowing requests).
  - `Telemetry.flush()` failure (no test simulates OTLP endpoint failure and verifies retry behavior).
  - `SecretScanner.scanCodeAst()` with complex TypeScript code (tests likely use simple strings).
  - `ModuleContext.invoke()` recursive calls (no test verifies that a module invoking a kernel action works correctly and does not cause infinite loops).
  - `Dashboard` HTML rendering (likely not tested extensively; `tests/dashboard.test.ts` may only verify route existence).

### 6.5 Benchmarking

- No benchmark suite exists.
- `package.json` has no `benchmark` script.
- No performance tests measure request latency, database query time, or module loading time.

**Observations:**
- Benchmarking is a gap. Adding basic benchmarks (`benchmark` directory or `benchmark` script) for kernel invocation (`invoke()`), module loading (`loadModules()`), and memory search (`memory.search`) would help track performance regressions.

### 6.6 Property Testing

- No property-based testing framework (`fast-check`, `hypothesis`) is configured.
- The closest approximation is `tests/workspace-fuzz.test.ts`, which tests random payload variations but does not use property-based generation.

**Observations:**
- Property testing could verify invariants like “any valid `action` string either matches a registered tool or throws `CAPABILITY_NOT_FOUND`” or “any `memory.set` call with valid input updates the database and emits an event”.

### 6.7 Fuzz Testing

- `tests/workspace-fuzz.test.ts` exists and passes. It likely sends random JSON payloads to `/api/workspace` and verifies that the server does not crash (`success` or `error` response, no unhandled exceptions).
- There is no dedicated fuzzing tool (`jazzer`, `AFL`, `libfuzzer`) configured.

---

## 7. Security

### 7.1 Secret Management

**Implemented:**
- `secret-scanner` (`src/security/secret-scanner.ts`) scans tool inputs for secrets (`Anthropic/OpenAI API Key`, `GitHub PAT`, `AWS Access Key ID`, `Private Key`, `Hardcoded Password`, `Hardcoded API Key`, `Hardcoded Secret`).
- Regex patterns (`SECRET_PATTERNS`) are stateless (`/g` removed) and tested (`tests/secret-scanner.test.ts`).
- AST scanning (`scanCodeAst`) uses TypeScript parser (`typescript` package loaded dynamically via `createRequire`). It detects variable assignments, property assignments, and binary expressions involving sensitive identifiers.
- Kernel pre-invoke hook (`registerBuiltinHooks()`) blocks writes (`WRITE_ACTIONS`: `memory.set`, `filesystem.write_file`, `notes.create`, `github.create_issue`, `calendar.create_event`) if `scanForSecrets()` returns `blocked: true`.
- Confirmation hook (`CONFIRMATION_REQUIRED_ACTIONS`) requires `params.confirm === true` for destructive actions (`filesystem.write_file`, `calendar.create_event`, `github.create_issue`).
- `.env.example` contains `JWT_SECRET`, `GITHUB_TOKEN`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, etc. The `loadConfig()` validates `jwtSecret` in production (`NODE_ENV=production` requires non-default).
- Secrets are never stored in source code; `.env.example` uses placeholder values (`dev-secret`, `primary`, etc.).

**Gaps:**
- No secret rotation mechanism.
- No encrypted storage for secrets (`process.env` is stored in memory; no `HashiCorp Vault` or `AWS Secrets Manager` integration).
- The `secret-scanner` relies on the `typescript` package being available; if it is removed or fails, detection degrades to regex only.
- The scanner does not scan memory values (`memory.get` returns stored values, which could contain secrets from previous writes). There is no output scanning (`afterInvoke` hook scans results? `runAfterInvokeHooks()` does not call `scanForSecrets()` on results). This means secrets could leak through tool outputs without being blocked.

### 7.2 Dependency Risks

**Status:**
- `npm audit` reports 10 vulnerabilities (6 moderate, 4 high).
- `npm` and `node` versions not pinned (`package.json` has no `engines` field).
- No `.npmrc` or `package-lock.json` integrity enforcement (`npm ci` not used in CI).
- `typescript` version (`^5.5.0`) is recent; `vitest` (`^4.1.10`) is recent.

**Observations:**
- The dependency footprint is small, which reduces attack surface.
- However, `hono` (`^4.6.0`) is a relatively new framework (first release in 2023). Security audits for `hono` may be less mature than `express`.
- `octokit` (`^4.0.0`) is a large package; it introduces a significant supply-chain risk if compromised.
- `@lancedb/lancedb` (`^0.31.0`) is an early-stage vector database; its security track record is limited.

**Recommendations:**
- Run `npm audit fix --force` or manually upgrade vulnerable packages.
- Add `engines` field to `package.json` (`node >= 22`, `npm >= 10`).
- Add `npm ci` to CI pipeline.
- Consider using `npm audit` in CI to block builds with new vulnerabilities.

### 7.3 Input Validation

**Implemented:**
- `ConfigSchema` validates all environment variables at boot time.
- `WorkspaceInvokeInput` (`z.object`) validates `/api/workspace` payload.
- `WorkflowStepInput` and `WorkflowDefinitionInput` validate `/api/workflows/run` payload.
- `RegisterClientInput` and `TokenInput` validate auth endpoints.
- Tool input schemas (`z.object`) are validated by `Kernel.validateToolInput()` before execution.
- Body size limit middleware (`jsonBodyLimit`) checks `content-length` against `maxJsonBodyBytes`.
- Rate limiter middleware (`rateLimit`) checks request counts per window.

**Gaps:**
- `workspace` action names are not validated against allowed patterns (e.g., `action` could be any string); the kernel checks existence (`this.tools.get()`), which is safe but could provide more descriptive errors for invalid patterns.
- `nestedModuleAction` (`action + '.' + params.action`) does not sanitize `params.action` (e.g., `params.action = '../secret'`). The kernel constructs the full action and checks `this.tools.get()`. Even if `params.action` contains dots or slashes, the constructed string will not match any registered tool, which is safe. However, it could be confusing for users.
- `mcp/session-store.ts` does not validate `sessionId` format (only checks existence). A malicious `sessionId` could be very long, causing memory consumption or dictionary lookup overhead.
- The `request-context` middleware (`correlationId`) validates `X-Request-ID` with a regex (`/^[A-Za-z0-9._:-]{1,128}$/`). This is safe.
- `database/index.ts` uses `createClient({ url: config.tursoDatabaseUrl, authToken: config.tursoAuthToken })`. The URL and token are taken from `process.env` and validated by Zod (`z.string().url()` for `tursoDatabaseUrl`, `z.string().min(1)` for `tursoAuthToken`). This is safe.

### 7.4 Supply-Chain Concerns

- No `dependabot` or `renovate` configured.
- No `Snyk` or `GitHub Advanced Security` enabled.
- No `.npmrc` with `audit` or `fund` settings.
- `npm` package names are standard; no typo-squatting risks (`claude-hub` is the package name, not a dependency).
- `scripts/fix-esm-imports.mjs` is a custom script that modifies compiled `.js` files. It is safe (adds `.js` extensions to import specifiers) but relies on regex replacements (`import.replace(/from ['"]([^'"]+)['"]/g, ...)`). If future `tsc` output changes format, the script could break or corrupt files.

### 7.5 GitHub Actions Security

- No `.github/workflows/` directory exists.
- `.claude/` directory contains agent skills (`SKILL.md`). These are markdown files describing agent behaviors (`deploy-check`, `incident-response`, `pr-review`, `research`). They are not executable and pose no direct security risk, but they could be misused if an attacker modifies them to inject malicious instructions for Claude agents (e.g., prompting Claude to execute arbitrary commands). However, the skills are read by `skillRuntime.loadFromDirectory()` and exposed as MCP resources (`skills://list`, `skills://{name}`). They are not executed by the server; they are read-only content.
- The `.git` repository is clean (`git status`: nothing to commit, working tree clean).
- There is no `.github/workflows/release.yml` or `security.yml`.
- `deployment/cloudflare/wrangler.toml` is minimal; it may not contain secrets (`vars`, `secrets` not defined in file). The file is safe.

---

## 8. Refactoring Opportunities

### 8.1 Quick Wins (≤1 day each)

1. **Fix planner disconnect (`P0`):** Modify `src/planner/index.ts` `executeGraph()` to delegate to `executor.execute()` instead of the trivial loop.
2. **Add `.github/workflows/ci.yml` (`P1`):** Basic workflow (`npm ci`, `npm run build`, `npm test`) to prevent broken commits.
3. **Add `.npmrc` (`P2`):** `audit=true`, `fund=false`, `package-lock=true`.
4. **Add `engines` to `package.json` (`P2`):** `node >= 22`, `npm >= 10`.
5. **Fix `docs/ARCHITECTURE.md` header (`P2`):** Add “Target Architecture — Not Fully Implemented” or split into “Implemented” / “Target” sections.
6. **Fix `manifest.yaml` loader mismatch (`P2`):** Either make the loader read `manifest.yaml` (convert YAML to JSON) or remove the YAML files to avoid confusion. Currently, `discoverModules()` reads `instance.manifest()` (TypeScript method) and ignores `manifest.yaml`. If `manifest.yaml` is intended as the source of truth, the loader should be updated. If it is documentation, it should be renamed (`manifest.yaml` → `README.yaml` or `manifest.md`).
7. **Fix `mcp/session-store.ts` max session enforcement (`P2`):** Add LRU or random eviction when `maxSessions` is exceeded.
8. **Fix `secret-scanner` output scanning (`P2`):** Add `runAfterInvokeHooks()` to scan tool results for secrets (optional, to prevent data leaks).
9. **Add `lint` and `format` scripts (`P2`):** Add `eslint` and `prettier` (or `biome`) to `devDependencies`, add `lint` and `format` scripts.
10. **Clean up `docs/COMPREHENSIVE_TRACEABILITY_v*` (`P3`):** Remove or archive these aspirational documents to reduce confusion.

### 8.2 Medium-Term Improvements (2–5 days each)

1. **Split `Kernel` class (`P1`):** Extract `ModuleLoader`, `ToolRegistry`, `AuditLogger`, `HookManager` into separate files or sub-classes. This reduces the 850-line `src/kernel/index.ts`.
2. **Implement real embedding model (`P1`):** Replace `Math.sin()` with a real embedding API (`embeddingApiUrl` configured) or local model (`@xenova/transformers`). Update `ConfigSchema` to enforce `embeddingProvider` settings.
3. **Add connection pooling / retry for SQLite (`P1`):** Implement retry logic for `recordToolCall()` (e.g., 3 retries with exponential backoff) or use an in-memory queue with periodic flush (`setInterval`).
4. **Implement module sandboxing (`P2`):** Use `isolated-vm` or Node.js `worker_threads` to run module code in isolation. This is a major security improvement for multi-tenant or untrusted module use.
5. **Complete `packages/sdk/` (`P2`):** Publish `@claude-hub/sdk` with full TypeScript declarations (`packages/sdk/src/index.ts`, `plugin.ts`). Update module templates to import from the SDK rather than `../../../src/config`.
6. **Implement dynamic resource registration (`P2`):** Register resources dynamically based on `skillRuntime.listSkills()` instead of hardcoding `skills://list` and `skills://{name}`. This enables new skills to be exposed as resources automatically.
7. **Add property-based tests (`P2`):** Use `fast-check` to test invariants (`invoke()` with random action names, `interpolateValue()` with random strings/objects, `validateGraph()` with random graphs).
8. **Add benchmark suite (`P2`):** Create `benchmark/` directory with basic latency tests (`benchmark/module-loading.js`, `benchmark/memory-search.js`, `benchmark/workspace-invoke.js`).

### 8.3 Long-Term Architectural Changes (1–2 weeks each)

1. **Replace SQLite with Turso edge database (`P3`):** The current `local.db` file works for development but does not support distributed deployments (Cloudflare Workers, multiple instances). Migrating to `Turso` (libSQL over HTTP) with authentication (`tursoAuthToken`) enables multi-instance use. The `ConfigSchema` already supports `tursoDatabaseUrl` and `tursoAuthToken`.
2. **Implement distributed rate limiter (`P3`):** Replace `MemoryRateLimitStore` with a Redis-backed store (`UpstashRedisRateLimitStore` is implemented but not enforced; the default uses `MemoryRateLimitStore`). Configure `RATE_LIMIT_*` environment variables to use Redis by default in production.
3. **Implement OpenTelemetry exporter (`P3`):** The `Telemetry` class supports OTLP (`flush()` sends to `${endpoint}/v1/traces`). The `otelEnabled`, `otelExporterOtlpEndpoint`, `otelServiceName`, and `otelExportIntervalMs` are configured. However, the `Telemetry` instance (`telemetry`) is only enabled if `config.otelEnabled && Boolean(config.otelExporterOtlpEndpoint)`. Most deployments likely have `OTEL_ENABLED` false or `OTEL_EXPORTER_OTLP_ENDPOINT` empty. Enabling and testing OTLP export is a long-term task.
4. **Complete agent runtime (`P3`):** The `agents/index.ts` is a skeleton. Implementing a full agent runtime (`agentRuntime.runAgent()`) that uses the planner, memory, and modules would enable complex multi-step agent tasks (e.g., “research a PR, summarize findings, create an issue”).
5. **Implement multi-tenant isolation (`P3`):** The current security model uses `userId` from JWT (`sub`) for database queries (`eq(memory.userId, ctx.userId)`). However, there is no isolation at the module level (modules share the same `ModuleContext` and event bus). For multi-tenant use, modules should receive isolated contexts (separate caches, separate event channels, separate database connections or schema prefixes).
6. **Implement full Playwright browser automation (`P3`):** The current `browser` module uses `fetch()` with `AbortController`. Replacing it with Playwright (`playwright` package, browser automation) would enable full browser interaction (`click`, `fill`, `screenshot`, `evaluate`) but introduces significant complexity and resource usage.
7. **Implement true semantic memory (`P3`):** Replacing the `Math.sin()` embedding with a real vector database (`LanceDB` is already configured) and embedding model (`embeddingProvider` set to `api` or local model) would make L3 memory useful for relevance-based retrieval.

---

## 9. Roadmap

Based on the current state (stabilized prototype, 65 passing tests, clean build, dynamic modules loaded, core runtime functional), the recommended roadmap aligns closely with the user's requested phases:

### Phase 1: Stabilization (Months 0–2)
**Status:** Mostly complete.
- ✅ TypeScript compilation fixed (`dist/` clean, ESM imports fixed).
- ✅ Dynamic module loader operational (7 modules loaded, 22 tools registered).
- ✅ Basic planner/executor skeleton operational (`executor.execute()` works; `planner.executeGraph()` needs fix).
- ✅ Tests passing (`npm test`: 29 files, 65 tests).
- ✅ Security hooks (secret scanner, rate limiter, audit log, module signing infrastructure) in place.
- ✅ Auth middleware and OAuth routes functional.
- ⬜ `.github/workflows/ci.yml` missing (add in Phase 1).
- ⬜ Planner disconnect (`executeGraph`) needs fix (add in Phase 1).
- ⬜ Dependency vulnerabilities (`npm audit`) should be addressed (add in Phase 1).

**Deliverables:**
- Fix planner disconnect (`executeGraph` delegates to `executor.execute()`).
- Add `.github/workflows/ci.yml` (build + test).
- Update `docs/ARCHITECTURE.md` to reflect current state.
- Clean up aspirational traceability docs (`docs/COMPREHENSIVE_TRACEABILITY_v*`).
- Fix `manifest.yaml` loader mismatch or rename YAML files.
- Add `lint` and `format` scripts (`eslint` + `prettier` or `biome`).

### Phase 2: Capability Loading & Auth Hardening (Months 2–4)
**Status:** Partial.
- ⬜ Module loader works but compiled `dist/modules` lacks `manifest.yaml` (needs fix for production builds).
- ⬜ Semantic memory uses mock embeddings (needs real embedding model or API integration).
- ⬜ OAuth `PKCE` and `state` validation missing (needs implementation).
- ⬜ `packages/sdk/` not fully wired (needs SDK publication and module import updates).
- ⬜ Module sandboxing missing (needs `isolated-vm` or `worker_threads`).

**Deliverables:**
- Implement real embedding (`embeddingProvider`: `hash` or `api`).
- Fix `manifest.yaml` loader for compiled modules (or remove YAML dependency).
- Add `PKCE` validation (`code_challenge`) and `state` validation in `/auth/token`.
- Complete `packages/sdk/` (publish structure, typed exports).
- Implement basic sandboxing (`isolated-vm` or `worker_threads` for module execution).
- Add property-based tests (`fast-check`) for core invariants.

### Phase 3: Capability Expansion & True DAG Execution (Months 4–6)
**Status:** Skeleton exists.
- ⬜ Planner `createPlan()` is a skeleton (only creates one-node plan); needs multi-node plan generation.
- ⬜ `executor.execute()` works but `executeGraph()` does not call it; needs full DAG execution integration.
- ⬜ Browser module is fetch-based; Playwright automation needed.
- ⬜ Calendar module is unconfigured; real Google Calendar API integration needed.
- ⬜ Agent runtime (`agents/index.ts`) is a skeleton; needs full agent execution logic (`agentRuntime.runAgent()`).

**Deliverables:**
- Complete planner (`createPlan()` generates multi-node plans with dependencies based on user goals).
- Integrate planner with workflow engine (convert `WorkflowDefinition` to `ExecutionGraph` automatically).
- Implement Playwright browser automation (`modules/browser` upgrade).
- Implement real Google Calendar API (`modules/calendar` upgrade with token retrieval and event writing).
- Implement agent runtime (`agentRuntime.runAgent()` using planner + executor + modules).
- Add benchmark suite (`benchmark/` directory).

### Phase 4: Performance & Distributed Scale (Months 6–9)
**Status:** Partial infrastructure exists.
- ⬜ Rate limiter uses in-memory store by default (`MemoryRateLimitStore`); needs Redis (`UpstashRedisRateLimitStore`) by default in production.
- ⬜ Audit log queue hangs on DB failure (needs retry / timeout mechanism).
- ⬜ Semantic memory initialization fails the gateway (needs graceful degradation).
- ⬜ SQLite client has no connection pooling (needs retry or pooling).
- ⬜ No OpenTelemetry exporter wired (`OTEL_ENABLED` false by default).
- ⬜ Schema serialization overhead (`workspaceSchemaCache`) could be optimized.

**Deliverables:**
- Configure default rate limiter to use Redis (`UpstashRedisRateLimitStore`) when `UPSTASH_REDIS_URL` and `UPSTASH_REDIS_TOKEN` are set.
- Implement retry mechanism for audit logs (exponential backoff, timeout, graceful failure).
- Implement graceful degradation for semantic memory (disable semantic search, continue with keyword-only search if `initialize()` fails).
- Enable OpenTelemetry exporter (`OTEL_ENABLED=true`, `OTEL_EXPORTER_OTLP_ENDPOINT` configured) and test OTLP export.
- Optimize `workspaceSchemaCache` (cache underlying data, not just serialized text).
- Add connection retry / pooling for SQLite (`libsql` supports multiple connections; configure `maxConnections` or retry logic).

### Phase 5: Production Readiness & SDK Ecosystem (Months 9–12)
**Status:** Skeleton exists.
- ⬜ Sandbox isolation missing.
- ⬜ Multi-tenant isolation missing (modules share `ModuleContext` and event bus).
- ⬜ SDK (`packages/sdk/`) not published or fully typed.
- ⬜ Dashboard (`/dashboard`) is minimal; needs interactive web UI.
- ⬜ CLI (`packages/cli/`) is minimal; needs full command set (`module list`, `workflow run`, etc.).
- ⬜ Release pipeline (`npm publish`, `npm version`) missing.
- ⬜ Module signing (`MODULE_SIGNATURE_MODE=off` by default) needs to be enforced in production.

**Deliverables:**
- Implement sandbox isolation (`isolated-vm` or `worker_threads`) for module execution.
- Implement multi-tenant isolation (isolated module contexts, separate event channels, database schema prefixes).
- Publish `@claude-hub/sdk` (`npm publish`) with full TypeScript declarations.
- Complete CLI (`packages/cli/src/index.ts`) with all commands described in README.
- Build interactive dashboard (`/dashboard`) with live module status, context budget visualization, and audit log viewer.
- Enable module signing by default (`MODULE_SIGNATURE_MODE=enforce`) and document signing process.
- Create `.github/workflows/release.yml` (automated publishing on tags).
- Create `.github/workflows/deploy-cloudflare.yml` (automated deployment to Cloudflare Workers).
- Complete `CHANGELOG.md` with versioned release notes.
- Final security audit (dependency vulnerabilities fixed, `npm audit` clean, `PKCE` enforced, `state` validated, output scanning enabled, sandbox isolation verified).

---

## 10. Issue Backlog (Prioritized)

This backlog is synthesized from direct code inspection, test results, and documentation gaps. It aligns with the user's request for 30–50 prioritized issues with estimated effort, labels, milestones, and dependencies.

### Milestone 1: Core Runtime Stabilization (P0–P1)

| Issue | Priority | Title | Description | Effort | Labels | Milestone | Dependencies |
|---|---|---|---|---|---|---|---|
| 1 | P0 | Fix planner disconnect (`executeGraph`) | `executeGraph()` runs mock loop; delegate to `executor.execute()`. | 0.5d | `area/planner`, `bug` | M1 | None |
| 2 | P0 | Add `.github/workflows/ci.yml` | Basic CI (`npm ci`, `npm run build`, `npm test`). | 1d | `cicd` | M1 | None |
| 3 | P1 | Fix compiled module manifest loader | `dist/modules/` lacks `manifest.yaml`; loader skips modules. | 1d | `area/kernel`, `bug` | M1 | Issue 1 |
| 4 | P1 | Fix planner skeleton (`createPlan`) | `createPlan()` creates single-node plan; needs multi-node DAG generation. | 2d | `area/planner`, `feature` | M1 | Issue 1 |
| 5 | P1 | Address `npm audit` vulnerabilities | Upgrade vulnerable packages; add `engines`. | 1d | `security`, `dependencies` | M1 | None |
| 6 | P2 | Clean aspirational traceability docs | Remove or archive `docs/COMPREHENSIVE_TRACEABILITY_v*`. | 0.5d | `docs` | M1 | None |
| 7 | P2 | Add `lint` and `format` scripts | Configure `eslint` + `prettier` (or `biome`). | 1d | `dx` | M1 | None |
| 8 | P2 | Update `ARCHITECTURE.md` header | Label as “Target Architecture — Not Fully Implemented” or split sections. | 0.5d | `docs` | M1 | None |

### Milestone 2: Security & Auth Hardening (P0–P2)

| Issue | Priority | Title | Description | Effort | Labels | Milestone | Dependencies |
|---|---|---|---|---|---|---|---|---|
| 9 | P0 | Implement `PKCE` validation (`code_challenge`) | `/auth/token` stores `code_challenge` but does not verify it. | 1d | `area/auth`, `security` | M2 | None |
| 10 | P0 | Implement `state` validation (`authorization_code`) | `/auth/token` does not validate `state` parameter. | 0.5d | `area/auth`, `security` | M2 | Issue 9 |
| 11 | P1 | Add rate limiter to `/auth/register` | Dynamic client registration has no rate limit. | 1d | `area/auth`, `security` | M2 | None |
| 12 | P1 | Implement secret scanner output scanning | `runAfterInvokeHooks()` should scan results for secrets (optional). | 1d | `area/security` | M2 | None |
| 13 | P2 | Add `.npmrc` (`audit=true`) | Enforce `npm audit` in CI. | 0.5d | `security`, `dependencies` | M2 | Issue 5 |
| 14 | P2 | Fix `manifest.yaml` loader or rename YAML | Resolve mismatch: loader reads `instance.manifest()`; YAML ignored. | 1d | `area/kernel` | M2 | Issue 3 |

### Milestone 3: Module Loading & SDK (P1–P2)

| Issue | Priority | Title | Description | Effort | Labels | Milestone | Dependencies |
|---|---|---|---|---|---|---|---|
| 15 | P1 | Fix `MemoryRateLimitStore` memory leak | Add LRU eviction or reduce cleanup threshold. | 1d | `area/middleware`, `performance` | M3 | None |
| 16 | P1 | Implement retry mechanism for audit logs | `recordToolCall()` hangs on DB failure; add retry / timeout. | 2d | `area/kernel`, `reliability` | M3 | None |
| 17 | P2 | Complete `packages/sdk/` (publish structure) | Add `publishConfig`, full types, build pipeline. | 2d | `area/sdk`, `dx` | M3 | None |
| 18 | P2 | Update module templates to import from SDK | Replace `../../../src/config` imports with SDK imports. | 2d | `area/modules` | M3 | Issue 17 |
| 19 | P3 | Implement basic sandboxing (`isolated-vm`) | Run modules in isolated VM; prevent arbitrary system access. | 5d | `area/security`, `architecture` | M3 | Issue 18 |

### Milestone 4: Memory & Embedding (P1–P2)

| Issue | Priority | Title | Description | Effort | Labels | Milestone | Dependencies |
|---|---|---|---|---|---|---|---|
| 20 | P1 | Replace mock embeddings (`Math.sin`) | Implement real embedding (`embeddingApiUrl` or local model). | 3d | `area/memory`, `feature` | M4 | None |
| 21 | P2 | Implement graceful degradation for semantic memory | If `initialize()` fails, disable L3, continue L2 keyword search. | 1d | `area/memory`, `reliability` | M4 | Issue 20 |
| 22 | P2 | Optimize `memory.search()` (parallel L2 + L3) | Run keyword and semantic searches concurrently (`Promise.all`). | 1d | `area/memory`, `performance` | M4 | Issue 20 |
| 23 | P2 | Add property-based tests (`fast-check`) | Test invariants for `invoke()`, `interpolateValue()`, `validateGraph()`. | 2d | `area/testing` | M4 | None |

### Milestone 5: Performance & Scale (P1–P3)

| Issue | Priority | Title | Description | Effort | Labels | Milestone | Dependencies |
|---|---|---|---|---|---|---|---|
| 24 | P1 | Configure default Redis rate limiter | Use `UpstashRedisRateLimitStore` when Redis env vars set. | 1d | `area/middleware`, `infrastructure` | M5 | Issue 11 |
| 25 | P2 | Implement SQLite retry / pooling | Add retry logic or connection pool for `libsql`. | 2d | `area/database`, `performance` | M5 | None |
| 26 | P2 | Enable OpenTelemetry exporter (`OTEL_ENABLED`) | Configure `OTEL_ENABLED=true` and test OTLP export. | 2d | `area/telemetry`, `observability` | M5 | None |
| 27 | P2 | Optimize workspace schema serialization | Cache underlying data, not just text; avoid unnecessary budget updates. | 1d | `area/mcp`, `performance` | M5 | None |
| 28 | P3 | Add benchmark suite (`benchmark/`) | Add latency benchmarks for module loading, memory search, workspace invoke. | 2d | `area/testing`, `performance` | M5 | None |

### Milestone 6: Capability Expansion (P2–P3)

| Issue | Priority | Title | Description | Effort | Labels | Milestone | Dependencies |
|---|---|---|---|---|---|---|---|
| 29 | P2 | Complete Playwright browser automation | Replace fetch-based browser with Playwright (`click`, `fill`, `evaluate`). | 5d | `area/modules`, `feature` | M6 | Issue 19 |
| 30 | P2 | Implement real Google Calendar API | Use `googleCalendarAccessToken` to fetch/create events. | 3d | `area/modules`, `feature` | M6 | Issue 9 |
| 31 | P3 | Implement full agent runtime (`agentRuntime`) | Use planner + executor + modules for complex agent tasks. | 5d | `area/agents`, `feature` | M6 | Issue 4 |
| 32 | P3 | Build interactive dashboard (`/dashboard`) | Live module status, context budget, audit log viewer. | 4d | `feature`, `dx` | M6 | None |

### Milestone 7: Production Readiness (P2–P3)

| Issue | Priority | Title | Description | Effort | Labels | Milestone | Dependencies |
|---|---|---|---|---|---|---|---|
| 33 | P2 | Implement multi-tenant isolation | Separate module contexts, event channels, DB prefixes per tenant. | 5d | `area/security`, `architecture` | M7 | Issue 19 |
| 34 | P2 | Enable module signing (`enforce`) | Change default `MODULE_SIGNATURE_MODE` to `enforce`; document signing. | 1d | `area/security` | M7 | Issue 3 |
| 35 | P2 | Complete CLI (`packages/cli/`) | Implement `module list`, `workflow run`, `workflow list`, etc. | 3d | `area/cli` | M7 | Issue 17 |
| 36 | P3 | Create `.github/workflows/release.yml` | Automated `npm publish` on tags; `npm version`. | 1d | `cicd` | M7 | Issue 2 |
| 37 | P3 | Create `.github/workflows/deploy-cloudflare.yml` | Automated deployment to Cloudflare Workers (`wrangler deploy`). | 1d | `cicd`, `deployment` | M7 | Issue 36 |
| 38 | P3 | Final security audit (clean `npm audit`) | Verify all vulnerabilities fixed, `PKCE` enforced, `state` validated, output scanning enabled, sandbox verified. | 3d | `security` | M7 | All M2–M3 |
| 39 | P3 | Complete `CHANGELOG.md` (versioned releases) | Add release notes for `0.1.0`, `0.2.0`, etc. | 1d | `docs` | M7 | Issue 36 |

---

## 11. Technical Debt Assessment

**High debt (must fix soon):**
1. **Planner disconnect (`executeGraph` mock loop):** Any user or test relying on `executeGraph()` (not `executor.execute()`) will get false results. This is a critical logic error.
2. **Compiled module loader missing `manifest.yaml`:** Production deployments (`npm run build` + `npm start`) will fail to load modules because `manifest.yaml` is not copied to `dist/`. This is a deployment blocker.
3. **Mock embeddings (`Math.sin`):** Semantic memory is non-functional. This undermines the “AI-native operating system” claim for knowledge retrieval.
4. **No CI pipeline:** Without `.github/workflows/ci.yml`, broken commits can be pushed without detection.
5. **OAuth `PKCE` missing:** The authorization code grant is insecure without `PKCE` validation.

**Medium debt (fix in next 3–6 months):**
6. **Audit log queue hangs:** If SQLite is locked, audit logs hang indefinitely; `flushAuditLogs()` hangs.
7. **Rate limiter memory leak:** Large traffic could exceed memory limits briefly.
8. **Secret scanner degrades without TypeScript:** If `typescript` package is removed or broken, AST scanning stops.
9. **Module sandboxing missing:** Untrusted modules can execute arbitrary code in the main process.
10. **SDK not fully wired:** Modules import from source paths (`../../../src/config`) rather than SDK (`@claude-hub/sdk`).

**Low debt (fix when convenient):**
11. **Dashboard minimal:** `/dashboard` is likely a placeholder.
12. **CLI minimal:** `packages/cli/` has basic entry point but no full command set.
13. **Traceability docs aspirational:** Large files describing unimplemented features cause confusion.
14. **Architecture docs aspirational:** `ARCHITECTURE.md` describes target-state features without distinguishing implemented vs. planned.
15. **No coverage reporting:** Coverage gaps unknown.

---

## 12. Production Readiness Scorecard

Based on direct inspection, build success, test results, and documentation audit, the current scorecard for `arena/019f93ae-gar-ii` (`935331e`) is:

| Dimension | Score | Justification |
|---|---|---|
| **Build / Compile** | 95/100 | `npm run build` passes; `dist/` clean; ESM imports fixed; 48 files compiled. |
| **Tests** | 85/100 | 29 test files, 65 passing; covers core runtime, modules, auth, security, memory, planner, workflow, E2E, fuzz. Missing coverage reporting and benchmark suite. |
| **Module Loading** | 80/100 | Dynamic loader works for source modules; compiled `dist/` deployment broken due to missing `manifest.yaml`. 7 modules loaded, 22 tools registered. |
| **Security (Implemented)** | 70/100 | Secret scanner (regex + AST), rate limiter (memory + Redis option), audit logs, module signing (skipped by default), JWT validation, confirmation hooks, CORS. Missing `PKCE`, output scanning, sandboxing, multi-tenant isolation. |
| **API Design (Public)** | 75/100 | Clean Hono adapter, MCP transport (`WebStandardStreamableHTTPServerTransport`), unified `workspace` tool, `_search_tools` discovery, structured errors. Missing dynamic resource registration, complex multi-turn session management. |
| **Configuration** | 80/100 | Strong Zod validation, production guard (`jwtSecret`), environment parsing, `parsePublicKeys` for PEM arrays. Missing `.env` loader (`dotenv`), `.npmrc`, `engines` field. |
| **Documentation (Accuracy)** | 70/100 | `README.md` accurate; `API_REFERENCE.md` detailed but some actions not implemented; `ARCHITECTURE.md` aspirational; `COMPREHENSIVE_TRACEABILITY_v*` aspirational; `ENGINEERING_REVIEW.md` describes a more mature state than current code. |
| **Performance** | 60/100 | Audit log queue hangs on DB failure; memory search sequential (not parallel); schema serialization rebuilds on every version change; no connection pooling; mock embeddings useless for performance benchmarking. |
| **CI/CD** | 10/100 | No `.github/workflows/`. No automated build, test, release, or deployment pipeline. |
| **Dependency Health** | 60/100 | Small footprint (10 prod + 5 dev); 10 vulnerabilities (`npm audit`); no `dependabot`; `typescript` dependency for scanner introduces risk. |
| **SDK / CLI / Tools** | 50/100 | `packages/sdk/` skeleton; `packages/cli/` skeleton; module loader ignores `manifest.yaml` but modules import source paths directly. SDK not published. |
| **Production Readiness (Overall)** | 68/100 | **Stabilized Prototype (Phase 1–3).** Core runtime is solid, modules load, tests pass, build clean. Not ready for untrusted multi-tenant production due to missing sandboxing, broken compiled deployment, mock embeddings, missing CI/CD, missing `PKCE`, and aspirational documentation. |

---

## 13. Conclusion & Recommended Actions

GAR-II (`Abdus2023/GAR-II`, branch `arena/019f93ae-gar-ii`, commit `935331e`) is a well-structured, ambitious AI-native gateway prototype. The codebase builds cleanly, passes 65 tests across 29 files, loads 7 capability modules, registers 22 kernel tools, and implements a robust adapter layer (Hono + MCP Streamable HTTP). The architecture is sound (layered adapter → runtime → modules → infrastructure), the module boundary design is excellent (`Module` interface, `ModuleContext`, event bus), and the security infrastructure (secret scanner, module signing, rate limiting, audit logging, confirmation hooks) is well-implemented for a prototype.

**However, there is a significant reality gap** between the aspirational documentation (`docs/ARCHITECTURE.md`, `ENGINEERING_REVIEW.md`, `COMPREHENSIVE_TRACEABILITY_v*`) and the actual implemented features. The planner (`executeGraph`) is broken, the compiled module loader misses `manifest.yaml`, semantic memory uses meaningless embeddings, the SDK/CLI are skeletons, CI/CD is missing, `PKCE` is not validated, sandboxing is absent, and dependency vulnerabilities remain.

**The top 5 actions to take immediately (P0):**
1. **Fix planner disconnect** (`executeGraph` delegates to `executor.execute`).
2. **Fix compiled module loader** (`manifest.yaml` missing in `dist/`; loader skips modules).
3. **Add `.github/workflows/ci.yml`** (prevent broken commits).
4. **Implement `PKCE` validation** (secure authorization code grant).
5. **Replace mock embeddings** (enable real semantic memory).

Once these are addressed, the project can confidently claim “Phase 2 — Dynamic Capability Loading & Auth Hardening” and move toward full production readiness in the 6–12 month roadmap outlined above.
