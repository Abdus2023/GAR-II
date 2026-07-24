# Claude OS / Agentic-Native Runtime (ANR) — Master Extended Documentation Wiki Portal

Welcome to the official **Extended Documentation Wiki Portal** for **Claude OS / Agentic-Native Runtime (ANR)**.

This portal links every technical concept, code implementation, security mandate, protocol specification, and lifecycle hook across all **45 Parts** of the comprehensive architecture guide.

---

## 🧭 Master Extended Wiki Index & Section Map

```
                                  EXTENDED DOCUMENTATION WIKI
                                               │
  ┌──────────────────┬──────────────────┬──────┴───────────┬──────────────────┬──────────────────┐
  │                  │                  │                  │                  │                  │
  ▼                  ▼                  ▼                  ▼                  ▼                  ▼
[Traceability v9] [Section I: Ground] [Section II: Engine] [Section III: Opt] [Section IV: Impl] [Section V: Adv]
 (Master Specs)    (Parts 1 - 6)      (Parts 7 - 14)     (Parts 15 - 17)    (Parts 18 - 23)    (Parts 24 - 35)
                                                                                                     │
                                                                                                     ▼
                                                                                             [Section VI: Ext]
                                                                                              (Parts 36 - 45)
```

---

## 📚 Section Breakdown & Topic Directory

### Section I: Architectural Foundations & Ecosystem Ground Truths
* **[Part 1 — Foundations: What Is MCP and Why Does It Exist?](./COMPREHENSIVE_TRACEABILITY_v9.md#part-1--foundations-what-is-mcp-and-why-does-it-exist)**
  * MCP definition ("USB-C for AI"), 97M SDK downloads, Linux Foundation donation, and LSP lineage.
* **[Part 2 — Transport: How Claude Actually Talks to Your Server](./COMPREHENSIVE_TRACEABILITY_v9.md#part-2--transport-how-claude-actually-talks-to-your-server)**
  * Streamable HTTP vs stdio, SSE deprecation, and OAuth 2.1 specs.
* **[Part 3 — The Current State of Claude Mobile Connectors](./COMPREHENSIVE_TRACEABILITY_v9.md#part-3--the-current-state-of-claude-mobile-connectors)**
  * Free plan beta constraints (1 custom connector) and `claude.ai` web-to-mobile sync.
* **[Part 4 — The MCP 2026-07-28 Specification](./COMPREHENSIVE_TRACEABILITY_v9.md#part-4--the-mcp-2026-07-28-specification)**
  * Stateless core, MCP Apps (embedded iframe UIs), Tasks extension, and 12-month deprecation policy.
* **[Part 5 — The Hub Gateway Pattern](./COMPREHENSIVE_TRACEABILITY_v9.md#part-5--the-hub-gateway-pattern)**
  * Single reverse proxy gateway (`workspace.*`) routing to hundreds of internal capabilities.
* **[Part 6 — Security: The Most Underestimated Part](./COMPREHENSIVE_TRACEABILITY_v9.md#part-6--security-the-most-underestimated-part)**
  * Confused-deputy attack mitigation, tool poisoning defenses, JWT audience validation, and security checklist.

### Section II: Core Engine, Memory & Agent Runtime
* **[Part 7 — The Plugin/Module System Explained](./COMPREHENSIVE_TRACEABILITY_v9.md#part-7--the-pluginmodule-system-explained)**
  * Manifest YAML specs, `Module` interface, Tool Registry, and EventEmitter3 bus.
* **[Part 8 — Memory Architecture Explained](./COMPREHENSIVE_TRACEABILITY_v9.md#part-8--memory-architecture-explained)**
  * L1 Cache -> L2 SQLite -> L3 LanceDB -> L4 Cloudflare R2 Archive and Context Budget Manager.
* **[Part 9 — The Agent Runtime Explained](./COMPREHENSIVE_TRACEABILITY_v9.md#part-9--the-agent-runtime-explained)**
  * Planner DAG, specialized agent roles (Orchestrator, Researcher, Coder, Reviewer), and workflow YAML files.
* **[Part 10 — The Technology Stack, Explained in Depth](./COMPREHENSIVE_TRACEABILITY_v9.md#part-10--the-technology-stack-explained-in-depth)**
  * Bun, Hono, Zod, Drizzle ORM, Turso, Upstash Redis, Inngest, Pino, OpenTelemetry, React + Vite.
* **[Part 11 — The Model-Agnostic Adapter Layer](./COMPREHENSIVE_TRACEABILITY_v9.md#part-11--the-model-agnostic-adapter-layer)**
  * Thin adapters for MCP, OpenAI, Gemini, REST, and CLI.
* **[Part 12 — The Development Roadmap, Explained](./COMPREHENSIVE_TRACEABILITY_v9.md#part-12--the-development-roadmap-explained)**
  * Phased milestone roadmap from Week 1 (Foundation) through Month 4+ (Marketplace).
* **[Part 13 — Complete Project Structure with Explanations](./COMPREHENSIVE_TRACEABILITY_v9.md#part-13--complete-project-structure-with-explanations)**
  * Full monorepo directory layout (`apps/`, `packages/`, `modules/`, `skills/`, `deployment/`).
* **[Part 14 — Complete Summary: Every Concept in One Place](./COMPREHENSIVE_TRACEABILITY_v9.md#part-14--complete-summary-every-concept-in-one-place)**
  * Master rules, 5 architecture layers, and tech stack table.

### Section III: Context Optimization, Bidirectionality & Protocols
* **[Part 15 — The Context Pollution Crisis](./COMPREHENSIVE_TRACEABILITY_v9.md#part-15--the-context-pollution-crisis)**
  * Token bloat breakdown, ≤10 tools rule, and Anthropic MCP Tool Search (85% token reduction).
* **[Part 16 — Sampling and Elicitation: MCP Goes Bidirectional](./COMPREHENSIVE_TRACEABILITY_v9.md#part-16--sampling-and-elicitation-mcp-goes-bidirectional)**
  * Reverse LLM completions (`sampling`) and structured user prompt dialogs (`elicitation`).
* **[Part 17 — The A2A Protocol: Agent-to-Agent Communication](./COMPREHENSIVE_TRACEABILITY_v9.md#part-17--the-a2a-protocol-agent-to-agent-communication)**
  * Distinguishing MCP (agent-to-tool) from A2A (agent-to-agent delegation) and Agent Card security.

### Section IV: Complete Reference Implementation
* **[Part 18 — Complete Implementation: Building the Hub Gateway from Zero](./COMPREHENSIVE_TRACEABILITY_v9.md#part-18--complete-implementation-building-the-hub-gateway-from-zero)**
  * Executable source code for `src/index.ts`, `src/mcp/server.ts`, `src/kernel/index.ts`, `modules/github/index.ts`, `src/auth/middleware.ts`, `src/auth/router.ts`, and `src/database/schema.ts`.
* **[Part 19 — Production Operations](./COMPREHENSIVE_TRACEABILITY_v9.md#part-19--production-operations)**
  * OpenTelemetry setup, rate limiting, Pino logger, `wrangler.toml`, and readiness probes.
* **[Part 20 — Tool Design Patterns and Best Practices](./COMPREHENSIVE_TRACEABILITY_v9.md#part-20--tool-design-patterns-and-best-practices)**
  * Single responsibility, description quality, structured error handling, and idempotency.
* **[Part 21 — The Complete Development Workflow](./COMPREHENSIVE_TRACEABILITY_v9.md#part-21--the-complete-development-workflow)**
  * Local development tunnel setup and developer CLI commands (`claudeos`).
* **[Part 22 — The Full Ecosystem Map](./COMPREHENSIVE_TRACEABILITY_v9.md#part-22--the-full-ecosystem-map)**
  * Universal ASCII diagram mapping Clients -> Gateway -> Kernel -> Intelligence -> Modules -> Infrastructure.
* **[Part 23 — Everything That Matters, in One Final Reference](./COMPREHENSIVE_TRACEABILITY_v9.md#part-23--everything-that-matters-in-one-final-reference)**
  * Key numbers (1 connector, 7 workspace actions, 85% token saving) and 5 production rules.

### Section V: Advanced Protocol Capabilities & Topologies
* **[Part 24 — MCP Server Cards: The Discovery Revolution](./COMPREHENSIVE_TRACEABILITY_v9.md#part-24--mcp-server-cards-the-discovery-revolution)**
  * Implementation of `/.well-known/mcp/server-card.json` (SEP-1649) and HTTP header routing (`Mcp-Method`).
* **[Part 25 — Skills vs. MCP Servers: The Most Important Distinction](./COMPREHENSIVE_TRACEABILITY_v9.md#part-25--skills-vs-mcp-servers-the-most-important-distinction)**
  * Comparing Skills (30-50 tokens) vs MCP Servers (50k+ tokens), progressive loading, `SKILL.md`, and `CLAUDE.md`.
* **[Part 26 — Triggers: MCP Becomes Event-Driven](./COMPREHENSIVE_TRACEABILITY_v9.md#part-26--triggers-mcp-becomes-event-driven)**
  * Trigger registry and Inngest background polling fallback.
* **[Part 27 — Streaming and Reference-Based Results](./COMPREHENSIVE_TRACEABILITY_v9.md#part-27--streaming-and-reference-based-results)**
  * Asynchronous Task Handles and paginated memory reference pointers (`ref_id`).
* **[Part 28 — Advanced Security: DPoP and Workload Identity](./COMPREHENSIVE_TRACEABILITY_v9.md#part-28--advanced-security-dpop-and-workload-identity)**
  * DPoP proof verification and Cloud OIDC Workload Identity Federation.
* **[Part 29 — The Four Enterprise Deployment Topologies](./COMPREHENSIVE_TRACEABILITY_v9.md#part-29--the-four-enterprise-deployment-topologies)**
  * Single-tenant, Multi-tenant row-isolated, Federated gateway, and Edge-cached read-only.
* **[Part 30 — The MCP Registry Ecosystem](./COMPREHENSIVE_TRACEABILITY_v9.md#part-30--the-mcp-registry-ecosystem)**
  * Evaluating 9,400+ community servers, FastMCP framework, and official marketplaces.
* **[Part 31 — Cost Modeling and Optimization](./COMPREHENSIVE_TRACEABILITY_v9.md#part-31--cost-modeling-and-optimization)**
  * Token cost modeling, 4-tier caching strategy, and deterministic cache key hashing.
* **[Part 32 — The Complete Skills System Implementation](./COMPREHENSIVE_TRACEABILITY_v9.md#part-32--the-complete-skills-system-implementation)**
  * Exposing skills as MCP resources (`skills://{name}`) with `SkillRuntime` in TypeScript.
* **[Part 33 — Multi-Agent Patterns in Depth](./COMPREHENSIVE_TRACEABILITY_v9.md#part-33--multi-agent-patterns-in-depth)**
  * Sequential chains, parallel fan-out, hierarchical DAG planning, and `GraphExecutor` code.
* **[Part 34 — Observability Dashboard in Practice](./COMPREHENSIVE_TRACEABILITY_v9.md#part-34--observability-dashboard-in-practice)**
  * OpenTelemetry meter definitions and real-time security anomaly scanning.
* **[Part 35 — The Final Integration Blueprint](./COMPREHENSIVE_TRACEABILITY_v9.md#part-35--the-final-integration-blueprint)**
  * 12-step end-to-end request lifecycle trace and complete architecture map.

### Section VI: Extension Surface, Automation, Code Mode & Enterprise
* **[Part 36 — The Four Layers of Claude Code Extensions (Clarified)](./COMPREHENSIVE_TRACEABILITY_v9.md#part-36--the-four-layers-of-claude-code-extensions-clarified)**
  * Disambiguating Connectors, Skills, Hooks, Plugins, and Subagents.
* **[Part 37 — Hooks: Automation at Every Lifecycle Point](./COMPREHENSIVE_TRACEABILITY_v9.md#part-37--hooks-automation-at-every-lifecycle-point)**
  * Bash hook scripts for secret detection (`detect-secrets.sh`), audit logging (`audit-log.sh`), command safety (`scan-command.sh`), and Slack notifications (`on-complete.sh`).
* **[Part 38 — Programmatic Tool Calling: The Paradigm Shift](./COMPREHENSIVE_TRACEABILITY_v9.md#part-38--programmatic-tool-calling-the-paradigm-shift)**
  * Code Mode sandbox module (`modules/sandbox/index.ts`) enabling 10× speedups via sandboxed TypeScript execution.
* **[Part 39 — Live Artifacts: The Newest MCP Capability](./COMPREHENSIVE_TRACEABILITY_v9.md#part-39--live-artifacts-the-newest-mcp-capability)**
  * Self-updating HTML artifacts calling viewer's MCP connectors on page load.
* **[Part 40 — Enterprise-Managed Authorization: The Okta Integration](./COMPREHENSIVE_TRACEABILITY_v9.md#part-40--enterprise-managed-authorization-the-okta-integration)**
  * Okta/IdP group provisioning and zero-touch authorization workflows.
* **[Part 41 — The Anti-Pattern Catalog (What Not to Build)](./COMPREHENSIVE_TRACEABILITY_v9.md#part-41--the-anti-pattern-catalog-what-not-to-build)**
  * 7 critical anti-patterns (auto-generated REST, verbose descriptions, raw API dumps, stateful servers, blocking tasks, non-idempotency, missing `iss` parameter).
* **[Part 42 — Subagents: Parallel Work with Isolated Context](./COMPREHENSIVE_TRACEABILITY_v9.md#part-42--subagents-parallel-work-with-isolated-context)**
  * Defining custom subagents (`security-reviewer.md`) and session-wide safety caps (`session-caps.ts`).
* **[Part 43 — The MCP Programmatic Tool Calling Best Practices](./COMPREHENSIVE_TRACEABILITY_v9.md#part-43--the-mcp-programmatic-tool-calling-best-practices)**
  * Semantic `_search_tools` implementation and client best practices.
* **[Part 44 — The Complete Integration Matrix](./COMPREHENSIVE_TRACEABILITY_v9.md#part-44--the-complete-integration-matrix)**
  * Full integration surface matrix across Free, Pro, Max, Team, and Enterprise plans.
* **[Part 45 — The Final Production Hardening Checklist](./COMPREHENSIVE_TRACEABILITY_v9.md#part-45--the-final-production-hardening-checklist)**
  * Operational readiness checklists covering security, performance, developer experience, and deployment.

---

## 🛠️ Code Base File & Component Reference Index

| Implementation File | Component Role | Wiki Specification Reference |
|---|---|---|
| `src/index.ts` | Main Hono Entry Point & CORS Setup | [Part 18.1](./COMPREHENSIVE_TRACEABILITY_v9.md#181-entry-point-srcindexts) |
| `src/mcp/server.ts` | Streamable HTTP MCP Server & `workspace` Tool | [Part 18.2](./COMPREHENSIVE_TRACEABILITY_v9.md#182-mcp-server-srcmcpserverts) |
| `src/kernel/index.ts` | Manifest-driven Auto-Discovery Kernel Core | [Part 18.3](./COMPREHENSIVE_TRACEABILITY_v9.md#183-kernel-core-srckernelindexts) |
| `modules/github/index.ts` | GitHub Capability Module (Search, Read, Issue) | [Part 18.4](./COMPREHENSIVE_TRACEABILITY_v9.md#184-github-capability-module-modulesgithubindexts) |
| `src/auth/middleware.ts` | JWT Validation & Audience Claim Verification | [Part 18.6](./COMPREHENSIVE_TRACEABILITY_v9.md#part-18--complete-implementation-building-the-hub-gateway-from-zero) |
| `src/auth/router.ts` | OAuth 2.1 & Dynamic Client Registration (DCR) | [Part 18.7](./COMPREHENSIVE_TRACEABILITY_v9.md#part-18--complete-implementation-building-the-hub-gateway-from-zero) |
| `src/database/schema.ts` | Drizzle ORM SQLite Schema (Memory, Logs, Clients) | [Part 18.8](./COMPREHENSIVE_TRACEABILITY_v9.md#part-18--complete-implementation-building-the-hub-gateway-from-zero) |
| `src/telemetry/index.ts` | OpenTelemetry Tracing & Metrics Instrumentation | [Part 19](./COMPREHENSIVE_TRACEABILITY_v9.md#part-19--production-operations) |
| `src/middleware/rate-limit.ts` | Upstash Redis Sliding Window Rate Limiter | [Part 19](./COMPREHENSIVE_TRACEABILITY_v9.md#part-19--production-operations) |
| `src/logger.ts` | Pino High-Performance Redacted JSON Logger | [Part 19](./COMPREHENSIVE_TRACEABILITY_v9.md#part-19--production-operations) |
| `deployment/cloudflare/wrangler.toml` | Cloudflare Workers Edge Configuration | [Part 19](./COMPREHENSIVE_TRACEABILITY_v9.md#part-19--production-operations) |
| `src/routes/health.ts` | Liveness, Readiness & Diagnostics Endpoints | [Part 19](./COMPREHENSIVE_TRACEABILITY_v9.md#part-19--production-operations) |
| `src/routes/discovery.ts` | MCP Server Card (`.well-known/mcp/server-card.json`) | [Part 24.3](./COMPREHENSIVE_TRACEABILITY_v9.md#243-server-card-implementation) |
| `src/triggers/registry.ts` | Event-Driven Trigger Registry | [Part 26.3](./COMPREHENSIVE_TRACEABILITY_v9.md#263-building-trigger-ready-architecture-today) |
| `src/scheduler/jobs/github-poll.ts` | Inngest Background Polling Job | [Part 26.4](./COMPREHENSIVE_TRACEABILITY_v9.md#264-polling-until-triggers-exist) |
| `src/auth/dpop.ts` | DPoP Proof Validation Middleware | [Part 28.2](./COMPREHENSIVE_TRACEABILITY_v9.md#282-dpop-demonstrating-proof-of-possession) |
| `src/auth/workload-identity.ts` | OIDC Workload Identity Provider Verification | [Part 28.3](./COMPREHENSIVE_TRACEABILITY_v9.md#283-workload-identity-federation) |
| `packages/skills/src/runtime.ts` | Skill Runtime Engine & MCP Resource Provider | [Part 32.1](./COMPREHENSIVE_TRACEABILITY_v9.md#part-32--the-complete-skills-system-implementation) |
| `packages/planner/src/graph.ts` | DAG Execution Graph Scheduler & Executor | [Part 33.2](./COMPREHENSIVE_TRACEABILITY_v9.md#332-the-execution-graph-in-code) |
| `workflows/review-pr.ts` | Sample Multi-Agent Review PR Graph | [Part 33.3](./COMPREHENSIVE_TRACEABILITY_v9.md#333-example-pr-review-execution-graph) |
| `src/telemetry/metrics.ts` | OpenTelemetry Metrics Definitions | [Part 34.1](./COMPREHENSIVE_TRACEABILITY_v9.md#341-what-to-monitor) |
| `src/security/anomaly-detector.ts` | Threat Scanning & Enumeration Detector | [Part 34.2](./COMPREHENSIVE_TRACEABILITY_v9.md#342-security-anomaly-detection) |
| `.claude/hooks/detect-secrets.sh` | PreToolUse Secret Scanner Hook Script | [Part 37.4](./COMPREHENSIVE_TRACEABILITY_v9.md#374-complete-hook-examples) |
| `.claude/hooks/audit-log.sh` | PostToolUse Audit Logger Hook Script | [Part 37.4](./COMPREHENSIVE_TRACEABILITY_v9.md#374-complete-hook-examples) |
| `.claude/hooks/scan-command.sh` | PreToolUse Command Safety Scanner Script | [Part 37.4](./COMPREHENSIVE_TRACEABILITY_v9.md#374-complete-hook-examples) |
| `.claude/hooks/on-complete.sh` | Stop Hook Slack Notification Script | [Part 37.4](./COMPREHENSIVE_TRACEABILITY_v9.md#374-complete-hook-examples) |
| `modules/sandbox/index.ts` | Code Mode Programmatic Execution Sandbox Module | [Part 38.4](./COMPREHENSIVE_TRACEABILITY_v9.md#384-implementing-code-mode-in-your-hub-gateway) |
| `src/auth/enterprise-managed.ts` | Okta / IdP Enterprise-Managed Authorization | [Part 40.2](./COMPREHENSIVE_TRACEABILITY_v9.md#402-the-enterprise-managed-auth-extension) |
| `.claude/agents/security-reviewer.md` | Custom Security Auditor Subagent Specification | [Part 42.2](./COMPREHENSIVE_TRACEABILITY_v9.md#422-defining-custom-subagents) |
| `src/middleware/session-caps.ts` | Session-wide Safety Limit Tracker | [Part 42.3](./COMPREHENSIVE_TRACEABILITY_v9.md#423-session-wide-safety-caps) |

---

*Last Updated: 2026-07-24*  
*Repository Target: Abdus2023/GAR-II (`arena/019f9179-gar-ii`)*
