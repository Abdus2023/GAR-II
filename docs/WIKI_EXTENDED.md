# Claude OS / Agentic-Native Runtime (ANR) — Master Extended Documentation Wiki Portal

> **Current implementation status:** Use [`COMPREHENSIVE_TRACEABILITY_v10.md`](./COMPREHENSIVE_TRACEABILITY_v10.md) for the current code-to-requirement matrix. Older v8/v9 wiki material is retained as target-state architecture reference.

Welcome to the official **Extended Documentation Wiki Portal** for **Claude OS / Agentic-Native Runtime (ANR)**.

This portal links the extended architecture guide. For current code status and implementation traceability, use `COMPREHENSIVE_TRACEABILITY_v10.md`; v9 links below are retained as target-state architecture reference.

---

## Current Implementation Source of Truth

| Document | Purpose |
|---|---|
| [`COMPREHENSIVE_TRACEABILITY_v10.md`](./COMPREHENSIVE_TRACEABILITY_v10.md) | Current implementation traceability baseline |
| [`../PROJECT_STATUS.md`](../PROJECT_STATUS.md) | Current maturity, working features, and production gaps |
| [`../README.md`](../README.md) | Current quickstart and runtime overview |
| [`ROADMAP.md`](./ROADMAP.md) | Current 6–12 month roadmap |

Current validation snapshot: `npm run build`, `npm run build:sdk`, and `npm test` pass with **29 test files / 65 tests**.

---

## Target-State Architecture Reference

The original v9 guide remains useful for architecture background and long-range design ideas, but it includes aspirational components that are not implemented yet. Use it for concepts, not current status.

```
                                  EXTENDED DOCUMENTATION WIKI
                                               │
  ┌──────────────────┬──────────────────┬──────┴───────────┬──────────────────┬──────────────────┐
  │                  │                  │                  │                  │                  │
  ▼                  ▼                  ▼                  ▼                  ▼                  ▼
[Traceability v10] [Section I: Ground] [Section II: Engine] [Section III: Opt] [Section IV: Impl] [Section V: Adv]
 (Current Matrix)   (v9 Parts 1-6)     (v9 Parts 7-14)    (v9 Parts 15-17)   (v9 Parts 18-23)   (v9 Parts 24-35)
                                                                                                     │
                                                                                                     ▼
                                                                                             [Section VI: Ext]
                                                                                              (v9 Parts 36-45)
```

### v9 Section Map

- **Section I — Architectural Foundations & Ecosystem Ground Truths**: [v9 Parts 1–6](./COMPREHENSIVE_TRACEABILITY_v9.md#section-i-architectural-foundations--ecosystem-ground-truths)
- **Section II — Core Engine, Memory & Agent Runtime**: [v9 Parts 7–14](./COMPREHENSIVE_TRACEABILITY_v9.md#section-ii-core-engine-memory--agent-runtime)
- **Section III — Context Optimization, Bidirectionality & Protocols**: [v9 Parts 15–17](./COMPREHENSIVE_TRACEABILITY_v9.md#section-iii-context-optimization-bidirectionality--protocols)
- **Section IV — Complete Reference Implementation**: [v9 Parts 18–23](./COMPREHENSIVE_TRACEABILITY_v9.md#section-iv-complete-reference-implementation)
- **Section V — Advanced Protocol Capabilities & Topologies**: [v9 Parts 24–35](./COMPREHENSIVE_TRACEABILITY_v9.md#section-v-advanced-protocol-capabilities--topologies)
- **Section VI — Extension Surface, Automation, Code Mode & Enterprise**: [v9 Parts 36–45](./COMPREHENSIVE_TRACEABILITY_v9.md#section-vi-extension-surface-automation-code-mode--enterprise)

---

## Current Code Base File & Component Reference Index

| Implementation File | Component Role | Current Status Reference |
|---|---|---|
| `src/index.ts` | Hono app composition and lazy bootstrap | [v10 Adapter/Protocol](./COMPREHENSIVE_TRACEABILITY_v10.md#41-adapter-and-protocol-layer) |
| `src/node.ts` | Node HTTP runtime adapter | [v10 Entry Points](./COMPREHENSIVE_TRACEABILITY_v10.md#3-source-of-truth-entry-points) |
| `src/mcp/server.ts` | Streamable HTTP MCP server, workspace tool, resources, session handling | [v10 MCP](./COMPREHENSIVE_TRACEABILITY_v10.md#41-adapter-and-protocol-layer) |
| `src/request-context.ts` | Async user/correlation context for MCP callbacks | [v10 MCP](./COMPREHENSIVE_TRACEABILITY_v10.md#41-adapter-and-protocol-layer) |
| `src/kernel/index.ts` | Dynamic module loader, tool registry, hooks, audit queue, timeouts | [v10 Kernel](./COMPREHENSIVE_TRACEABILITY_v10.md#42-kernel-and-capability-runtime) |
| `src/auth/router.ts` | OAuth dynamic client registration and token issuance | [v10 Auth](./COMPREHENSIVE_TRACEABILITY_v10.md#44-authentication-and-authorization) |
| `src/auth/middleware.ts` | JWT validation and dev auth bypass | [v10 Auth](./COMPREHENSIVE_TRACEABILITY_v10.md#44-authentication-and-authorization) |
| `src/database/schema.ts` | Drizzle schema | [v10 Database](./COMPREHENSIVE_TRACEABILITY_v10.md#45-database-and-persistence) |
| `src/database/migrations.ts` | Runtime migration runner with checksums | [v10 Database](./COMPREHENSIVE_TRACEABILITY_v10.md#45-database-and-persistence) |
| `src/memory/semantic.ts` | LanceDB semantic memory and embeddings | [v10 Memory](./COMPREHENSIVE_TRACEABILITY_v10.md#46-memory-and-retrieval) |
| `src/memory/file-lock.ts` | LanceDB/local file lock guard | [v10 Memory](./COMPREHENSIVE_TRACEABILITY_v10.md#46-memory-and-retrieval) |
| `src/planner/executor.ts` | DAG executor with dependency resolution and timeouts | [v10 Workflow](./COMPREHENSIVE_TRACEABILITY_v10.md#47-workflow-and-planning) |
| `src/workflow/index.ts` | Registered/ad-hoc workflows and interpolation | [v10 Workflow](./COMPREHENSIVE_TRACEABILITY_v10.md#47-workflow-and-planning) |
| `src/security/secret-scanner.ts` | Regex + AST-assisted secret scanner | [v10 Security](./COMPREHENSIVE_TRACEABILITY_v10.md#48-security-controls) |
| `src/security/module-signing.ts` | Ed25519 module signature verification | [v10 Security](./COMPREHENSIVE_TRACEABILITY_v10.md#48-security-controls) |
| `src/security/sign-module.ts` | Module signing CLI helper | [v10 Security](./COMPREHENSIVE_TRACEABILITY_v10.md#48-security-controls) |
| `src/middleware/rate-limit.ts` | Memory/Upstash rate limiter | [v10 Security](./COMPREHENSIVE_TRACEABILITY_v10.md#48-security-controls) |
| `src/middleware/body-size-limit.ts` | API payload size guard | [v10 Security](./COMPREHENSIVE_TRACEABILITY_v10.md#48-security-controls) |
| `src/middleware/correlation-id.ts` | Request correlation IDs | [v10 Observability](./COMPREHENSIVE_TRACEABILITY_v10.md#49-observability-and-operations) |
| `src/telemetry/index.ts` | OTLP/HTTP trace exporter | [v10 Observability](./COMPREHENSIVE_TRACEABILITY_v10.md#49-observability-and-operations) |
| `src/routes/dashboard.ts` | Protected runtime dashboard | [v10 Observability](./COMPREHENSIVE_TRACEABILITY_v10.md#49-observability-and-operations) |
| `src/routes/metrics.ts` | Protected Prometheus metrics | [v10 Observability](./COMPREHENSIVE_TRACEABILITY_v10.md#49-observability-and-operations) |
| `src/routes/api.ts` | HTTP module/workspace/workflow API | [v10 Runtime Surface](./COMPREHENSIVE_TRACEABILITY_v10.md#5-runtime-surface-traceability) |
| `modules/github/src/index.ts` | GitHub search/read/PR/issue capability | [v10 Modules](./COMPREHENSIVE_TRACEABILITY_v10.md#43-capability-modules) |
| `modules/filesystem/src/index.ts` | Workspace-contained filesystem capability | [v10 Modules](./COMPREHENSIVE_TRACEABILITY_v10.md#43-capability-modules) |
| `modules/browser/src/index.ts` | Fetch-based page reader/extractor | [v10 Modules](./COMPREHENSIVE_TRACEABILITY_v10.md#43-capability-modules) |
| `modules/calendar/src/index.ts` | Google Calendar REST client | [v10 Modules](./COMPREHENSIVE_TRACEABILITY_v10.md#43-capability-modules) |
| `packages/cli/src/index.ts` | CLI workflow runner and module listing | [v10 Developer Ecosystem](./COMPREHENSIVE_TRACEABILITY_v10.md#410-developer-ecosystem) |
| `packages/sdk/src/plugin.ts` | Typed plugin SDK contracts | [v10 Developer Ecosystem](./COMPREHENSIVE_TRACEABILITY_v10.md#410-developer-ecosystem) |

---

## Known Target-State Components Not Yet Implemented

These appear in older v8/v9 architecture material but are **not current code**:

- `src/triggers/registry.ts`
- `src/scheduler/jobs/github-poll.ts`
- `src/auth/dpop.ts`
- `src/auth/workload-identity.ts`
- `modules/sandbox/index.ts`
- `src/auth/enterprise-managed.ts`
- `.claude/agents/security-reviewer.md`
- `src/middleware/session-caps.ts`
- full Playwright/browserless automation
- enterprise RBAC/policy engine
- untrusted module sandboxing

---

## Documentation Maintenance Rule

When implementation changes, update [`COMPREHENSIVE_TRACEABILITY_v10.md`](./COMPREHENSIVE_TRACEABILITY_v10.md) first, then update README/status/roadmap documents as needed.

---

*Last Updated: 2026-07-24*  
*Repository Target: Abdus2023/GAR-II (`arena/019f92f7-gar-ii`)*
