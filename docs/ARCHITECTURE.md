# Claude OS – Technical Architecture (v5 – AI-Native Runtime)

## 1. System Overview

The system is designed as a **microkernel + capability runtime** that exposes a single MCP endpoint to Claude while internally orchestrating hundreds of capabilities.

### Core Principles

- **Everything is a Capability**
- **Model-agnostic core** (Claude is just one adapter)
- **Single Hub Gateway** for Free-tier compatibility
- **≤10 tools per context** enforced by Context Budget Manager
- **Capability-based security** with least privilege
- **Event-driven & loosely coupled**

---

## 2. Layered Architecture

```
┌────────────────────────────────────────────────────────────┐
│                        CLIENTS                             │
│  Claude Mobile │ ChatGPT │ Gemini │ Web │ CLI │ API        │
└────────────────────────────┬───────────────────────────────┘
                             │ MCP / OpenAI / Gemini / REST
┌────────────────────────────▼───────────────────────────────┐
│                    ADAPTER LAYER                           │
│  MCP Adapter │ OpenAI Adapter │ Gemini Adapter │ REST      │
└────────────────────────────┬───────────────────────────────┘
                             │
┌────────────────────────────▼───────────────────────────────┐
│              AGENTIC-NATIVE RUNTIME (ANR)                  │
│  ┌──────────────┬──────────────┬──────────────┐           │
│  │   Kernel     │   Runtime    │ Intelligence │           │
│  │ Registry     │ Planner      │ Context      │           │
│  │ Loader       │ Workflow     │ Memory       │           │
│  │ Permissions  │ Scheduler    │ Search       │           │
│  │ Events       │ Model Router │ Cache        │           │
│  └──────────────┴──────────────┴──────────────┘           │
└────────────────────────────┬───────────────────────────────┘
                             │
┌────────────────────────────▼───────────────────────────────┐
│                 CAPABILITY MODULES                         │
│  filesystem · github · gmail · calendar · browser · sql    │
│  rag · vision · search · notes · automation · custom       │
└────────────────────────────┬───────────────────────────────┘
                             │
┌────────────────────────────▼───────────────────────────────┐
│                   INFRASTRUCTURE                           │
│  Turso · LanceDB · Meilisearch · R2 · Redis · Inngest      │
└────────────────────────────────────────────────────────────┘
```

---

## 3. Kernel (Microkernel)

The kernel is intentionally kept **under 2,000 lines** and contains only:

- Module lifecycle management
- Capability registry & discovery
- Dependency injection container
- Permission engine
- Event bus
- Configuration & secrets abstraction

All business logic lives in modules or higher runtime layers.

---

## 4. Capability Resolution

Instead of calling plugins directly, the runtime resolves **capabilities**:

```ts
// Planner requests
capability: "github.review_pr"

// Runtime finds best provider by:
// - success rate
// - latency
// - cost
// - availability
// - permissions
```

This enables multiple implementations of the same capability (GitHub vs GitHub Enterprise).

---

## 5. Context Budget Manager

Enforces the critical **≤10 tools** rule:

1. Reserve fixed system prompt tokens
2. Reserve current user message
3. Dynamically select ≤10 most relevant tools
4. Retrieve top-k memory results only
5. Compress or drop low-relevance history
6. Final prompt assembly

---

## 6. Memory Graph

The memory system is modeled as a **knowledge graph** rather than flat vectors:

- Entities & relationships
- Project context
- Task graph
- Document graph
- Conversation threads

Retrieval uses hybrid search (keyword + semantic + graph traversal).

---

## 7. Execution Graph (DAG)

Every complex request is turned into a **Directed Acyclic Graph**:

- Nodes = capabilities or agents
- Edges = dependencies
- Parallel execution when possible
- Retry, timeout, compensation per node

This replaces simple "tool call" loops with robust, resumable workflows.

---

## 8. Model Router

The runtime can dispatch work to different models:

- Planning → Claude / GPT-4o
- Vision / OCR → Dedicated vision model
- Embeddings → Local embedding model
- Simple classification → Small fast model

Routing decisions are based on capability, cost, latency, and context size.

---

## 9. Security Model

- Capability-based permissions (not role-based)
- Per-client OAuth consent storage (prevents confused deputy)
- Tool description sanitization
- Confirmation gate for destructive actions
- Full audit trail of every capability invocation
- Secrets never stored in environment variables

---

## 10. Observability

Every layer emits structured telemetry:

- Tool success / failure / latency
- Token usage per request
- Context budget utilization
- Cache hit rates
- Workflow duration & retries

OpenTelemetry + Sentry + custom dashboards.

---

*This architecture allows the system to evolve from a single Claude connector into a general-purpose AI operating system without major rewrites.*