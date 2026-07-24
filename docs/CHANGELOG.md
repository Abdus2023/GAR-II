# Changelog — Claude Hub Gateway

All notable changes to this project will be documented in this file.

---

## [Unreleased] — v0.1.0 (Phase 1 Foundation)

### Added
- Initial Hono + MCP SDK gateway
- OAuth 2.1 + Dynamic Client Registration
- Server Cards (`/.well-known/mcp/server-card.json`)
- Core `workspace` tool with 7 high-level actions
- Kernel with manifest-driven module loading
- L1/L2 memory (in-memory + SQLite/Turso)
- Structured error responses
- Pino logging + basic OpenTelemetry
- Cloudflare Workers deployment support

### Security
- JWT audience validation
- Per-user token storage
- Rate limiting (Redis sliding window)
- Threat scanning on tool inputs

---

## [v0.2.0] — Phase 2 (Core Runtime) — *Planned*

### Planned
- Context Budget Manager
- L3 semantic memory (LanceDB)
- Event bus (EventEmitter3)
- Capability-based permission engine
- Tool Search (semantic discovery)
- Meilisearch hybrid search

---

## [v0.3.0] — Phase 3 (Capability Modules) — *Planned*

### Planned
- `filesystem`, `github`, `search`, `notes`, `calendar`, `gmail` modules
- Pagination on all list tools
- Idempotency support on write operations
- Comprehensive error handling + suggestions

---

## [v0.4.0] — Phase 4 (Intelligence) — *Planned*

### Planned
- Planner + DAG execution engine
- Skills runtime (progressive disclosure)
- Hooks system (PreToolUse, PostToolUse, etc.)
- Code Mode sandbox (programmatic tool calling)
- Live Artifacts support
- Multi-agent orchestration

---

## [v1.0.0] — Phase 5 (Platform) — *Planned*

### Planned
- Official Plugin SDK + CLI
- Admin dashboard (React + Vite)
- Enterprise-Managed Authorization (Okta)
- Policy engine
- Public marketplace support

---

*This project follows semantic versioning. Breaking changes will only occur on major version bumps.*