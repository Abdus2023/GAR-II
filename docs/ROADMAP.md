# Development Roadmap – Claude Hub Gateway (GAR-II)

## Vision

Build a production-grade, model-agnostic AI runtime that starts as a single MCP connector for Claude Free users and evolves into a capability-based agentic runtime.

## Current Reality: Stabilized Prototype

The repository now has a working TypeScript foundation with dynamic modules, a real GitHub capability, DB-backed OAuth, a DAG executor, semantic memory improvements, dashboard, CLI, SDK structure, migrations, and CI. It is still a **stabilized prototype**, not a fully production-hardened AI operating system.

### Implemented / Stabilized

- MCP Streamable HTTP route with Hono.
- Dynamic kernel module loader.
- Loaded modules: `filesystem`, `github`, `notes`, `search`, `browser` skeleton, `calendar` skeleton, `echo`.
- GitHub tools: `search_repo`, `read_file`, `review_pr`.
- Workspace API + CLI workflow runner.
- DB-backed OAuth client registration and token issuance.
- Strict JWT audience/subject/expiration checks.
- SQLite/libSQL migrations and audit log table.
- DAG executor with dependency validation and per-node timeout.
- Kernel invocation hooks and kernel-level secret scanning.
- Request correlation IDs, body-size limit, rate limiter with optional Upstash Redis store.
- Runtime dashboard at `/dashboard`.
- Typed SDK package structure for `@claude-hub/sdk`.
- Automated tests are in place; GitHub Actions CI remains pending repository workflow permission.

### Still Incomplete

- Secure sandboxing for untrusted modules.
- Module signing/verification operational rollout with trusted keys enforced in production.
- Full Playwright/browser automation.
- Calendar OAuth/refresh-token flow beyond bearer-token REST calls.
- OpenTelemetry exporter.
- Production deployment validation on Cloudflare Workers.
- Enterprise multi-tenant policy/RBAC.
- True semantic embedding model beyond local hashing/API hook.

---

## 6–12 Month Roadmap

| Phase | Timeframe | Focus | Target Outcome |
|---|---:|---|---|
| 1 | Months 0–2 | Stabilization and tests | Reliable prototype, CI, clean build |
| 2 | Months 2–4 | Capability loading and auth | Dynamic modules, GitHub, secure OAuth |
| 3 | Months 4–6 | Capability expansion | Browser/calendar integrations and broader e2e tests |
| 4 | Months 6–9 | Scale and observability | Distributed rate limits, OTEL, dashboard maturity |
| 5 | Months 9–12 | Production hardening and ecosystem | Sandboxing, signing, SDK publishing, release pipeline |

---

## Phase 1 – Stabilization and Testability

**Status:** largely complete.

### Delivered

- TypeScript build succeeds.
- Build output isolated under `dist/`.
- Vitest test suite established.
- MCP transport fixed for Hono/Web Standard requests.
- Node runtime entrypoint added.
- CI build/test workflow added.
- Database migrations added.

### Remaining

- Add coverage thresholds once the suite is broader.
- Add mutation/property/fuzz suites selectively for high-risk code.

---

## Phase 2 – Core Runtime and Capability Loading

**Status:** mostly complete for trusted local modules.

### Delivered

- Dynamic module discovery from `modules/`.
- Namespaced tool registration.
- Module dependency handling.
- Kernel hook lifecycle.
- GitHub module.
- DB-backed OAuth dynamic client registration.
- Structured errors.
- Async audit logging.

### Remaining

- Permission policy enforcement beyond module metadata.
- Confirmation gates for destructive actions.
- Stronger module manifest validation/signature metadata.

---

## Phase 3 – Capability Expansion

**Status:** partially complete.

| Module | Current Status | Next Step |
|---|---|---|
| `filesystem` | Functional local workspace module | Add quotas and content-type limits |
| `github` | Functional read/search/PR review | Add issue/comment/write flows with confirmation |
| `notes` | Functional DB-backed notes | Add content search and summaries |
| `search` | Internal memory/notes search | Add web/search provider abstraction |
| `browser` | Skeleton | Implement Playwright/browserless backend |
| `calendar` | Functional with token | Add OAuth refresh-token flow and attendee/recurrence support |

---

## Phase 4 – Performance, Observability, and Scale

**Status:** started.

### Delivered

- Optional Redis/Upstash-backed rate limiting.
- Request correlation IDs.
- Dashboard data and HTML view.
- Schema caching by registry version.
- Non-blocking audit queue.

### Remaining

- OpenTelemetry trace exporter.
- Metrics endpoint.
- Persistent/distributed audit queue.
- LanceDB file locking for multi-process deployments.
- Cloudflare Workers adapter validation.

---

## Phase 5 – Security Hardening and SDK Ecosystem

**Status:** early.

### Delivered

- Typed SDK package structure.
- CLI workflow runner.
- AST-assisted secret scanner.
- Kernel-level security hook for write payloads.

### Remaining

- Isolate untrusted module execution in workers/VMs.
- Cryptographic module signing and verification (implemented as optional off/warn/enforce mode; production key workflow still needs operationalization).
- SDK package publishing/release automation.
- Plugin marketplace or registry flow.
- RBAC/policy engine for organizations.

---

## Risk and Mitigation

| Risk | Current Mitigation | Remaining Work |
|---|---|---|
| Tool count bloat | Unified `workspace`, `_search_tools`, context budget | Semantic ranking with real embeddings |
| Credential leaks | AST-assisted scanner and kernel hook | Secret manager integration and stronger detections |
| Untrusted code execution | Trusted local modules only | Sandbox/worker isolation |
| Multi-instance rate limits | Optional Upstash Redis store | Cloudflare KV/Redis deployment tests |
| Database drift | Runtime migrations + Drizzle config | Migration review and rollback policy |
| Observability gaps | Logs, audit table, dashboard, correlation IDs | OTEL traces/metrics |

---

This roadmap is living and should be updated after each stabilization milestone.
