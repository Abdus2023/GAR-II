# Claude OS / Agentic-Native Runtime (ANR) — Master Documentation Wiki

Welcome to the official **Markdown Wiki and Traceability Documentation Portal** for **Claude OS / Agentic-Native Runtime (ANR)**.

This wiki serves as the authoritative single source of truth for architectural evolution, protocols, security mandates, capability schemas, multi-agent orchestration, and production operations.

---

## 🧭 Navigation Portal & Quick Links

```
                                  DOCUMENTATION WIKI
                                          │
    ┌──────────────────┬──────────────────┼──────────────────┬──────────────────┐
    │                  │                  │                  │                  │
    ▼                  ▼                  ▼                  ▼                  ▼
[Traceability v8]  [Architecture]    [Security Guide]    [Roadmap & Plan]   [Getting Started]
  (Master Specs)    (Deep Dive)        (Threat Model)     (Phases 1 - 5)     (Setup & Connect)
```

### Core Wiki Pages

* **[Comprehensive Traceability Wiki v8](./COMPREHENSIVE_TRACEABILITY_v8.md)** — **Primary Single Source of Truth**. Contains complete requirement mappings, ground truths, architecture diagrams, tool stack specifications, security checklists, manifest standards, and API definitions.
* **[Architecture Reference](./ARCHITECTURE.md)** — Deep-dive into the microkernel runtime, execution DAG scheduler, and memory engine.
* **[Security Architecture & Threat Model](./SECURITY.md)** — Confused-deputy attack mitigation, OAuth 2.0 DCR, state validation, and Secret Scanner protocols.
* **[Phased Development Roadmap](./ROADMAP.md)** — Milestone breakdown from Phase 1 (Foundation) through Phase 5 (Marketplace).
* **[Getting Started & Setup Guide](./GETTING_STARTED.md)** — Quickstart guide to running the local Hub Gateway and connecting Claude Mobile via `claude.ai`.
* **[Module Development Guide](./MODULE_DEVELOPMENT_GUIDE.md)** — Step-by-step instructions for authoring new capability modules and YAML manifests.
* **[Plugin Development Guide](./PLUGIN_DEVELOPMENT_GUIDE.md)** — Guide for creating skills, prompts, and custom slash commands.
* **[API Reference](./API_REFERENCE.md)** — Full specification of the 7 master workspace tools (`workspace.*`).

---

## 🎯 Wiki Index by Topic & Audience

### 1. For System Architects & Technical Leads
* **[Ecosystem Ground Truths (2026)](./COMPREHENSIVE_TRACEABILITY_v8.md#2-verified-ecosystem-ground-truths--protocol-fundamentals-2026)**: Mobile sync rules, Streamable HTTP transport, OAuth DCR, and Linux Foundation Agentic AI Foundation.
* **[The Hub Gateway Pattern](./COMPREHENSIVE_TRACEABILITY_v8.md#24-the-single-hub-connector--gateway-solution)**: Solving Free tier 1-connector limits and connection explosion.
* **[Architectural Generations Evolution](./COMPREHENSIVE_TRACEABILITY_v8.md#5-architectural-generations-evolution-v1-to-v5--anr)**: Tracing system design from Generation v1 (Plugin OS) through Generation ANR (Agentic-Native Runtime).
* **[Model-Agnostic Adapter Layer](./COMPREHENSIVE_TRACEABILITY_v8.md#57-generation-anr-agentic-native-runtime-2026-core)**: Running the same backend with Claude, ChatGPT, Gemini, or local LLMs.

### 2. For Security Engineers & Compliance Teams
* **[Confused Deputy Attack Mitigation](./COMPREHENSIVE_TRACEABILITY_v8.md#71-confused-deputy-attack-mitigation)**: Per-client OAuth consent storage and state nonces.
* **[Security Audit Checklist](./COMPREHENSIVE_TRACEABILITY_v8.md#72-production-security-checklist)**: Checklist for zero-trust tool execution, input sanitization, and audit logging.
* **[Capability-Based Access Control (CBAC)](./SECURITY.md#capability-permissions)**: Scope restrictions per tool and mandatory user confirmation for mutating operations.

### 3. For Backend & Capability Developers
* **[Capability Manifest Standard](./COMPREHENSIVE_TRACEABILITY_v8.md#61-capability-manifest-standard-production-2026)**: YAML specification for tools, prompts, resources, and dependencies.
* **[Lightweight Tool Stack](./COMPREHENSIVE_TRACEABILITY_v8.md#4-lightweight-tool-stack-specifications)**: Bun, TypeScript, Hono, Zod, Turso SQLite, Upstash Redis, Inngest, Cloudflare R2.
* **[Single Hub Connector Tool API](./COMPREHENSIVE_TRACEABILITY_v8.md#11-single-hub-connector-tool-api--external-interfaces)**: Interactive schema for `workspace.search`, `workspace.memory`, `workspace.files`, `workspace.github`, `workspace.workflow`, `workspace.notes`, `workspace.admin`.

### 4. For AI Engineers & Agent Developers
* **[Context Budget Manager (≤10 Tools Rule)](./COMPREHENSIVE_TRACEABILITY_v8.md#8-context-safety-token-efficiency--tool-count-constraints)**: Research-backed token safety boundary and fallback sequence.
* **[Agentic Memory Subsystem (L1–L4)](./COMPREHENSIVE_TRACEABILITY_v8.md#9-agentic-memory-subsystem--universal-search-engine)**: In-memory working cache -> Turso SQLite -> LanceDB vector embeddings -> R2 archive.
* **[Multi-Agent Swarm & DAG Scheduler](./COMPREHENSIVE_TRACEABILITY_v8.md#10-multi-agent-orchestration--workflow-execution-engine)**: Orchestrator, Planner, Researcher, Coder, Reviewer, Debugger, Executor roles and DAG workflow execution.

---

## 📋 Requirement-to-Component Traceability Matrix

| Requirement | Description | Architectural Solution | Wiki Reference |
|---|---|---|---|
| **REQ-01** | Free Tier 1 Remote Connector Limit | Single Hub Gateway (`workspace.*`) | [Section 2.4](./COMPREHENSIVE_TRACEABILITY_v8.md#24-the-single-hub-connector--gateway-solution) |
| **REQ-02** | Claude Mobile Synchronization | Streamable HTTP synced via `claude.ai` | [Section 2.1](./COMPREHENSIVE_TRACEABILITY_v8.md#21-free-plan-reality--mobile-sync-constraints) |
| **REQ-03** | Auth & DCR Support | OAuth 2.0 (6/18 Spec) + DCR | [Section 2.2](./COMPREHENSIVE_TRACEABILITY_v8.md#22-transport-layer--authentication-standards) |
| **REQ-04** | Context Window Safety (≤10 tools) | Context Budget Manager & Tool Search | [Section 8.1](./COMPREHENSIVE_TRACEABILITY_v8.md#81-research-backed-tool-count-boundary-≤10-tools-rule) |
| **REQ-05** | Dynamic Capability Discovery | Manifest-driven Auto-Discovery Kernel | [Section 6.1](./COMPREHENSIVE_TRACEABILITY_v8.md#61-capability-manifest-standard-production-2026) |
| **REQ-06** | Multi-Tier Memory Subsystem | L1 Cache -> L2 Turso -> L3 LanceDB -> L4 R2 | [Section 9.1](./COMPREHENSIVE_TRACEABILITY_v8.md#91-multi-tier-memory-engine-l1-to-l4) |
| **REQ-07** | Deterministic Execution & Planning | Task DAG Scheduler + Agent Swarm | [Section 10.2](./COMPREHENSIVE_TRACEABILITY_v8.md#102-workflow-graph-execution-dag) |
| **REQ-08** | Confused Deputy Mitigation | Per-Client OAuth Consent & State Nonces | [Section 7.1](./COMPREHENSIVE_TRACEABILITY_v8.md#71-confused-deputy-attack-mitigation) |
| **REQ-09** | Model-Agnostic Portability | Thin Adapter Layer (MCP, OpenAI, Gemini) | [Section 5.7](./COMPREHENSIVE_TRACEABILITY_v8.md#57-generation-anr-agentic-native-runtime-2026-core) |
| **REQ-10** | Lightweight Edge Stack | Bun + TS + Hono + Turso + Upstash Redis | [Section 4.1](./COMPREHENSIVE_TRACEABILITY_v8.md#41-backend-architecture-stack) |

---

## 📖 Glossary of Terms

* **ANR (Agentic-Native Runtime)**: A model-agnostic backend execution engine that treats AI models (Claude, ChatGPT, Gemini) as pluggable client adapters.
* **MCP (Model Context Protocol)**: An open standard protocol (donated to the Linux Foundation Agentic AI Foundation) enabling AI models to safely discover and execute remote tools, resources, and prompts over Streamable HTTP JSON-RPC.
* **DCR (Dynamic Client Registration)**: OAuth 2.0 extension allowing AI applications to automatically register credentials with an authentication server at runtime.
* **Hub Gateway**: A microkernel reverse proxy that presents a single remote MCP URL and unified tool namespace (`workspace.*`) to Claude Mobile while fanning out to hundreds of internal capability modules.
* **Context Budget Manager**: Runtime component that measures prompt token consumption and dynamically limits exposed tool schemas to ≤10 per context turn.
* **Confused Deputy Attack**: A security vulnerability where a proxy reuses authorization credentials or static client IDs across sessions, allowing unauthorized users to execute privileged actions.
* **DAG (Directed Acyclic Graph)**: A non-circular graph structure used by the Workflow Execution Engine to execute parallel agentic tasks with clear dependency chains.

---

*Last Updated: 2026-07-24*  
*Repository: Abdus2023/GAR-II (`arena/019f9179-gar-ii`)*
