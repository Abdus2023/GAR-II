# Claude OS / Agentic-Native Runtime (ANR) — Comprehensive Traceability Documentation (v6 — July 2026)

**Status**: Historical snapshot; superseded for implementation status by v10
**Last Updated**: 2026-07-23
**Scope**: Full architecture, protocol, security, skills system, production operations, and traceability matrix

---

## Supersession Notice

This v6 document is retained for historical context only. It is not the current implementation traceability source.

Use [`COMPREHENSIVE_TRACEABILITY_v10.md`](./COMPREHENSIVE_TRACEABILITY_v10.md) for the current code-to-requirement matrix, test inventory, endpoint list, and production gap assessment.

## 1. Executive Summary & Strategic Core

### The Fundamental Decision

**Build ONE Hub Gateway** that exposes a small set of high-level workspace tools while internally orchestrating hundreds of modular capabilities.

This single decision:
- Satisfies the **Free tier 1-connector limit**
- Delivers 85–93% token reduction vs. naive tool exposure
- Creates a stable public interface while the backend evolves
- Enables model-agnostic future (Claude today, GPT/Gemini tomorrow)

### The Five Principles That Matter Most

1. **One hub, not many connectors** — Architectural superiority, not just a workaround
2. **Skills for *how*, MCP for *what*** — Teach reasoning vs. give system access
3. **Context is the scarcest resource** — Every decision optimizes for token efficiency
4. **Security is foundational, not additive** — Confused deputy, tool poisoning, and secret exposure are real
5. **Design for agents, not REST** — Human-shaped tools beat API-shaped tools

---

## 2. Protocol Ground Truth (MCP 2026-07-28)

### Verified Facts

- **Free tier**: 1 custom remote connector (beta)
- **Mobile setup**: Must configure via claude.ai (syncs to iOS/Android)
- **Transport**: Streamable HTTP (SSE deprecated March 2025)
- **Auth**: OAuth 2.1 + Dynamic Client Registration (DCR)
- **Spec release**: July 28, 2026 (5 days from document date)
- **Key changes in 2026-07-28**:
  - Stateless core (horizontal scaling on Cloudflare Workers)
  - Server Cards (`/.well-known/mcp/server-card.json`)
  - MCP Apps (embedded UIs in sandboxed iframes)
  - Tasks extension (long-running work)
  - Extensions framework + formal deprecation policy (12-month window)

### Tool Count Reality

- Practical accuracy boundary: **≤10 tools per context**
- Research shows accuracy collapses after 30–50 tools
- Cursor hard limit: 40 MCP tools
- GitHub Copilot hard limit: 128 MCP tools

**Implication**: The Hub Gateway pattern is mandatory, not optional.

---

## 3. Architecture Layers (Updated)

### Layer 1 — Clients
Claude Mobile / Desktop / Code / Web / API / Enterprise

### Layer 2 — Edge (Cloudflare)
CDN caching, DDoS protection, global routing

### Layer 3 — Hub Gateway (Hono + Bun)
- Rate Limiter → Auth (JWT + DPoP) → Threat Scanner → Router
- Server Cards + Tool Search + Code Mode Sandbox
- Single MCP endpoint visible to Claude

### Layer 4 — Kernel
Manifest-driven module loader, Tool Registry, Permission Engine, Event Bus, Context Budget Manager, Skill Runtime

### Layer 5 — Intelligence
Planner (DAG), Executor, Memory Engine (L1→L4), Agents, Subagents

### Layer 6 — Modules
filesystem, github, gmail, calendar, browser, search, sql, notes, rag, vision, automation

### Layer 7 — Skills (`.claude/skills/`)
Progressive disclosure (30–50 tokens until triggered), automatic slash commands, auto-invocation support

### Layer 8 — Hooks (`.claude/settings.json`)
PreToolUse, PostToolUse, Stop, Notification — zero token cost automation

### Layer 9 — Plugins (installable bundles)
Skills + Hooks + Agents + MCP definitions in one Git repo

### Layer 10 — Infrastructure
Turso, Upstash Redis, LanceDB, Meilisearch, R2, Inngest, Pino, OpenTelemetry

---

## 4. Skills vs. MCP Servers (Critical Distinction)

| Aspect                    | Skill (`SKILL.md`)                          | MCP Server / Connector                     |
|---------------------------|---------------------------------------------|--------------------------------------------|
| **Purpose**               | Teach *how* to approach a task              | Give *access* to external systems          |
| **Token cost**            | 30–50 until triggered (Level 1)             | Always loaded (hundreds to thousands)      |
| **Loading model**         | Progressive disclosure                      | All schemas upfront (unless Tool Search)   |
| **Execution**             | Instructions only                           | Code execution + API calls                 |
| **Best for**              | Workflows, review processes, checklists     | GitHub, Gmail, databases, file systems     |
| **Infrastructure**        | None (markdown file)                        | Server, auth, database, deployment         |
| **Example**               | "How to review a PR for security"           | "Read a file from GitHub"                  |

**Rule of thumb**: If it requires credentials or live data → MCP. If it teaches reasoning → Skill.

---

## 5. Extension Surface (2026)

### Skills
- Location: `.claude/skills/<name>/SKILL.md`
- Frontmatter controls: triggers, auto-invocation, requires, subagent
- Unified with slash commands

### Hooks
- Location: `.claude/settings.json`
- Events: PreToolUse, PostToolUse, Stop, Notification
- Zero token cost, pure automation
- Can block, modify, or observe

### Plugins
- Installable bundles (Git repos)
- Can contain: Skills + Hooks + Agents + MCP server definitions
- Namespace: `plugin-name:skill-name`

### Subagents
- Isolated context windows
- Domain-specific personas (security-reviewer, code-auditor)
- Built-in: Explore, Plan

### Live Artifacts (shipped July 16, 2026)
- Artifacts can call viewer's own MCP connectors on page load
- Creator credentials never shared
- Self-updating dashboards and reports

### Code Mode (Programmatic Tool Calling)
- Model writes TypeScript that calls tools as functions
- Executes in sandbox
- Only final result returns to model
- 10× faster for multi-step work, dramatically lower token usage

---

## 6. Security Architecture (Non-Negotiable)

### Documented Attack Classes
- Confused deputy (static client ID + cached consent)
- Tool poisoning (hidden instructions in tool descriptions or data)
- Rug pulls, tool shadowing, cross-server attacks
- 24,008 secrets exposed on public GitHub (2,117 still valid)

### Mandatory Controls
- Per-client OAuth consent storage
- JWT audience claim validation on every request
- "iss" parameter in all authorization responses (RFC 9207)
- Tool output treated as untrusted input
- Per-user token storage (never shared)
- Secrets in vault (never in env vars or code)
- Full audit logging for every tool invocation
- Rate limiting + session-wide caps
- Input schema validation (Zod) + threat scanning

### Anti-Patterns to Avoid
- Auto-generating MCP from REST APIs (bloated, confusing)
- Tool descriptions that mirror implementation instead of purpose
- Returning raw API responses
- Stateful servers (post-2026-07-28)
- Blocking on long operations
- Missing idempotency on write operations

---

## 7. Technology Stack (Production-Grade)

| Layer                  | Technology                          | Notes |
|------------------------|-------------------------------------|-------|
| Runtime                | Bun                                 | Fastest, native TS |
| HTTP + MCP             | Hono + @modelcontextprotocol/sdk    | Stateless, Streamable HTTP |
| Validation             | Zod                                 | Schema-first |
| ORM                    | Drizzle                             | Bun-native |
| Primary DB             | Turso (SQLite)                      | Edge, free tier |
| Cache                  | Upstash Redis                       | Serverless |
| Vector                 | LanceDB (local) → Qr                | Zero infra → clustered |
| Search                 | Meilisearch                         | Hybrid keyword + semantic |
| Storage                | Cloudflare R2                       | Free egress |
| Jobs                   | Inngest                             | Durable workflows |
| Auth                   | Better Auth + OAuth 2.1 + DPoP      | Spec compliant |
| Logging                | Pino                                | Structured |
| Observability          | OpenTelemetry + Sentry              | Traces + metrics |
| Frontend (Dashboard)   | React + Vite + Tailwind + Zustand   | Lightweight |
| Deployment (Gateway)   | Cloudflare Workers                  | Edge, free |
| Deployment (Workers)   | Fly.io                              | Persistent compute |

---

## 8. Development Roadmap (Updated)

| Phase | Focus | Key Deliverables |
|-------|-------|------------------|
| **1 (Wk 1-2)** | Foundation | Hono + MCP SDK, OAuth 2.1 + DCR, Server Cards, echo + memory tools, deploy to Cloudflare |
| **2 (Wk 3-4)** | Core Runtime | Kernel (manifest loader, registry, events), L1/L2/L3 memory, Context Budget Manager, Tool Search |
| **3 (Wk 5-8)** | Capabilities | filesystem, github, search, notes, calendar, gmail modules + pagination + error handling |
| **4 (Wk 9-12)** | Intelligence | Planner + DAG executor, Skills runtime, Hooks system, Code Mode sandbox, Live Artifacts support |
| **5 (M4+)** | Platform | Plugin SDK + CLI, Admin dashboard, Enterprise-Managed Auth (Okta), Policy engine, Marketplace |

---

## 9. Traceability Matrix (Expanded)

| Requirement | Architecture Element | Implementation | Phase |
|-------------|----------------------|----------------|-------|
| Free tier 1-connector limit | Hub Gateway | `apps/gateway` | 1 |
| Stateless scaling | 2026-07-28 spec compliance | Hono + external state (Redis/SQLite) | 1 |
| Context efficiency | Hub + Tool Search + Skills | `packages/context` + semantic search | 2 |
| Skills system | Progressive disclosure | `packages/skills` | 4 |
| Hooks automation | Lifecycle events | `.claude/settings.json` + scripts | 4 |
| Plugins | Bundled extensions | `plugin.json` + Git distribution | 5 |
| Live Artifacts | Viewer-driven MCP calls | Artifact runtime + Hub Gateway | 4 |
| Code Mode | Programmatic tool calling | Sandbox module | 4 |
| Enterprise auth | IdP-managed provisioning | `packages/auth/enterprise` | 5 |
| Security (confused deputy) | Per-client consent + audience validation | `packages/auth` | 1–2 |
| Anti-pattern prevention | Design-first tools + threat scanning | Tool registry + security middleware | 2–3 |
| Observability | OpenTelemetry + audit logs | `packages/telemetry` + SQLite audit | 1–2 |
| Model-agnostic | Thin adapter layer | `packages/mcp-server/adapters` | 1+ |

---

## 10. Production Hardening Checklists

### Security (Mandatory)
- [ ] OAuth 2.1 + DCR + audience validation
- [ ] Per-user token storage + DPoP (optional but recommended)
- [ ] Every tool declares permissions in manifest
- [ ] Write/delete operations require confirmation
- [ ] Tool output treated as untrusted
- [ ] Secrets in vault only
- [ ] Full audit logging
- [ ] Rate limiting + session caps
- [ ] Threat scanning on inputs

### Performance
- [ ] ≤10 tools exposed to Claude
- [ ] Tool Search implemented
- [ ] Large results return references
- [ ] All list operations paginated
- [ ] CDN caching on `tools/list` and Server Cards
- [ ] Context Budget Manager active

### Developer Experience
- [ ] `CLAUDE.md` ≤ 200 lines
- [ ] Skills for every repeated workflow
- [ ] Every module has tests and README
- [ ] Health + diagnostics endpoints
- [ ] Server Card deployed

---

## 11. Final Strategic Summary

The architecture that survives the next 5–10 years is:

- **Microkernel** (lifecycle, registry, permissions, events)
- **Single Hub Gateway** (one MCP endpoint, unlimited internal capabilities)
- **Capability-first design** (planner resolves capabilities, not plugins)
- **Skills + MCP separation** (how vs. what)
- **Model-agnostic core** + thin adapters
- **Context Budget Manager** as a first-class citizen
- **Security by design** (confused deputy mitigation from day one)
- **Stateless + edge-deployable** (Cloudflare Workers + Turso)

This document is a historical traceability snapshot. The current implementation source of truth is `COMPREHENSIVE_TRACEABILITY_v10.md`.

**Next immediate action**: Begin Phase 1 implementation of the Hub Gateway with Server Cards, OAuth 2.1 + DCR, and the core `workspace` tool.
