# Comprehensive Engineering Review — Claude Hub Gateway (GAR-II)

| | |
|---|---|
| **Repository** | `Abdus2023/GAR-II` (public) |
| **Branch / Commit** | `arena/019f93e3-gar-ii` @ `935331e6` |
| **Review date** | 2026-07-24 |
| **Method** | 100% file-level audit (86 TS files, ~8.5k LOC) + live verification: `npm ci`, `tsc` build, `vitest` (65/65 pass), `npm audit`, runtime module-loading trace |
| **Scope** | Architecture, code quality, structure, docs, testing, security, refactoring, roadmap, issue backlog |

---

## Executive Summary

GAR-II is a TypeScript/Hono **MCP gateway**: one `workspace` tool exposed to Claude, backed by a microkernel that dynamically discovers, verifies (Ed25519), and dependency-orders capability modules, with layered SQL/vector memory, OAuth/JWT auth, a DAG workflow executor, and a searchable tool registry.

**The codebase is substantially healthier than its own changelog claims and substantially less safe than its security doc claims.** It is a genuinely well-engineered *stabilized prototype*: strict build, broad tests, clean layering, honest happy-path error handling. Blocking production are 4 operational/security defects (default-open auth, spoofable rate limiting, module SSRF, symlink escape), 2 latent design faults (hardcoded kernel policy lists, env-everything secret exposure to modules), and a total absence of CI/CD and release machinery.

### Production Readiness Score — **52 / 100**

| Dimension | Score | Basis |
|---|---:|---|
| Architecture & design | 78 | Strong kernel/loader/hook model; parallel unused plugin contract |
| Code quality | 66 | Clean idioms, but `any`-typed core interfaces, god-class kernel, copy-paste timeouts |
| Security | 42 | Good primitives (JWT, signing, scanner), undermined by F-01…F-07 below |
| Testing | 62 | 65 tests incl. e2e+fuzz; no coverage tooling, no invariant/benchmark/property suites |
| Documentation | 40 | README/roadmap honest; API reference & security doc contradict the code |
| Operations (CI/CD/release/observability) | 28 | No CI, no release process, no graceful shutdown; telemetry hand-rolled |
| **Weighted total** | **52** | Prototype: fit for trusted single-user self-hosting, not for untrusted or multi-tenant use |

### Critical findings (detail in §2 & §6)

| ID | Sev | Finding |
|---|---|---|
| F-01 | 🔴 Critical | **Dev auth bypass is the default** — `NODE_ENV` unset ⇒ any unauthenticated request is admitted as `dev-user` |
| F-02 | 🔴 High | **SSRF** — `browser.open_page`/`extract_content` fetch arbitrary URLs server-side; no private-IP/localhost blocklist |
| F-03 | 🔴 High | **Rate limiter runs pre-auth, trusts spoofable client IP headers, and fails open** |
| F-04 | 🟠 Med-High | **Filesystem containment escape via symlink** (`resolve()` without `realpath()`) |
| F-05 | 🟠 Medium | **Every module receives the full `process.env`** (JWT secret, DB token, API keys) via `ModuleContext` |
| F-06 | 🟠 Medium | **Kernel security policy is hardcoded action lists** — future destructive tools silently bypass confirmation + secret scanning |
| F-07 | 🟠 Medium | **10 dependency vulnerabilities** (drizzle-orm SQLi in identifiers; 4 high-severity CVEs in `sharp` via LanceDB) |

---

## Repository Statistics

| Metric | Value | Metric | Value |
|---|---:|---|---:|
| TypeScript files | 86 (57 src + 29 tests) | Capability modules | 7 (22 tools) |
| Lines of TS (excl. lockfile) | ~8,500 | Built-in kernel tools | 4 |
| Runtime dependencies | 9 | DB tables | 5 (+ migration ledger) |
| Dev dependencies | 5 | MCP-exposed tools | 2 (`workspace`, `_search_tools`) |
| Test files / tests | 29 / 65 (all passing) | Skills (progressive disclosure) | 4 |
| Markdown docs | 36 files, ~6,600 lines | npm audit | 10 vulns (6 mod, 4 high) |
| Largest file | `kernel/index.ts` — 847 LOC | CI pipelines | **0** |

---

## Architecture Diagram

```
                         ┌──────────── Clients ────────────┐
                         │  Claude.ai (MCP)  │  CLI / curl  │
                         └────────┬─────────────────┬───────┘
                          /mcp (SSE/JSON)    /api,/auth,/dashboard
        ┌─────────────────────────▼──────────────────▼────────────────────────┐
        │ ADAPTER — Hono app (src/index.ts)                                   │
        │  CORS ▸ correlation-id ▸ telemetry ▸ logger ▸ rateLimit             │
        │  mcpRouter(per-session transport) │ authRouter │ api │ dashboard    │
        │  health │ metrics │ discovery(.well-known)                          │
        └──┬──────────────────────┬──────────────────────┬───────────────────┘
           │ workspace tool       │ validateAuth (JWT)   │ zod + body-limit
┌──────────▼──────────────────────▼──────────────────────────────────────────┐
│ RUNTIME — Agentic core                                                     │
│  ┌──────────────┐ ┌──────────────┐ ┌───────────────┐ ┌───────────────────┐  │
│  │ Kernel (847) │ │ Planner (s)  │ │ Memory        │ │ Observability     │  │
│  │ ▸ discover() │ │ Executor(DAG)│ │ L2 libSQL     │ │ pino logger       │  │
│  │ ▸ verify sig │ │ WorkflowEng. │ │ L3 LanceDB    │ │ OTLP telemetry    │  │
│  │ ▸ hooks      │ │ Agents (s)   │ │ Hybrid search │ │ /metrics + audit  │  │
│  │ ▸ audit queue│ │ Skills rtime │ │ FileLock      │ │ dashboard         │  │
│  └──────┬───────┘ └──────┬───────┘ └───────┬───────┘ └───────────────────┘  │
│         │ ModuleContext {logger, events, env(⚠), cache, invoke}            │
└─────────┼────────────────┼────────────────┼────────────────────────────────┘
   ┌──────▼───── CAPABILITY MODULES (dynamic import, signature-verified) ─────▼───┐
   │ filesystem⚠ │ github │ browser⚠SSRF │ calendar │ notes │ search │ echo      │
   └──────┬─────────────────────────────────────────────────────────────── ──────┘
          ▼                  INFRASTRUCTURE
   SQLite/Turso (5 tables) │ LanceDB vectors │ Upstash (opt) │ Cloudflare Workers (unvalidated)
(s) = skeleton/placeholder; ⚠ = see findings
```

## Dependency Graph (source-of-truth: static imports)

```
config ─┬─► logger ─► (all)
errors ─► kernel, mcp/server, routes/api
database(schema, migrations) ─► kernel, auth/router, routes/{dashboard,metrics}
kernel ─► mcp/server, routes/{api,dashboard,metrics,health,discovery},
          planner/executor, workflow, agents, index
security/{module-signing, secret-scanner} ─► kernel
security/sign-module ─► (CLI script only)
memory/semantic ─► kernel(builtin memory.set), index
context/budget ─► mcp/server, routes/{dashboard,metrics}
search/tool-search ─► mcp/server, index
skills/runtime ─► mcp/server, routes/dashboard, index
planner ─► mcp/server, workflow
workflow ─► mcp/server, routes/api, routes/dashboard
mcp/session-store ─► mcp/server
telemetry ─► kernel, middleware/telemetry, routes/metrics
modules/* ─► src/config + src/kernel/types ONLY  ✅ (clean inversion)
packages/sdk ─► standalone    packages/cli ─► (HTTP client only)
```

**Verdict:** dependency direction is correct (no module→server internals beyond the two contract imports; no cycles). The single structural anomaly is that `packages/sdk` defines a *second, well-typed plugin contract that nothing consumes* while the actual kernel contract is `any`-typed.

---

# 1. Architecture

## 1.1 Layered architecture

Five layers, cleanly separated: **Adapter** (Hono routers + middleware) → **Gateway** (MCP transport, session store) → **Runtime** (kernel, planner, workflow, memory, skills, budget) → **Capabilities** (dynamically imported modules) → **Infrastructure** (libSQL, LanceDB, Redis/env). Containment is enforced by convention (imports), not tooling — a package boundary or lint rule would make it enforced by construction.

**Strengths**
- Real dynamic loading: directory discovery → pre-import signature verification → default-export instantiation → manifest check → multi-pass dependency resolution → init with injected context → tool registration. This is the hardest part to get right, and it was.
- Progressive disclosure done correctly: `_search_tools` meta-tool + budget-capped `workspace://schema` resource + registry-versioned schema cache.
- Capability modules depend only on `src/config` + `src/kernel/types` — textbook plugins.

**Weaknesses**
- `src/kernel/index.ts` is an 847-line god-class: discovery + verification + initialization + hooks + invocation + timeout + audit + 4 built-in tools + confirmation policy + secret-scan policy. Cohesive theme ("the kernel") but 6 separable responsibilities.
- Two parallel extension contracts: kernel `Module`/`Tool` (`any`-typed) and SDK `Plugin`/`ToolDefinition` (typed) that nothing loads (§2.3).
- `workspace` special actions (`help`, `plan`, `execute_plan`, `run_agent`, `run_workflow`) are implemented as inline `if` chains in the tool handler instead of registered kernel actions — meaning they bypass hooks, audit, timeouts, and discovery that everything else gets for free.

## 1.2 Module boundaries

Each module = directory + default-exported class implementing `Module` (`manifest/initialize/tools/[shutdown]`). Boundaries are respected: no cross-module imports; shared state flows through the injected `events` bus, `cache`, and `invoke`. Abuses: (a) `ModuleContext.config.env = process.env` hands every module **all** process secrets (F-05); (b) `cache` is an untyped shared `Map` per module (fine) but events are untyped strings (no contract on payloads).

## 1.3 Coupling & cohesion

- **Coupling kernel→config/env is high**: singletons everywhere (`export const kernel`, `executor`, `planner`, `contextBudget`, `toolSearch`, `semanticMemory`, `agentRuntime`, `workflowEngine`). Tests work around this by re-`start()`-ing the shared kernel (duplicated boot logs observed). Acceptable for a single-process gateway; blocks per-tenant isolation and parallel test runs.
- **`contextBudget` is shared mutable state mutated per request** (`reset()` at the start of every `workspace` call) — two concurrent MCP sessions corrupt each other's budget accounting (B-07; advisory-only impact).
- **Cohesion is good** at the package level (`auth/`, `memory/`, `mcp/`, `security/` each single-purpose).

## 1.4 API design

Two public surfaces:

1. **MCP**: `workspace` + `_search_tools` + 3 resources. Routing supports bare actions (`notes.create`) and sugar (`action: 'notes', params: {action: 'create'}`). Ergonomic for LLM callers; the shape of `params` per action is discoverable only via trial or `_search_tools` (no JSON-schema advertisement per action — the `inputSchema` zod objects registered by modules are never surfaced to the client).
2. **REST**: `/api/workspace`, `/api/workflows/run`, `/api/modules`, dashboard + metrics (auth-gated), discovery + health (open). Consistent `{success:false,error}` envelopes with status passthrough.

**Gaps:** error payloads from `/api/workspace` leak `availableActions` list on unknown actions (minor info exposure, auth-gated so low risk); no request ID in error bodies (only headers); server card advertises `prompts: true` and `/auth/authorize` which do not exist (B-11/B-19).

## 1.5 Error handling

- `GatewayError` with typed codes + `serializeGatewayError` for transport — good taxonomy, consistent use.
- Kernel error path is exemplary: error hooks fire, audit records the failure, non-Gateway errors are wrapped without losing `cause`.
- **Inconsistency**: modules return `{success:false,...}` instead of throwing, so kernel treats module failures as *successes* (no error hook, no failure audit, HTTP 200). Two contradictory error conventions coexist.
- Timeouts: `Promise.race` everywhere (kernel, executor) — rejection but **no cancellation** (B-09); a hung Octokit/fetch keeps running.
- `serializeGatewayError` passes `details` through to the client verbatim — zod `issues` arrays and `{availableActions}` are fine today, but nothing prevents future details from carrying sensitive internals.

## 1.6 Configuration system

Single zod schema over ~40 env vars with coercion, bounds, `''→undefined` preprocessing, and a `superRefine` production JWT guard — the best single file in the repo. Failures: (a) secrets materialize as `config` fields *and* get re-exposed wholesale as `process.env` to modules (F-05); (b) `NODE_ENV` defaults to the unsafe value (F-01); (c) no runtime config reload (acceptable); (d) three env names (`GITHUB_TOKEN`/`GITHUB_API_TOKEN`) accumulate aliases without deprecation policy.

---

# 2. Code Quality

## 2.1 Bug inventory (each verified in source)

| # | Sev | Location | Bug |
|---|---|---|---|
| B-01 | 🔴 | `src/auth/middleware.ts:14` | Unauthenticated bypass whenever `NODE_ENV!=='production'` and no `Authorization` header; `NODE_ENV` **defaults to development**, so a stock `npm start` deployment is fully open. |
| B-02 | 🔴 | `modules/browser/src/index.ts:144` | SSRF: `fetch(url)` with no scheme/IP allowlist — `http://169.254.169.254/…`, `http://localhost:6379` etc. are fetchable through the gateway. DNS-rebinding TOCTOU unaddressed. |
| B-03 | 🔴 | `src/index.ts:38`, `middleware/rate-limit.ts:100` | Rate limit executes **before** `validateAuth` ⇒ `user:` keying is dead code; falls back to client-controlled `CF-Connecting-IP`/`X-Real-IP`/XFF with no trusted-proxy gate ⇒ rotate a header, reset your quota. |
| B-04 | 🟠 | `middleware/rate-limit.ts:150` | On store failure the limiter **logs and allows the request** (fail-open) — untunable. |
| B-05 | 🟠 | `modules/filesystem/src/index.ts:66` | Containment checks `resolve()`/`relative()` strings only; a symlink inside `WORKSPACE_DIR` pointing outside escapes the jail (no `realpath`). |
| B-06 | 🟠 | `src/kernel/index.ts:70-78` | `WRITE_ACTIONS`/`CONFIRMATION_REQUIRED_ACTIONS` are literal sets; any new destructive tool in any module silently bypasses confirmation + AST secret-scan. |
| B-07 | 🟠 | `src/context/budget.ts`, `mcp/server.ts:107` | Singleton `contextBudget` reset + mutated per request; concurrent sessions race. |
| B-08 | 🟠 | `packages/cli/src/index.ts:109` | `workflow run` does `JSON.parse(file)` unconditionally — the repo's own `examples/workflows/*.yaml` files cannot be executed by the CLI that documents them. |
| B-09 | 🟡 | `kernel/index.ts:552`, `planner/executor.ts:140` | Timeout = `Promise.race`, no abort propagation; timed-out work continues consuming resources. |
| B-10 | 🟡 | `src/routes/health.ts:16` | `/health/diagnostics` (unauthenticated) exposes full tool+module registry — recon surface. |
| B-11 | 🟡 | `auth/router.ts:183`, `routes/discovery.ts:22` | Advertised `authorization_endpoint: /auth/authorize` and server-card `prompts:true` are not implemented. |
| B-12 | 🟡 | `src/search/tool-search.ts:26` | `search()` returns top-N **even when every score is 0** — nonsense queries return plausible-looking tools; `_search_tools` "no results" branch is unreachable in practice. |
| B-13 | 🟡 | `src/kernel/index.ts:520` | `enqueueToolCall` chains unboundedly; full request/response JSON (arbitrary size, possibly containing allowed secrets) persists to `tool_calls` with no truncation/retention. |
| B-14 | 🟡 | `src/node.ts` | No `SIGTERM`/`SIGINT` handling ⇒ every deploy drops in-flight audit writes and module `shutdown()` hooks. |
| B-15 | 🟡 | `src/search/tool-search.ts`, `kernel/index.ts` types | Duplicate `ToolMetadata` definitions (drifted already: one has `requiresConfirmation`, one doesn't). |
| B-16 | 🟡 | `src/logger.ts:8`, `mcp/server.ts:80`, `routes/discovery.ts:15`, `telemetry/index.ts:216` | Version `'0.1.0'` hardcoded in 4 files; none import `package.json`. Guaranteed drift on first release bump. |
| B-17 | 🟡 | `src/memory/...` kernel builtin | `memory.get` does bare `JSON.parse(stored)`; one corrupt row = 500 for that key forever. |
| B-18 | 🟡 | `modules/filesystem/src/index.ts:135` | `search_files` recursion: no depth cap, no cycle detection (symlink loops → stack exhaustion), unbounded result list. |
| B-19 | 🟡 | `kernel/types.ts`, `mcp/server.ts` | `Module.resources()`/`prompts()` contract exists but is **never consumed** — modules cannot actually expose MCP resources/prompts despite the server card claiming `prompts:true`. |
| B-20 | 🟡 | `security/secret-scanner.ts:30` | AST scanning needs `require('typescript')` — a **devDependency**; `npm ci --omit=dev` silently degrades the scanner to regex-only with no warning. |
| B-21 | 🟢 | `middleware/rate-limit.ts:33` | `MemoryRateLimitStore` eviction deletes Map-insertion-oldest, not least-recently-reset — under sustained load, hot clients get re-windowed early (benign). |
| B-22 | 🟢 | `src/mcp/session-store.ts:63` | Capacity eviction sorts all sessions on every `set` at capacity — O(n log n) per insert under load; fine at the 1k cap. |
| B-23 | 🟢 | `src/index.ts:26` | CORS `allowHeaders` lacks `MCP-Protocol-Version` — browser-based MCP clients on newer protocol versions fail preflight. |
| B-24 | 🟢 | `planner/executor.ts:120` | Executor agent/decision nodes return `'(skeleton)'` strings while `execute_plan` is presented as real functionality; planner `createPlan` ignores its `context` arg entirely. |
| B-25 | 🟢 | `docs/API_REFERENCE.md` | Documents workspace actions `files`, `admin`, `task_status`, plus flat `search`/`memory` shapes that **do not exist** in the implementation (see §4). |

## 2.2 Logic errors (non-crash level)

- **B-12** (score-0 search results), **B-21** (eviction order) and the *module-failure-as-success* convention (§1.5) are the three true logic errors: all produce wrong-but-silent behavior.
- `workflow.run` input interpolation merges `{...interpolated, ...inputs}` — caller inputs silently **overwrite** step-valued template results (arguably intended; undocumented).
- Auth code flow deletes the code *before* expiry validation — an expired-code replay returns "expired" the first time and "invalid" afterwards (fine), but the delete-first order also destroys forensic evidence on brute force; swap the checks.

## 2.3 Dead code

| Item | Evidence |
|---|---|
| `Planner.executeGraph()` | Never reaches the kernel — marks nodes "executed" without invoking anything; unreferenced by `mcp/server` (which uses `Executor`). |
| SDK `Plugin`/`ToolDefinition` contract | No loader anywhere consumes `@claude-hub/sdk` types (kernel uses its own `any`-typed `Module`). |
| `Module.resources()/prompts()` | Interface-only; MCP server registers only hardcoded skills/schema resources (B-19). |
| `AgentRuntime` | Returns static skeleton strings; `run_agent` wires users into a stub. Also `planner.runAgent` doubles as second stub path. |
| `contextBudget.addMemoryUsage()` | No callers. `estimateTokens()` duplicated by inline `/4` in server. |
| `modules/echo` | Byte-for-byte duplicate of built-in `echo` tool semantics ⇒ registry ends up with both `echo` and `echo.echo`. |
| `docs/COMPREHENSIVE_TRACEABILITY_v6–v9` | 2,400+ lines superseded by v10 + ENGINEERING_REVIEW; historical but not marked archived. |
| `Planner.createPlan(context)` | Parameter accepted, never read (B-24). |

## 2.4 Duplicate code

- `withTimeout` duplicated verbatim between kernel and executor.
- Token estimate `len/4` in 3 places (budget, server result tracking, skills runtime).
- `ToolMetadata` interface ×2 (B-15); version literal ×4 (B-16).
- Per-module boilerplate (`manifest` shape, `ctx` storage, bind-tools) is 100% repeated across 7 modules → candidate for a base class/factory.
- Schema SQL duplicated across `drizzle/0001_initial_schema.sql` **and** hand-written `migrations.ts` (kept in sync today, no check enforcing it).

## 2.5 Code smells & unsafe patterns

- **`any` saturation at the seams**: `Tool.inputSchema: any`, `ModuleContext` — every field `any`. The SDK proves the team can type this properly; the kernel just doesn't.
- Kernel giant class; `mcp/server.ts` 150-line inline tool handler with `if`-chain routing.
- `params ?? {}` then per-tool zod — good; but built-ins (`memory.set` etc.) have **no** input validation at all (registered with raw `ToolHandler`, zod path only exists for module tools).
- `process.env` passed live into `ModuleContext.config.env` (F-05) — unsafe pattern, not just a smell.
- Error swallowing comments are honest, but `notifyEviction`'s `.catch(() => {})` discards transport-close failures silently (no metric).
- Pino `redact` covers `*.token` etc., but tool audit rows bypass the logger entirely and store raw payloads (B-13).

## 2.6 Complexity hotspots

1. `src/kernel/index.ts` (847) — split into `discovery.ts`, `loader.ts`, `invocation.ts`, `policy.ts`, `builtin-tools.ts`.
2. `src/mcp/server.ts` (356) — extract workspace routing table + `_search_tools` enrichment.
3. `modules/github/src/index.ts` (415) — input schemas fine; client/mocking split suggested for tests.
4. `src/telemetry/index.ts` (248) — hand-rolled OTLP/JSON exporter; replace with `@opentelemetry/sdk-*` (§7).

## 2.7 Performance issues

- **Audit chain serializes every tool call into one promise queue** (B-13) — throughput ceiling of ~1 DB insert per call, head-of-line blocking under concurrency; batch or move to a buffered writer.
- Rate-limit store cleanup is O(n) on counter overflow; session eviction O(n log n) (B-21/B-22) — bounded by caps, acceptable short-term.
- `workspace://schema` rebuilt only on registry change — good; but `getRegisteredTools()` sorts a fresh array per `_search_tools` example generation — trivial.
- `notes.search`/`memory.search` use `%LIKE%` scans — fine at expected scale; add `LIKE` escaping (a query of `%` returns everything — harmless but noisy).
- No benchmark suite at all (§5); kernel invoke path adds ~3 structured-log writes + telemetry span per call — measurable but unmeasured.
- Caching wins unexploited: no caching on LanceDB connect, `verifyModulePreImport` re-hashes entrypoints on every boot (fine), GitHub module re-instantiates Octokit per process only (good).

---

# 3. Project Structure

## 3.1 Directory layout

```
src/        15 domain folders — one responsibility each; no circular imports ✔
modules/    7 capability packages, layout inconsistent: 5 use src/index.ts,
            echo uses index.ts (kernel handles both — but pick one) ⚠
packages/   cli + sdk; tsconfig only exists for sdk ⚠
tests/      flat, mirrors concerns by filename ✔
docs/       19 files + 16 root-level status docs — sprawl ✖
deployment/ cloudflare/ only (wrangler.toml unvalidated) ⚠
examples/   prompts + workflows (2 YAML unusable by CLI — B-08)
```

## 3.2 Naming consistency

- Files: kebab-case throughout ✔; tests `*.test.ts` ✔.
- Tool params are snake_case (`max_bytes`, `pr_number`), config/TS internals camelCase — consistent within each domain, mixed across the boundary (acceptable, but document it).
- Docs: `SHOUTCASE.md` at root vs lowercase in `docs/` ✖; five differently-named "status/next-steps/final" files.

## 3.3 Build system

`tsc` + `scripts/fix-esm-imports.mjs` post-pass that rewrites 48 emitted files' specifiers (fragile-but-working NodeNext workaround; `tsc` with `moduleResolution: bundler` doesn't emit extensions). **Missing**: declaration emit for the main package, sourcemaps explicitly enabled, a linter (no ESLint config at all), a formatter config (no Prettier), pre-commit hooks (husky/lefthook). The SDK builds separately via `build:sdk`, but root build already compiles `packages/**` — two overlapping compile paths.

## 3.4 Dependency management

Lean surface (9 runtime) — good. Risks: `^` ranges everywhere with a lockfile committed (acceptable); `octokit` full meta-package for 3 REST calls (swap for `@octokit/rest` or raw fetch); `@lancedb/lancedb` pulls `@huggingface/transformers` + `sharp` transitively — the **sharp CVEs ride in for nothing the code uses** (hashing embeddings need no transformers). `typescript` is a runtime *loader-time* dependency of the secret scanner but lives in devDependencies (B-20). No Dependabot/renovate config.

## 3.5 CI/CD

**None.** No `.github/`, no pipelines, no status checks. README + ROADMAP both acknowledge this is blocked on "workflow permission" — but nothing stops adding workflows from a token/Fork with the permission, so this is an unforced gap for a public repo claiming hardening.

## 3.6 Release process

Absent: no tags-based flow, no changelog enforcement, no version-bump script, `package.json` still `0.1.0` with 4 hardcoded copies of the version string (B-16). `npm pack` hygiene untested (no `files` field — package would ship src+tests+docs). Suggest: `release-please` + `files: ["dist"]` + `npm publish --provenance` on tags.

---

# 4. Documentation

(36 markdown files, ~6,600 lines — more doc than code by volume.)

| Artifact | Verdict |
|---|---|
| `README.md` | **Good.** Accurate feature/status split, endpoints table, limit list. Two defects: says module signing "not implemented" (it is, two sections up); quickstart omits `db:migrate`. |
| `docs/API_REFERENCE.md` | **Harmful.** Documents actions (`files`, `admin`, `task_status`, flat `search`/`memory` shapes) that don't exist in the router — following it produces 404s. Rewrite from `kernel.getRegisteredToolMetadata()` output (automatable). |
| `docs/ARCHITECTURE.md`, `ROADMAP.md` | Accurate and appropriately humble ("stabilized prototype"), matches observed code. |
| `docs/SECURITY.md` | **Contradicts the code**: mandates "secrets never in environment variables" (all config is env-based), capability permissions per tool (manifests declare them; nothing enforces them), consent records (absent). Either implement or re-label as target-state. |
| `docs/CONTRIBUTING.md` | Reasonable process doc; references "Bun version" — stack is Node/tsx (stale copy). |
| `CHANGELOG.md` | Keep-a-Changelog format, but 0.1.0 entry overclaims ("Complete 5-phase architecture", "4 skills", "Comprehensive documentation") relative to skeleton planner/agents. |
| ADRs | **None.** 5 "COMPREHENSIVE_TRACEABILITY" versions are spec-history, not decision records. Introduce `docs/adr/NNNN-title.md`. |
| `HOW_TO_TEST.md`, `QUICKSTART.md`, root status docs (16) | Duplicative; consolidate. Several describe the pre-stabilization broken state as if current. |
| Inline code docs | Above average — honest `(skeleton)` labels, purpose headers on security-critical files. |

**Doc-debt summary**: the repo's doc problems are *accuracy* (API ref, security, README contradiction) and *volume* (36 files), not absence.

---

# 5. Testing

**Current state: 29 files / 65 tests, all green (12.6 s), zero coverage measurement** (no vitest config, no `coverage` script).

| Category | Inventory | Assessment |
|---|---|---|
| Unit | kernel-hooks, kernel-confirmation, kernel-modules, kernel-timeout, executor, planner, budget, tool search?(via search tests), file-lock, secret-scanner (incl. AST), module-signing, session-store, telemetry, sdk, rate-limit, request-context | Good breadth on the kernel core + security primitives. |
| Integration | database-migrations, github-module, filesystem-module, notes?(filesystem/calendar/github module tests use faked clients), semantic (real LanceDB), auth (real DB + JWT round-trips), dashboard | Solid: modules tested against injected fakes, auth against real libSQL. |
| End-to-end | `mcp-e2e.test.ts` (full initialize→tools/call over HTTP transport), `app-routing.test.ts`, `api-workflow.test.ts`, CLI signer e2e | The money tests exist and pass. |
| Fuzz | `workspace-fuzz.test.ts` — randomized action/param storms through the real app | Present (rare at this maturity); bounded and deterministic? (no seed logging observed — add one). |
| Property | **None** — candidates: path-containment (`resolvePath` never outside root for any input), canonical-JSON round-trip, interpolation idempotence. |
| Benchmarks | **None** — no perf baseline for kernel invoke, schema build, or rate limiter. |

**Coverage gaps (test-to-finding map)**
- No test for: symlink escape (B-05), rate-limit identity/spoofing + ordering (B-03), dev-bypass default (B-01 fires by *omission*), SSRF blocklist (B-02, because none exists), graceful shutdown (B-14), confirmation-invariant over *all registered module tools* (B-06 would have caught drift), `_search_tools` zero-score behavior (B-12), CLI YAML load (B-08).
- Test isolation smell: shared singleton kernel re-`start()`ed per file — passes only because `start()` short-circuits; a failing module load in one file can leak to the next.

---

# 6. Security

## 6.1 Secret management

Env-based secrets with zod validation + pino field redaction ✔; `.env.example` complete ✔; `.gitignore` covers `.env`, `*.pem`, `*.key`, `secrets/` ✔. Violations: **all env secrets are handed to every module** via `ModuleContext.config.env` (F-05) — one vulnerable module exfiltrates the JWT signing key; audit table stores raw tool payloads (B-13); docs/SECURITY says env secrets are banned while the code requires them. Gap: no secrets-rotation story, no KMS option.

## 6.2 Dependency risks (`npm audit`, live)

| Advisory | Severity | Path | Action |
|---|---|---|---|
| GHSA-gpj5-g38j-94v9 — drizzle-orm SQL injection via identifier escaping | High | `drizzle-orm@0.33` direct | Bump to ≥0.45 (breaking — test migrations layer) |
| CVE-2026-33327/-33328/-35590/-35591 in `sharp` via libvips | High ×4 | `@lancedb/lancedb → @huggingface/transformers → sharp` | LanceDB 0.30 pin exists but flagged breaking; alternatively carve `sharp` out (unused by hashing provider) via `overrides` |
| 6 moderate (transitive) | Moderate | various | `npm audit fix` non-breaking pass |

## 6.3 Input validation

Strong where it exists: zod on every module tool + OAuth + workflow routes + config. Holes: built-in kernel tools lack schemas; MCP `workspace.params` is `z.record(z.any())` (by design — but then per-action validation depends on the module having a schema, which built-ins don't); body-size precheck trusts `content-length` only (chunked bodies bypass the early reject — Hono will still buffer it; enforce post-parse size too).

## 6.4 Supply-chain concerns

- Attack surface: dynamic `import()` of file-based modules — mitigated *on paper* by Ed25519 pre-import verification (`off|warn|enforce`), but default mode is `off` and no signed module exists in-repo; **enforce mode is untested in a real boot path**.
- No lockfile integrity CI, no provenance, no dependency review action, no SBOM. 
- Module dev guide would benefit from a "hostile module" sandbox note — sandboxing is roadmap, so **any module is currently fully trusted code with all env secrets** (F-05 compounds this).

## 6.5 GitHub Actions security

N/A — no workflows exist (§3.5). When added: pin actions by SHA, `permissions: contents: read` default, no `pull_request_target` on untrusted forks, use OIDC/npm provenance for releases.

## 6.6 Consolidated security register

(F-01…F-07 from the summary, plus:) F-08 Post-auth `/api/workspace` inherits kernel confirmation gates ✔ but the REST surface offers no special `help` limits; F-09 telemetry exporter sends spans to a configurable endpoint with auth-token absence (header unauthenticated OTLP) — endpoint allowlist recommended; F-10 auth-code brute-force has no attempt counter (rate limit only).

---

# 7. Refactoring Opportunities

## Quick wins (hours, no behavior change)

1. Delete the stale "signing not implemented" README line; regenerate API_REFERENCE from the live registry.
2. Centralize `version` via `package.json` import (kills B-16).
3. Filter score≤0 results in `toolSearch.search` (B-12).
4. Swap delete/expiry order in auth-code redemption; escape `LIKE` wildcards in search queries.
5. Add `SIGTERM/SIGINT → kernel.shutdown()` in `node.ts` (B-14).
6. Guard `memory.get` JSON.parse (B-17); truncate audit payload strings at ~8 KB (B-13).
7. Remove `MCP-Protocol-Version` CORS omission (B-23); mark `Planner.executeGraph`, `addMemoryUsage` dead code for deletion.
8. Add `files: ["dist", "packages"]` to package.json; add `typecheck`/`test` CI workflow skeleton.

## Medium-term (weeks)

9. **Type the kernel contract**: adopt SDK-style generics (`Tool<I,O>`, typed `ModuleContext`, branded `ToolId`), killing `any`-saturation and merging the two plugin contracts into one.
10. **Split the kernel** god-class into `discovery / loader / invocation / policy / builtin-tools` modules (~5 files).
11. **Policy-as-metadata**: modules declare `writes: true`, `requiresConfirmation: true`, `secretsSensitive: true` per tool; kernel derives gates from registration, with a boot-time invariant test (B-06).
12. **Containment hardening**: `realpath` check + depth/cycle guard in the filesystem module (B-05/B-18); SSRF allowlist + DNS-pin in browser module (B-02).
13. **Unify error convention**: modules throw `GatewayError`; kernel maps module `{success:false}` → error for observability parity (or drop the convention, breaking-change documented).
14. Replace hand-rolled OTLP with `@opentelemetry/sdk-trace-node` + exporter; delete 248 LOC.
15. Zod-validate built-in tools (memory.*) through the same `inputSchema` path as modules.
16. Per-module env allowlist: `ModuleContext.config.env = pick(process.env, manifest.env ?? [])` (F-05).

## Long-term (architectural)

17. **Worker-thread sandboxing** for third-party modules (explicit message-passing to a host shim over `ctx.invoke`), prerequisite for `MODULE_SIGNATURE_MODE=enforce` to mean something.
18. **Distributed state plane**: sessions + rate-limit + workflow registry behind interfaces with Upstash/Redis implementations (interfaces already exist for rate-limit — generalize the pattern).
19. **Real agent runtime**: replace planner/agents skeletons with model-driven planning loop; gate behind `experimental` actions until deterministic-executor contracts are testable.
20. **Per-request DI**: kill singletons — a `GatewayRuntime` assembly enabling per-tenant kernels and hermetic parallel tests.
21. Streaming tool results through MCP (chunked, abort-aware) replacing JSON.stringify-everything returns.

---

# 8. Roadmap (6–12 months)

| Phase | Window | Theme | Exit criteria |
|---|---|---|---|
| **1. Stabilization** | Weeks 1–4 | Close 🔴s | F-01/F-02/F-03/F-05 fixed + regression tests; CI green (build/test/audit); drizzle+sharp advisories resolved; docs corrected; graceful shutdown |
| **2. Refactoring** | Months 1–2 | De-risk the core | Kernel split + typed contracts (unified with SDK); policy-as-metadata + invariant tests; error-convention unification; coverage ≥80% lines with CI gate |
| **3. Architecture** | Months 2–4 | Trust boundaries | Module sandbox (worker threads), signature `enforce` in prod profile, per-module env allowlists, Redis-backed sessions/rate-limit, OAuth authorize flow completed |
| **4. Performance** | Months 4–6 | Measure, then tune | Benchmark suite (kernel invoke p95, schema build, tool search); audit batching; streaming results; LanceDB connection pooling; load test 1k MCP sessions |
| **5. Production readiness** | Months 6–12 | Operate it | OTel SDK + dashboards/SLOs; multi-tenant policy/RBAC; release pipeline w/ provenance + SBOM; DR/backup for memory+vectors; Cloudflare Workers validation or documented Node reference deployment; third-party security review |

---

# 9. Issue Backlog (42 issues)

Effort: **S** <½d, **M** ½–2d, **L** 2–5d, **XL** >5d. Milestones: **M1** Stabilization, **M2** Refactoring, **M3** Architecture, **M4** Performance, **M5** Production.

| # | Title | Pri | Effort | Labels | Milestone | Depends on |
|---|---|---|---|---|---|---|
| 1 | Remove silent dev auth bypass (require explicit `ALLOW_DEV_AUTH_BYPASS=true`) | **P0** | S | `security` `auth` | M1 | — |
| 2 | Add SSRF protection to browser module (private-IP/localhost blocklist, DNS resolve+pin) | **P0** | M | `security` `module:browser` | M1 | — |
| 3 | Move rate-limit after auth; key on `sub`; stop trusting client IP headers w/o trusted-proxy flag | **P0** | M | `security` `rate-limit` | M1 | #1 |
| 4 | Fail-closed mode for `/auth/*` when rate-limit store errors | P1 | S | `security` `rate-limit` | M1 | #3 |
| 5 | Filesystem `realpath` containment + symlink escape regression test | **P0** | M | `security` `module:filesystem` | M1 | — |
| 6 | Per-module env allowlist in `ModuleContext` (stop passing `process.env`) | **P0** | M | `security` `kernel` | M1 | — |
| 7 | Fix drizzle-orm GHSA-gpj5-g38j-94v9 (upgrade 0.45+, migration test) | **P0** | M | `security` `dependencies` | M1 | — |
| 8 | Resolve `sharp` CVEs (lancedb upgrade or `overrides` carve-out) | **P0** | S | `security` `dependencies` | M1 | — |
| 9 | Add CI workflow: install, tsc, vitest, audit gate | **P0** | S | `ci/cd` | M1 | — |
| 10 | Graceful shutdown: SIGTERM → kernel.shutdown() → flush audit | P1 | S | `reliability` | M1 | — |
| 11 | Truncate/redact audit payloads; add retention job | P1 | M | `security` `observability` | M1 | — |
| 12 | Policy-as-metadata: confirmation/secret-scan derived from tool registration + invariant test | P1 | L | `refactor` `kernel` `security` | M2 | #6 |
| 13 | Type kernel contracts (merge SDK `Plugin` & kernel `Module` into one typed contract) | P1 | L | `refactor` `types` | M2 | — |
| 14 | Split `kernel/index.ts` god-class (discovery/loader/invocation/policy/builtins) | P1 | L | `refactor` `kernel` | M2 | #13 |
| 15 | zod schemas for built-in memory tools | P1 | S | `kernel` `validation` | M2 | #13 |
| 16 | `_search_tools`: filter zero-score results + test | P1 | S | `bug` | M1 | — |
| 17 | Modules throw `GatewayError` (drop `{success:false}` convention) or kernel maps it | P2 | M | `refactor` `errors` | M2 | #13 |
| 18 | CLI YAML workflow support (or delete YAML examples) | P2 | S | `bug` `cli` `docs` | M2 | — |
| 19 | Centralize version string from package.json (4 call sites) | P2 | S | `tech-debt` | M1 | — |
| 20 | Regenerate API_REFERENCE from live tool registry (script + CI freshness check) | P1 | M | `docs` `tooling` | M2 | #9 |
| 21 | Fix README signing contradiction; consolidate 16 root status docs | P1 | S | `docs` | M1 | — |
| 22 | Rewrite docs/SECURITY.md to match implementation (or implement its claims) | P1 | M | `docs` `security` | M2 | #12 |
| 23 | Add coverage tooling + gate (vitest coverage, ≥80% lines) | P2 | S | `testing` `ci/cd` | M2 | #9 |
| 24 | Property tests: path containment, canonical JSON, interpolation | P2 | M | `testing` | M2 | #5 |
| 25 | Regression tests: dev-bypass default, rate-limit identity/spoofing, SSRF blocklist | **P0** | M | `testing` `security` | M1 | #1 #2 #3 |
| 26 | Kernel timeout → AbortSignal propagation to tool contexts | P2 | M | `reliability` `kernel` | M2 | #13 |
| 27 | Auth: implement `/auth/authorize` or drop advertised endpoint; add code-attempt counter | P1 | L | `auth` `security` | M3 | — |
| 28 | Consume module `resources()/prompts()` in MCP server or remove from contract | P2 | M | `mcp` `api-design` | M2 | #13 |
| 29 | Unauthenticated `/health/diagnostics` registry exposure — gate behind auth | P1 | S | `security` | M1 | — |
| 30 | Audit-queue batching/backpressure | P2 | M | `performance` | M4 | #10 |
| 31 | Body-size limit: enforce post-parse size (chunked bypass) | P2 | S | `security` `api` | M1 | — |
| 32 | Dependabot + dependency-review + SHA-pinned actions | P1 | S | `supply-chain` `ci/cd` | M1 | #9 |
| 33 | Release pipeline: tags, release-please, npm provenance, `files` field | P2 | M | `ci/cd` `release` | M5 | #9 #19 |
| 34 | Replace hand-rolled OTLP with official OTel SDK | P2 | M | `observability` `refactor` | M3 | — |
| 35 | Redis-backed MCP session store (horiz. scaling) | P2 | L | `architecture` | M3 | — |
| 36 | Worker-thread sandbox for untrusted modules + host shim | P2 | XL | `architecture` `security` | M3 | #12 #13 |
| 37 | Default `MODULE_SIGNATURE_MODE=enforce` for production profile + signed in-repo modules | P2 | M | `security` `modules` | M3 | #36 |
| 38 | Real plan generation (LLM-driven planner) replacing skeleton | P3 | XL | `feature` `agents` | M3 | #20 |
| 39 | Agent runtime: replace static skeletons or hide behind `experimental` flag | P2 | S→L | `agents` `api-design` | M3 | #38 |
| 40 | Benchmark suite (kernel invoke p95, schema build, tool search) + load test 1k sessions | P3 | L | `performance` `testing` | M4 | #9 |
| 41 | Streaming tool results over MCP with abort support | P3 | L | `feature` `mcp` `performance` | M4 | #34 |
| 42 | Multi-tenant policy/RBAC layer (per-user module permissions, consent records) | P3 | XL | `feature` `security` `architecture` | M5 | #27 #36 |
| 43 | Per-request DI container (retire singletons; hermetic tests) | P3 | L | `refactor` `architecture` | M3 | #13 #14 |
| 44 | ADR process + backfill 5 key decisions (modules w/o sandbox, env config, single-tool façade, hashing embeddings, SQLite+Turso) | P3 | S | `docs` `process` | M2 | #21 |

**Critical path:** #1→#3→#25 (auth posture), #2/#5 (filesystem+browser), #6→#12→#36→#37 (module trust boundary), #9→#20→#23 (delivery machinery).

---

## Technical Debt Assessment

| Debt class | Principal | Interest if unpaid |
|---|---|---|
| Untyped kernel contract | ~1–2 weeks refactor | Every module/tool change re-verifies `any` manually |
| God-class kernel | 847 LOC | Review velocity + regression risk per change |
| Hardcoded policy lists | 1 day + test | First future destructive tool ships without gates — silent security incident |
| Doc sprawl (36 files) | 2 days | Users trust `API_REFERENCE`/`SECURITY` and get 404s/false comfort |
| Missing CI/release | 1 day to bootstrap | Untested merges into `main`; no provenance trail |
| SQLite+LanceDB local state | design choice | Blocks multi-instance; acceptable for target deployment (single self-host) |
| Skeleton agents/planner | marked honestly | Users invoking `run_agent` get synthetic results — trust erosion |

**Net assessment:** debt is *young, documented, and localized*. Nothing requires a rewrite; everything required is enumerated and sized above.

---

*Review artifacts: `DEEP_ANALYSIS.md` (prior pass, security-focused). This document supersedes it for engineering planning.*
