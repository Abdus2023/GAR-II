# Claude OS / Agentic-Native Runtime (ANR) — Comprehensive Traceability Documentation & Wiki (v8 — July 2026)

> **Status**: Historical target-state wiki; superseded for implementation status by v10
> **Last Updated**: 2026-07-24
> **Target Platform**: Claude Chat Mobile & Desktop (Free Tier Beta & Paid Plans), ChatGPT, Gemini, Local Models
> **Core Architecture**: Agentic-Native Runtime (ANR) / Single Remote MCP Hub Gateway Pattern

---

## Current Implementation Status Addendum — v10 Supersession

This v8 document is retained as an earlier architecture/wiki reference. It contains target-state and aspirational material and should not be used as the current implementation status source.

Use [`COMPREHENSIVE_TRACEABILITY_v10.md`](./COMPREHENSIVE_TRACEABILITY_v10.md) for the current implementation traceability baseline.

Current validated baseline as of 2026-07-24:

- `npm run build`, `npm run build:sdk`, and `npm test` pass.
- Test suite: 28 files / 62 tests passing.
- MCP Streamable HTTP is validated with the official SDK client.
- Dynamic modules, DB-backed OAuth, migrations, dashboard, metrics, telemetry, CLI, SDK, confirmation gates, and module signing support are implemented.
- Remaining blockers include sandboxing, production signature enforcement, Cloudflare validation, RBAC, and deeper browser/calendar workflows.


## 📚 Wiki Table of Contents

1. [Executive Summary, Core Requirements & Traceability Matrix](#1-executive-summary-core-requirements--traceability-matrix)
2. [Verified Ecosystem Ground Truths & Protocol Fundamentals (2026)](#2-verified-ecosystem-ground-truths--protocol-fundamentals-2026)
3. [Modern Claude Architecture (2026)](#3-modern-claude-architecture-2026)
4. [Lightweight Tool Stack Specifications](#4-lightweight-tool-stack-specifications)
5. [Architectural Generations Evolution (v1 to v5 / ANR)](#5-architectural-generations-evolution-v1-to-v5--anr)
   - [5.1 Generation v1: Plugin OS Architecture & Kernel](#51-generation-v1-plugin-os-architecture--kernel)
   - [5.2 Generation v2: Layered AI Kernel & Tool Execution Pipeline](#52-generation-v2-layered-ai-kernel--tool-execution-pipeline)
   - [5.3 Generation v3: Microkernel Architecture & Deterministic Flow](#53-generation-v3-microkernel-architecture--deterministic-flow)
   - [5.4 Generation v4: AI Application Platform](#54-generation-v4-ai-application-platform)
   - [5.5 Generation vX: Self-Describing, Self-Extensible AI-Native Runtime](#55-generation-vx-self-describing-self-extensible-ai-native-runtime)
   - [5.6 Generation v5 / Next: Distributed AI Operating System](#56-generation-v5--next-distributed-ai-operating-system)
   - [5.7 Generation ANR: Agentic-Native Runtime (2026 Core)](#57-generation-anr-agentic-native-runtime-2026-core)
6. [Capability Model & Plugin Manifest Standards](#6-capability-model--plugin-manifest-standards)
7. [Security Architecture, Threat Modeling & Confused Deputy Mitigation](#7-security-architecture-threat-modeling--confused-deputy-mitigation)
8. [Context Safety, Token Efficiency & Tool Count Constraints](#8-context-safety-token-efficiency--tool-count-constraints)
9. [Agentic Memory Subsystem & Universal Search Engine](#9-agentic-memory-subsystem--universal-search-engine)
10. [Multi-Agent Orchestration & Workflow Execution Engine](#10-multi-agent-orchestration--workflow-execution-engine)
11. [Single Hub Connector Tool API & External Interfaces](#11-single-hub-connector-tool-api--external-interfaces)
12. [Monorepo Project Structure & Developer Tooling](#12-monorepo-project-structure--developer-tooling)
13. [Phased Development Roadmap & Production Deployment Strategy](#13-phased-development-roadmap--production-deployment-strategy)
14. [Final Strategic Summary & Architectural Matrix](#14-final-strategic-summary--architectural-matrix)

---

## 1. Executive Summary, Core Requirements & Traceability Matrix

### 1.1 Project Goal
To design and build a **modular, composable, lightweight, mobile-first plugin / connector / skill / agent system** for **Claude Chat** (specifically optimizing for the **Free Plan / Claude Inscription** limits), while establishing an **Agentic-Native Runtime (ANR)** that is model-agnostic and future-proof across Claude, ChatGPT, Gemini, and local LLMs.

### 1.2 Primary Requirements
1. **Free Tier Constraint Bypass**: Support full multi-plugin capabilities within Claude Mobile's beta constraint of **one custom remote MCP connector**.
2. **Mobile Sync & Remote MCP**: Support Remote MCP over Streamable HTTP with OAuth 2.0 (Specs 3/26 & 6/18 with Dynamic Client Registration). Configuration via `claude.ai` web auto-syncs to iOS and Android mobile apps.
3. **Context Window Safety**: Strictly obey the research-backed limit of **≤10 tools exposed per context** to preserve Haiku/Sonnet reasoning accuracy and avoid connection/token explosion.
4. **Microkernel / Hub Gateway Architecture**: Expose a single "Super Connector" / "Hub Gateway" (`workspace.*`) to Claude, while internally dynamically discovering, routing, executing, and orchestrating hundreds of capabilities, skills, workflows, and sub-agents.
5. **Security by Design**: Prevent confused-deputy attacks, tool poisoning, prompt injections, and secret exposure via per-client OAuth consent, state validation, Zod schemas, and audit logging.

### 1.3 Master Requirement-to-Component Traceability Matrix

| Requirement ID | Requirement Description | Architectural Solution | Core Implementation File / Directory |
|---|---|---|---|
| **REQ-01** | Free Tier Single Remote Connector Limit | Single Hub Gateway (`workspace` tool namespace) | `src/mcp/server.ts`, `apps/gateway/` |
| **REQ-02** | Claude Mobile Synchronization | Remote MCP over Streamable HTTP configured via `claude.ai` | `src/routes/discovery.ts`, `src/index.ts` |
| **REQ-03** | Auth & Dynamic Client Registration | OAuth 2.0 (6/18 Spec) + DCR + JWT | `src/auth/router.ts`, `src/auth/middleware.ts` |
| **REQ-04** | Context Window Efficiency (≤10 tools) | Context Budget Manager + Dynamic Tool Discovery | `src/context/budget.ts`, `src/search/tool-search.ts` |
| **REQ-05** | Dynamic Capability & Module Loading | Manifest-driven Auto-Discovery Kernel | `src/kernel/index.ts`, `modules/*/` |
| **REQ-06** | Multi-Tier Memory Subsystem | L1 Cache -> L2 Turso SQLite -> L3 LanceDB -> L4 R2 Archive | `src/database/`, `src/memory/semantic.ts` |
| **REQ-07** | Deterministic Execution & Planning | DAG Task Graph Scheduler + Multi-Agent Swarm | `src/planner/index.ts`, `src/workflow/index.ts` |
| **REQ-08** | Security & Confused Deputy Prevention | Per-client consent, state validation, Secret Scanner | `src/security/secret-scanner.ts`, `src/middleware/` |
| **REQ-09** | Model-Agnostic Portability | Thin Adapter Layer (MCP, OpenAI, Gemini, REST, CLI) | `packages/sdk/`, `src/mcp/server.ts` |
| **REQ-10** | Lightweight Edge Stack | Bun + TS + Hono + Zod + Turso + Upstash Redis | `package.json`, `tsconfig.json` |

---

## 2. Verified Ecosystem Ground Truths & Protocol Fundamentals (2026)

### 2.1 Free Plan Reality & Mobile Sync Constraints
* **Free Plan Beta**: Claude Free users can currently add **one custom remote connector** in beta. Paid plans (Pro, Max, Team, Enterprise) unlock broader connector management.
* **Mobile Configuration Rule**: There is **no UI option to add or configure remote MCP URLs directly inside Claude Mobile apps** (iOS/Android). Users configure remote MCP connectors on [claude.ai](https://claude.ai) web interface, which **automatically syncs** credentials and connector settings across Web, Desktop, and Mobile.
* **Release Timeline**: Mobile Remote MCP support was officially enabled on July 26, 2025. Once synced, Claude Mobile autonomously invokes remote tools, prompts, and resources during conversation when relevant.

### 2.2 Transport Layer & Authentication Standards
* **Supported Transports**: Remote MCP relies on **Streamable HTTP** (the modern standard). SSE (Server-Sent Events) is supported for legacy compatibility but is being deprecated per protocol updates.
* **Authentication Standards**: Supports both authless endpoints and **OAuth 2.0** (implementing Anthropic's 3/26 and 6/18 auth specifications).
* **Dynamic Client Registration (DCR)**: Full support for DCR allows Claude clients to dynamically register client credentials with the remote MCP gateway without manual key exchange.

### 2.3 MCP Ecosystem Scale & Governance
* **Ecosystem Scale**: Over **97 million monthly SDK downloads** (TypeScript/Python) and **10,000+ active MCP servers** globally. Connectors Directory features **400+ verified integrations**.
* **Foundation Donation**: In December 2025, Anthropic donated the Model Context Protocol (MCP) to the **Agentic AI Foundation** under the **Linux Foundation**, co-founded alongside OpenAI, Google, AWS, Microsoft, Block, and others.
* **Protocol Ancestry**: MCP draws structural inspiration from Microsoft's **Language Server Protocol (LSP)**, substituting language diagnostic JSON-RPC calls with standard AI agent primitives:
  * `tools/list` & `tools/call`
  * `resources/list` & `resources/read`
  * `prompts/list` & `prompts/get`

### 2.4 The Single Hub Connector / Gateway Solution
Connecting clients directly to 20+ individual MCP servers causes **connection explosion**, auth fragmentation, and context exhaustion. The **Gateway Pattern** places a single Hub Gateway between Claude and backend capabilities.

```
┌──────────────────────────────────────────────────────────┐
│              CLIENTS (Claude Mobile / Desktop / Web)     │
│          configured once at claude.ai, syncs everywhere  │
└─────────────────────────────┬────────────────────────────┘
                              │ MCP (Streamable HTTP / OAuth 2.0 / DCR)
┌─────────────────────────────▼────────────────────────────┐
│                  HUB GATEWAY (1 Remote Endpoint)          │
│   Auth · Rate Limiter · Router · Session · Permissions   │
└──────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼──────────────────────┐
        ▼                     ▼                       ▼
┌───────────────┐   ┌─────────────────┐   ┌──────────────────┐
│  Plugin/Tool  │   │  Agent Runtime  │   │  Memory Engine   │
│   Registry    │   │  Planner/Orch.  │   │  L1→L2→L3→Arch  │
└───────┬───────┘   └────────┬────────┘   └────────┬─────────┘
        │                    │                      │
        ▼                    ▼                      ▼
┌──────────────────────── Capability Modules ───────────────┐
│  filesystem · github · gmail · calendar · browser · sql  │
│  search · vision · rag · slack · notion · automation     │
└───────────────────────────────────────────────────────────┘
        │                    │                      │
        ▼                    ▼                      ▼
┌──────────────────────── Infrastructure ───────────────────┐
│  SQLite/Turso · LanceDB · Meilisearch · Upstash Redis    │
│  Cloudflare R2 · OAuth · Inngest · OpenTelemetry         │
└───────────────────────────────────────────────────────────┘
```

---

## 3. Modern Claude Architecture (2026)

Anthropic recommends shipping **two primary components**:
1. **Remote MCP Server**: Provides real backend execution, APIs, data connections, and safety boundaries.
2. **Plugin**: Exposes composable skills, prompts, slash commands, and interactive UI views.

### 3.1 Composable System Architecture Diagram

```
                       `Claude Mobile                            │                 Conversation Engine                            │                   Plugin / Skill Layer                            │          ┌─────────────────┴─────────────────┐          │                                   │       MCP Connector                   Local Memory          │                                   │          ├──────────────┬────────────────────┤          │              │                    │       GitHub         Notion              Calendar       Gmail          Drive               REST APIs       Databases      Vector DB           Custom Apps          │     OAuth / JWT          │     Your Backend`
```

### 3.2 Modular Folder Hierarchy
```
core/
    auth/
    router/
    permissions/
    logging/
    memory/
plugins/
    github/
    browser/
    search/
    files/
    calendar/
    email/
    notes/
    automation/
    code/
mcp/
    github_server/
    filesystem_server/
    browser_server/
    custom_api_server/
skills/
    research/
    coding/
    planner/
    writer/
    summarizer/
agents/
    orchestrator/
    researcher/
    coder/
    reviewer/
    debugger/
```

Every module cleanly exposes:
`Tools | Resources | Prompts | UI Components | Permissions`

---

## 4. Lightweight Tool Stack Specifications

### 4.1 Backend Architecture Stack

| Layer | Recommended Technology | Primary Rationale |
|---|---|---|
| **Runtime** | **Bun** | Extremely fast JavaScript/TypeScript runtime, tiny memory footprint |
| **Language** | **TypeScript** | Strict end-to-end type safety across tools and manifests |
| **HTTP Framework** | **Hono** | Ultralightweight, edge-compatible framework (Cloudflare, Fly.io, Bun) |
| **Validation** | **Zod** | Schema-first validation for input/output sanitization |
| **ORM** | **Drizzle ORM** | Lightweight, type-safe SQL ORM |
| **Database** | **SQLite (Turso)** | Edge-replicated serverless database with free tier |
| **Cache** | **Upstash Redis** | Serverless Redis for distributed session and tool caching |
| **Auth** | **Better Auth** / Auth.js | Full OAuth 2.0, JWT, and Dynamic Client Registration (DCR) support |
| **API Protocol** | **REST + MCP** | Standardized JSON-RPC over Streamable HTTP |
| **Background Queue** | **Inngest** | Serverless durable functions and background workflows |
| **Object Storage** | **Cloudflare R2** | Zero-egress fee S3-compatible object storage |
| **Logging** | **Pino** | High-performance structured JSON logger |
| **Monitoring** | **OpenTelemetry** | Standardized distributed tracing, metrics, and logs |

### 4.2 Frontend Architecture Stack (Connector Apps & Dashboard)

| Component | Recommended Technology | Primary Rationale |
|---|---|---|
| **Framework** | **React** | Standard component framework for interactive connector widgets |
| **Build System** | **Vite** | Lightning-fast HMR and bundle optimization |
| **Styling** | **Tailwind CSS** | Utility-first responsive mobile styling |
| **State Management** | **Zustand** | Minimalist, unopinionated client state store |
| **Form Handling** | **React Hook Form** | High-performance form state management |
| **Form Validation** | **Zod** | Shared schemas with backend validation |
| **Icons** | **Lucide Icons** | Clean, lightweight icon suite |
| **Markdown Parsing** | **react-markdown** | Renders Claude responses and document previews |
| **Data Visualization**| **Recharts / Tremor** | Mobile-friendly interactive charts and dashboards |

### 4.3 Suggested Plugin Layout
```
Plugin
 ├── Skills
 │     Research
 │     Coding
 │     Writing
 ├── Connectors
 │     GitHub
 │     Gmail
 │     Calendar
 │     Files
 ├── Slash Commands
 │     /review
 │     /fix
 │     /summarize
 │     /deploy
 ├── MCP Apps
 │     Dashboard
 │     Kanban
 │     File Browser
 └── Agents
       Planner
       Executor
       Reviewer
```

---

## 5. Architectural Generations Evolution (v1 to v5 / ANR)

### 5.1 Generation v1: Plugin OS Architecture & Kernel

```
                       `Claude Mobile                             │                      MCP Super Connector                             │                   Plugin Runtime (Core)                             │  ┌──────────────┬──────────────┬──────────────┬──────────────┐  │              │              │              │  Tool Loader  Skill Engine  Agent Runtime  Memory Engine  │              │              │              │  └──────────────┴──────────────┴──────────────┴──────────────┘                             │                     Internal Event Bus                             │         ┌────────────┬────────────┬────────────┐         │            │            │      GitHub      Browser      Filesystem         │            │            │       Gmail       Search      Calendar         │            │            │       Notion       SQL         REST APIs`
```

#### Kernel Components (`kernel/`)
`loader/ | registry/ | permissions/ | scheduler/ | router/ | context/ | memory/ | logger/ | config/`

#### Plugin Manifest v1 (YAML)
```yaml
id: github
name: GitHub
version: 1.0
tools:
  - search_repo
  - create_issue
  - review_pr
permissions:
  - github.read
  - github.write
dependencies:
  - auth
events:
  - repo.updated
```

#### Plugin API Interface
```typescript
interface Plugin {
  manifest(): PluginManifest;
  tools(): Tool[];
  resources(): Resource[];
  prompts(): Prompt[];
  initialize(context: PluginContext): Promise<void>;
  dispose(): Promise<void>;
}
```

---

### 5.2 Generation v2: Layered AI Kernel & Tool Execution Pipeline

```
                      `Claude Mobile                            │                     Remote MCP Server                            │                  ┌─────────Gateway─────────┐                  │                         │           Authentication             Rate Limiter                  │                         │           Session Manager          Permission Engine                  └─────────┬───────────────┘                            │                       AI Kernel                            │      ┌───────────────┬───────────────┬───────────────┐      │               │               │  Plugin Engine   Agent Engine   Context Engine      │               │               │      └───────┬───────┴───────┬───────┘              │               │         Event Bus       Memory Engine              │               │       Connector Layer    Storage Layer`
```

#### AI Kernel Principles
* Ultra-compact kernel core (**<2,000 lines of code**).
* Responsibilities: Load plugins, register tools, execute tools, check permissions, dispatch events, coordinate agents, assemble context, handle errors. Zero domain-specific logic inside the kernel.

#### Tool Execution Pipeline (Middleware Chain)
`Claude Request -> Auth Check -> Permission Check -> Schema Validation -> Execution -> Audit Logging -> Caching -> Response Formatting -> Result`

#### Plugin Manifest v2
```yaml
id: filesystem
name: Filesystem
version: 2.0
author: You
category: storage
permissions:
  - filesystem.read
  - filesystem.write
tools:
  - read_file
  - write_file
  - list_directory
events:
  - file.updated
  - file.deleted
resources:
  - templates
prompts:
  - summarize_code
config:
  root: /workspace
```

---

### 5.3 Generation v3: Microkernel Architecture & Deterministic Flow

```
                     `Claude Mobile                           │                    Remote MCP Endpoint                           │                   ┌────── Gateway ──────┐                   │                     │              Authentication       Rate Limiter                   │                     │                   └─────────┬───────────┘                             │                      Microkernel Core                             │      ┌───────────┬──────────┼───────────┬───────────┐      │           │          │           │   Registry    Event Bus  Scheduler  Context Engine      │           │          │           │      └───────────┴──────────┴───────────┘                             │                    Plugin Runtime Layer                             │    ┌────────┬────────┬────────┬────────┬────────┐    │        │        │        │        │  Files   GitHub   Gmail   Browser   Database`
```

#### Deterministic Runtime Pipeline
`User Request -> Authentication -> Authorization -> Context Assembly -> Planning -> Agent Selection -> Tool Selection -> Execution -> Validation -> Formatting -> Response`

#### Plugin SDK Core
```typescript
export interface Plugin {
  manifest(): Manifest;
  initialize(ctx: PluginContext): Promise<void>;
  tools(): Tool[];
  resources(): Resource[];
  prompts(): Prompt[];
  shutdown(): Promise<void>;
}

export interface Tool {
  id: string;
  description: string;
  inputSchema: Record<string, any>;
  outputSchema?: Record<string, any>;
  execute(input: any, context: PluginContext): Promise<any>;
}
```

---

### 5.4 Generation v4: AI Application Platform

```
                     `Claude Mobile                            │                    MCP Hub Connector                            │ ──────────────────────────────────────────────────────                   Claude OS Runtime ──────────────────────────────────────────────────────       Kernel      Registry      Plugin Runtime      Workflow Engine      Agent Runtime      Context Engine      Memory Engine      Permission Engine      Event Bus      Scheduler      Cache      Storage      Model Router  ──────────────────────────────────────────────────────  Plugins  Filesystem GitHub Calendar Gmail Slack Discord SQL Docker Browser Search OCR Vision RAG Automation  ──────────────────────────────────────────────────────  Infrastructure  SQLite Redis Vector DB Object Storage Cloud APIs`
```

#### Module Types Taxonomy
`Plugin | Skill | Workflow | Prompt | Agent | Connector | Resource | Theme | Widget`

#### Monorepo Package Breakdown
* `packages/sdk-core`: Core runtime interfaces and dependency injection
* `packages/sdk-plugin`: Plugin development kit
* `packages/sdk-agent`: Multi-agent orchestration kit
* `packages/sdk-workflow`: Declarative DAG workflow engine
* `packages/sdk-memory`: Multi-tier storage abstraction
* `packages/sdk-auth`: Authentication and DCR handling
* `packages/sdk-events`: Distributed event bus wrapper
* `packages/sdk-cli`: Developer CLI tool (`claudeos`)

---

### 5.5 Generation vX: Self-Describing, Self-Extensible AI-Native Runtime

```
                    `Claude Mobile                          │                   MCP Hub Connector                          │ ───────────────────────────────────────────────                   AI Runtime Kernel  ───────────────────────────────────────────────   Registry  Discovery  Dependency Injection  Permissions  Event Bus  Context Manager  Scheduler  Cache  Logger  Config  Secret Manager  ───────────────────────────────────────────────   Module Runtime   Plugin  Agent  Skill  Workflow  Prompt  Widget  Connector  Memory  Model  Service  ───────────────────────────────────────────────   Infrastructure   Database  Object Storage  Search  Vector Store  Queue  External APIs`
```

#### Universal Module Interface
```typescript
export interface Module {
  manifest(): Manifest;
  activate(context: RuntimeContext): Promise<void>;
  deactivate(): Promise<void>;
  dispose(): Promise<void>;
}
```

#### Reflection & Introspection API
Every module advertises its capabilities, dependencies, permissions, schemas, and usage examples, enabling Claude to dynamically inspect the runtime state (`List Modules`, `List Capabilities`, `Show Dependencies`, `Show Telemetry`).

---

### 5.6 Generation v5 / Next: Distributed AI Operating System

```
                           `Claude Mobile                                 │                      Remote MCP Hub Connector                                 │ ══════════════════════════════════════════════════════                      Claude AI Operating System  ══════════════════════════════════════════════════════                       Intent Planner                            │                  Semantic Task Planner                            │                   Execution Orchestrator                            │ ──────────────────────────────────────────────────────  Runtime Services   Registry  Discovery  Dependency Resolver  Module Loader  Event Bus  Permission Engine  Context Manager  Workflow Engine  Agent Runtime  Model Router  Memory Engine  Scheduler  Secret Manager  Cache  Search  ──────────────────────────────────────────────────────  Module Ecosystem   Tools  Agents  Skills  Plugins  Widgets  Prompts  Resources  Connectors  Models  Pipelines  Services  ──────────────────────────────────────────────────────  Infrastructure   SQLite  PostgreSQL  Redis  Qdrant  Meilisearch  S3/R2  OAuth  External APIs`
```

#### Capability-First Paradigm
Claude requests capabilities directly rather than referencing specific plugins:
`filesystem.read | github.repository.search | pdf.extract | email.send`

#### Runtime Package Standard (`.claudepkg`)
Contains Manifest, Schemas, Agents, Tools, Prompts, Resources, Assets, Tests, and Cryptographic Signatures.

---

### 5.7 Generation ANR: Agentic-Native Runtime (2026 Core)

The ultimate evolution shifts Claude from the center to an **Adapter Layer**. The backend is a model-agnostic **Agentic-Native Runtime (ANR)** capable of serving Claude Mobile, ChatGPT, Gemini, Web Apps, Desktop CLI, VS Code, and messaging platforms.

```
                    `CLIENTS  ┌─────────────────────────────────────────────┐  │ Claude │ ChatGPT │ Gemini │ Web │ CLI │ API │  └─────────────────────────────────────────────┘                       │           Adapter Layer (Thin)  ┌─────────────────────────────────────────────┐  │ MCP │ OpenAI │ Gemini │ REST │ WebSocket    │  └─────────────────────────────────────────────┘                       │ ═══════════════════════════════════════════════           Agentic-Native Runtime (ANR) ═══════════════════════════════════════════════   Kernel  ├── Registry  ├── Loader  ├── Router  ├── Permissions  ├── Lifecycle  ├── Config  └── Events   Runtime  ├── Planner  ├── Workflow Engine  ├── Scheduler  ├── Context Builder  ├── Memory  ├── Search  ├── Cache  └── Model Router   Capability Runtime  ├── Filesystem  ├── GitHub  ├── Gmail  ├── Calendar  ├── Browser  ├── SQL  ├── OCR  ├── Vision  ├── RAG  ├── Automation  └── Custom   Infrastructure  ├── SQLite  ├── Object Storage  ├── Queue  ├── Search  ├── Vector Store  └── OAuth`
```

---

## 6. Capability Model & Plugin Manifest Standards

### 6.1 Capability Manifest Standard (Production 2026)

```yaml
id: github.search_repo
kind: capability            # capability | skill | agent | workflow | prompt | widget
version: 2.0
author: System
category: developer
permissions:
  - github.read
inputs:
  query: string
  limit: number
outputs:
  repositories: Array<Repository>
cost: low                   # low | medium | high
latency: medium             # low | medium | high
requires_confirmation: false

tools:
  - id: github.search_repo
    description: Search GitHub repositories by query keyword
    input: { query: string, limit?: number }
    output: { repositories: Repository[] }
  - id: github.review_pr
    description: Perform Automated PR Review
    permissions: [github.read, github.write]
    requires_confirmation: false
  - id: github.create_issue
    description: Create a new GitHub issue
    permissions: [github.write]
    requires_confirmation: true   # Mutating operation requires user confirmation

prompts:
  - review_pr
  - summarize_diff

events:
  emits:
    - pull_request.created
    - issue.updated
  listens:
    - workspace.search

resources:
  - github_schema
  - api_reference

dependencies:
  - auth
  - cache
```

### 6.2 Plugin Lifecycle State Machine
`Install -> Validate Manifest -> Dependency Check -> Load Module -> Initialize -> Register Capabilities -> Register Events -> Ready <-> Suspend -> Unload`

---

## 7. Security Architecture, Threat Modeling & Confused Deputy Mitigation

### 7.1 Confused-Deputy Attack Mitigation
In a confused-deputy scenario, a proxy or gateway reuses static client IDs or shared consent tokens across multiple upstream sessions, allowing malicious prompts or untrusted downstream tools to hijack authorization.

**Mandatory Mitigations**:
1. **Per-Client OAuth Consent Storage**: OAuth tokens and consent scopes are locked to individual user session keys and never shared across clients.
2. **State Parameter Validation**: Validate `state` parameters during OAuth redirects with time-bound cryptographic nonces.
3. **Tool Description Sanitization**: All tool descriptions provided by external plugins are treated as untrusted input and sanitized to prevent prompt injection attacks.
4. **Least-Privilege Capability Checks**: The Kernel verifies that the active session holds explicit permission for every requested capability before executing tool handlers.

### 7.2 Production Security Checklist
* [x] Per-client OAuth consent storage (isolated per user/session)
* [x] Cryptographic `state` parameter validation prior to OAuth redirect
* [x] Tool description & input schema sanitization against prompt injection
* [x] Capability-based access control (CBAC) with fine-grained scopes
* [x] Immutable audit log recording every tool execution (`src/database/`)
* [x] Dynamic sliding-window rate limiting per session (60 requests/min)
* [x] Secret Vault isolation (environment variable scanning + Secret Scanner)
* [x] Strict Zod input schema validation prior to execution
* [x] Mandatory user confirmation flags for sensitive/destructive operations (`requires_confirmation: true`)

---

## 8. Context Safety, Token Efficiency & Tool Count Constraints

### 8.1 Research-Backed Tool Count Boundary (≤10 Tools Rule)
Empirical telemetry and research across Claude 3.5 Sonnet and Haiku models confirm that exposing more than **10–15 tools simultaneously in system context degrades reasoning accuracy and tool selection precision**.

```
Recommended Range: ≤10 Active Tools per Prompt Context

 100% ┌───────────────────────────────┐
      │  Optimal Accuracy (1-10 Tools)│
  80% │───────────────────────────────┴──────────┐
      │                                 Degradation Zone (10-20 Tools)
  60% │                                          └───────────────────────┐
      │                                             Severe Hallucination │
   0% └──────────────────────────────────────────────────────────────────┘
      0             10                            20                    50+
                                Active Exposed Tools
```

### 8.2 Dynamic Tool Discovery & Context Budget Manager
To respect the **≤10 tools limit** while providing access to hundreds of capabilities:
1. Claude interacts solely with the 7 high-level `workspace.*` tools.
2. When a specialized query arrives, the runtime uses **Semantic Capability Search** (`workspace.search`) to retrieve the top 3–5 matching capabilities dynamically.
3. The **Context Budget Manager** reserves prompt space systematically:

```
Maximum Context Window
  − System Prompt (Fixed)
  − User Query (Variable)
  − Active Tool Schemas (≤10 tools max)
  − Memory Injection (Top-k retrieved items)
  ──────────────────────────────────────────
  = Available Context Budget for Output & History

Fallback Sequence if Budget Exceeded:
  1. Summarize older conversation turns.
  2. Prune low-relevance tool return data.
  3. Retrieve top-3 semantic memories only.
  4. Truncate large document payloads to relevant excerpts.
```

---

## 9. Agentic Memory Subsystem & Universal Search Engine

### 9.1 Multi-Tier Memory Engine (L1 to L4)

```
L1: Working Memory      ── In-memory volatile cache (Active session turns)
        ↓
L2: Project Memory      ── SQLite / Turso DB (Persistent facts & project states)
        ↓
L3: Semantic Memory     ── LanceDB / Vector Store (Embeddings & similarity search)
        ↓
L4: Archive Storage     ── Cloudflare R2 (Compressed historical logs & documents)
```

### 9.2 Universal Hybrid Search Pipeline
When executing `workspace.search`, the query flows through a multi-stage hybrid retrieval pipeline:
`Query -> Keyword Search (Meilisearch) + Semantic Vector Search (LanceDB) + Knowledge Graph Traversal -> Score Ranking & Deduplication -> Context Budget Assembly -> Response`

---

## 10. Multi-Agent Orchestration & Workflow Execution Engine

### 10.1 Multi-Agent Swarm Taxonomy

| Agent Role | Primary Responsibility | Input Capabilities | Output Artifacts |
|---|---|---|---|
| **Orchestrator** | Intent parsing & agent routing | `workspace.search` | Master Task Assignment |
| **Planner** | Generates Directed Acyclic Execution Graph (DAG) | Capability Registry | Task Execution Plan |
| **Researcher** | Searches, crawls, synthesizes data | `workspace.search`, `browser` | Research Summary |
| **Coder** | Writes, refactors, & edits codebase files | `filesystem`, `github` | Code Patches & Diff |
| **Reviewer** | Audits code quality, security, & specs | Code Diff | Review Comments |
| **Debugger** | Diagnoses execution errors & stack traces | Log Stream, Terminal | Diagnostic Report |
| **Executor** | Runs tools & dispatches capability calls | All Capabilities | Execution Result |

### 10.2 Workflow Graph Execution (DAG)
Workflows are represented as Directed Acyclic Graphs supporting parallel node execution, retries, branching logic, and failure compensation:

```
                       User Goal
                           │
                     Planner Agent
                           │
                  Task Execution DAG
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
      Search Docs Node            Read Repository Node
             │                           │
             └─────────────┬─────────────┘
                           ▼
                  Analyze Code Node
                           │
                           ▼
                 Generate Report Node
```

---

## 11. Single Hub Connector Tool API & External Interfaces

To remain 100% compliant with **Claude Free tier's single custom remote MCP connector limit**, the Hub Gateway exposes **7 master workspace tools** that fan out internally:

```typescript
// The 7 Master Hub Gateway Tools exposed to Claude Mobile
workspace.search(query: string, sources?: string[])
// Searches across files, memory, GitHub, documentation, and tools

workspace.memory(action: "get" | "set" | "search", key?: string, value?: string)
// Interacts with persistent L2/L3 memory subsystem

workspace.files(action: "read" | "write" | "list", path?: string, content?: string)
// Performs filesystem reads, writes, and directory listings

workspace.github(action: string, params: Record<string, any>)
// Dispatches GitHub operations (search, PR review, issue creation)

workspace.workflow(name: string, inputs: Record<string, any>)
// Triggers background workflows and multi-agent execution plans

workspace.notes(action: "create" | "read" | "search", content?: string)
// Interacts with personal knowledge base and notes

workspace.admin(action: "list_modules" | "status" | "metrics")
// Diagnostic tool for checking runtime state and capability manifests
```

---

## 12. Monorepo Project Structure & Developer Tooling

```
claude-hub/
├── apps/
│   ├── gateway/              # The single MCP server endpoint for Claude
│   ├── dashboard/            # Admin dashboard (React + Vite + Tailwind)
│   └── mobile-ui/            # Interactive connector widgets
│
├── packages/
│   ├── kernel/               # Core runtime, dependency injection, lifecycle
│   ├── mcp-server/           # Hono + MCP SDK server wrapper
│   ├── router/               # Capability resolution and dispatch
│   ├── planner/              # Intent -> DAG planning engine
│   ├── context/              # Context Budget Manager
│   ├── memory/               # L1-L4 memory engine
│   ├── auth/                 # Better Auth + OAuth 2.0 DCR
│   ├── permissions/          # Capability-based security
│   ├── events/               # Distributed event bus
│   ├── scheduler/            # Inngest background job scheduler
│   ├── cache/                # Upstash Redis client
│   ├── search/               # Hybrid search engine
│   ├── vector/               # LanceDB / Qdrant vector client
│   ├── logger/               # Pino structured logging
│   ├── telemetry/            # OpenTelemetry tracing
│   ├── config/               # c12 configuration loader
│   ├── sdk/                  # Developer SDK for custom capabilities
│   └── cli/                  # `claudeos` CLI developer tool
│
├── modules/                  # Modular capability packages
│   ├── filesystem/           # File read/write tools
│   ├── github/               # GitHub repo/issue/PR tools
│   ├── gmail/                # Email reader/sender
│   ├── calendar/             # Calendar event manager
│   ├── browser/              # Web browser automation
│   ├── search/               # Web & workspace search
│   ├── sql/                  # SQLite/Postgres query tools
│   ├── rag/                  # Vector document ingestion
│   ├── vision/               # OCR & image analysis
│   ├── notes/                # Notes & markdown management
│   └── automation/           # Custom webhook triggers
│
├── agents/                   # Sub-agent implementations
│   ├── planner/
│   ├── researcher/
│   ├── coder/
│   ├── reviewer/
│   └── orchestrator/
│
├── deployment/               # IaC & Deployment configs
│   ├── cloudflare/           # Workers + R2 + Secrets
│   ├── fly/                  # Fly.io persistent container deployment
│   └── railway/              # Railway single-click deployment
│
└── docs/                     # Full documentation wiki
```

### 12.1 Developer CLI Tool (`claudeos` / `claude`)
```bash
claudeos init                 # Initialize new workspace configuration
claudeos dev                  # Start local development gateway with hot reload
claudeos module create        # Scaffold a new capability module
claudeos module test          # Run module unit and contract tests
claudeos module publish       # Package and register capability package
claudeos workflow run <name>  # Test execution of a named workflow graph
claudeos memory inspect       # Query active L1-L3 memory state
claudeos doctor               # Verify gateway health, tokens, and MCP endpoint
```

---

## 13. Phased Development Roadmap & Production Deployment Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        DEVELOPMENT ROADMAP                             │
├────────────────────────────────────────────────────────────────────────┤
│ PHASE 1: FOUNDATION (Completed)                                        │
│   • Bun + Hono MCP Server with `workspace` tool                        │
│   • OAuth 2.0 (Specs 3/26 & 6/18) + Dynamic Client Registration        │
│   • Dynamic Module Loader & Kernel Registry                            │
│   • Rate limiting & Secret Scanner                                     │
├────────────────────────────────────────────────────────────────────────┤
│ PHASE 2: CORE RUNTIME                                                  │
│   • Context Budget Manager with token safety limits                    │
│   • L2 SQLite (Turso) + L3 LanceDB Vector Memory                       │
│   • Distributed Event Bus (EventEmitter3)                              │
│   • Capability-Based Access Control (CBAC)                             │
├────────────────────────────────────────────────────────────────────────┤
│ PHASE 3: CAPABILITY MODULE EXPANSION                                   │
│   • Filesystem, GitHub, Browser, Search, Calendar, Email Modules      │
│   • Standardized YAML manifest validation                              │
├────────────────────────────────────────────────────────────────────────┤
│ PHASE 4: INTELLIGENCE & MULTI-AGENT SWARM                              │
│   • Intent Planner & DAG Workflow Execution Engine                     │
│   • Inngest Durable Background Job Scheduler                           │
│   • Multi-Agent Swarm (Planner, Researcher, Coder, Reviewer)           │
├────────────────────────────────────────────────────────────────────────┤
│ PHASE 5: PLATFORM & MARKETPLACE                                        │
│   • Developer SDK + `claudeos` CLI Tool                                │
│   • Web Admin Dashboard (React + Vite + Tailwind)                      │
│   • Cryptographic module signing & capability marketplace              │
└────────────────────────────────────────────────────────────────────────┘
```

### 13.1 Production Deployment Progression

1. **Development Phase**:
   * **Runtime**: Bun + Hono local server
   * **Database**: Local SQLite + LanceDB file storage
   * **Tunneling**: Cloudflare Tunnel (`cloudflared`) to expose HTTPS URL for `claude.ai` sync.
2. **Small Production Phase (Serverless Edge - $0–5/month)**:
   * **Runtime**: Cloudflare Workers
   * **Database**: Turso (Edge-replicated SQLite)
   * **Cache**: Upstash Redis
   * **Storage**: Cloudflare R2
3. **Scaled Enterprise Production Phase**:
   * **Runtime**: Fly.io or Railway persistent containers
   * **Database**: PostgreSQL + Qdrant Vector Cluster
   * **Queue**: Inngest Durable Workflows
   * **Observability**: OpenTelemetry + Pino + Sentry

---

## 14. Final Strategic Summary & Architectural Matrix

| Architectural Concern | Strategic Decision | Primary Justification |
|---|---|---|
| **Free Tier Constraints** | Single Remote Hub Gateway (`workspace.*`) | Eliminates connection explosion and complies with 1-connector limit |
| **Mobile Setup** | Configure via `claude.ai` web | Auto-syncs credentials & remote MCP server seamlessly to iOS/Android |
| **Transport Layer** | Streamable HTTP | Aligns with modern spec; SSE deprecated |
| **Authentication** | OAuth 2.0 + DCR | Complies with Anthropic 3/26 & 6/18 specs |
| **Tool Count Safety** | ≤10 active tools in context | Preserves Haiku & Sonnet model reasoning accuracy |
| **Security Paradigm** | Per-client consent + State validation | Eliminates confused-deputy and prompt injection vulnerabilities |
| **Model Independence** | Model-Agnostic ANR Adapter Layer | Enables seamless transition between Claude, ChatGPT, Gemini, & local models |
| **Runtime Infrastructure** | Bun + Hono + Turso + Upstash | Delivers ultra-low latency, edge compatibility, and minimal memory footprint |
| **Extensibility** | Capability Manifests & SDK | Allows independent module development without kernel modifications |

---

*Document Version: v8 (Traceability Documentation & Wiki)*
*Traceability Target Repository: Abdus2023/GAR-II (`arena/019f9179-gar-ii`)*
