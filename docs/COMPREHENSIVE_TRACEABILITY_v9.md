# Claude OS / Agentic-Native Runtime (ANR) — Comprehensive Traceability Documentation & Wiki Extended (v9 — July 2026)

> **Status**: Historical target-state wiki; superseded for implementation status by v10
> **Last Updated**: 2026-07-24
> **Target Platform**: Claude Chat Mobile & Desktop (Free Tier Beta & Paid Plans), Claude Code CLI/VS Code, ChatGPT, Gemini, Local Models
> **Core Architecture**: Agentic-Native Runtime (ANR) / Single Remote MCP Hub Gateway Pattern (MCP 2026-07-28 Spec)

---

## 📚 Master Extended Wiki Table of Contents

### SECTION I: ARCHITECTURAL FOUNDATIONS & ECOSYSTEM GROUND TRUTHS
1. [Part 1 — Foundations: What Is MCP and Why Does It Exist?](#part-1--foundations-what-is-mcp-and-why-does-it-exist)
2. [Part 2 — Transport: How Claude Actually Talks to Your Server](#part-2--transport-how-claude-actually-talks-to-your-server)
3. [Part 3 — The Current State of Claude Mobile Connectors](#part-3--the-current-state-of-claude-mobile-connectors)
4. [Part 4 — The MCP 2026-07-28 Specification](#part-4--the-mcp-2026-07-28-specification)
5. [Part 5 — The Hub Gateway Pattern (The Core Architectural Decision)](#part-5--the-hub-gateway-pattern)
6. [Part 6 — Security: The Most Underestimated Part](#part-6--security-the-most-underestimated-part)

### SECTION II: CORE ENGINE, MEMORY & AGENT RUNTIME
7. [Part 7 — The Plugin/Module System Explained](#part-7--the-pluginmodule-system-explained)
8. [Part 8 — Memory Architecture Explained](#part-8--memory-architecture-explained)
9. [Part 9 — The Agent Runtime Explained](#part-9--the-agent-runtime-explained)
10. [Part 10 — The Technology Stack, Explained in Depth](#part-10--the-technology-stack-explained-in-depth)
11. [Part 11 — The Model-Agnostic Adapter Layer](#part-11--the-model-agnostic-adapter-layer)
12. [Part 12 — The Development Roadmap, Explained](#part-12--the-development-roadmap-explained)
13. [Part 13 — Complete Project Structure with Explanations](#part-13--complete-project-structure-with-explanations)
14. [Part 14 — Complete Summary: Every Concept in One Place](#part-14--complete-summary-every-concept-in-one-place)

### SECTION III: CONTEXT OPTIMIZATION, BIDIRECTIONALITY & PROTOCOLS
15. [Part 15 — The Context Pollution Crisis](#part-15--the-context-pollution-crisis)
16. [Part 16 — Sampling and Elicitation: MCP Goes Bidirectional](#part-16--sampling-and-elicitation-mcp-goes-bidirectional)
17. [Part 17 — The A2A Protocol: Agent-to-Agent Communication](#part-17--the-a2a-protocol-agent-to-agent-communication)

### SECTION IV: COMPLETE REFERENCE IMPLEMENTATION
18. [Part 18 — Complete Implementation: Building the Hub Gateway from Zero](#part-18--complete-implementation-building-the-hub-gateway-from-zero)
19. [Part 19 — Production Operations](#part-19--production-operations)
20. [Part 20 — Tool Design Patterns and Best Practices](#part-20--tool-design-patterns-and-best-practices)
21. [Part 21 — The Complete Development Workflow](#part-21--the-complete-development-workflow)
22. [Part 22 — The Full Ecosystem Map](#part-22--the-full-ecosystem-map)
23. [Part 23 — Everything That Matters, in One Final Reference](#part-23--everything-that-matters-in-one-final-reference)

### SECTION V: ADVANCED PROTOCOL CAPABILITIES & TOPOLOGIES
24. [Part 24 — MCP Server Cards: The Discovery Revolution](#part-24--mcp-server-cards-the-discovery-revolution)
25. [Part 25 — Skills vs. MCP Servers: The Most Important Distinction](#part-25--skills-vs-mcp-servers-the-most-important-distinction)
26. [Part 26 — Triggers: MCP Becomes Event-Driven](#part-26--triggers-mcp-becomes-event-driven)
27. [Part 27 — Streaming and Reference-Based Results](#part-27--streaming-and-reference-based-results)
28. [Part 28 — Advanced Security: DPoP and Workload Identity](#part-28--advanced-security-dpop-and-workload-identity)
29. [Part 29 — The Four Enterprise Deployment Topologies](#part-29--the-four-enterprise-deployment-topologies)
30. [Part 30 — The MCP Registry Ecosystem](#part-30--the-mcp-registry-ecosystem)
31. [Part 31 — Cost Modeling and Optimization](#part-31--cost-modeling-and-optimization)
32. [Part 32 — The Complete Skills System Implementation](#part-32--the-complete-skills-system-implementation)
33. [Part 33 — Multi-Agent Patterns in Depth](#part-33--multi-agent-patterns-in-depth)
34. [Part 34 — Observability Dashboard in Practice](#part-34--observability-dashboard-in-practice)
35. [Part 35 — The Final Integration Blueprint](#part-35--the-final-integration-blueprint)

### SECTION VI: EXTENSION SURFACE, AUTOMATION, CODE MODE & ENTERPRISE
36. [Part 36 — The Four Layers of Claude Code Extensions (Clarified)](#part-36--the-four-layers-of-claude-code-extensions-clarified)
37. [Part 37 — Hooks: Automation at Every Lifecycle Point](#part-37--hooks-automation-at-every-lifecycle-point)
38. [Part 38 — Programmatic Tool Calling: The Paradigm Shift](#part-38--programmatic-tool-calling-the-paradigm-shift)
39. [Part 39 — Live Artifacts: The Newest MCP Capability](#part-39--live-artifacts-the-newest-mcp-capability)
40. [Part 40 — Enterprise-Managed Authorization: The Okta Integration](#part-40--enterprise-managed-authorization-the-okta-integration)
41. [Part 41 — The Anti-Pattern Catalog (What Not to Build)](#part-41--the-anti-pattern-catalog-what-not-to-build)
42. [Part 42 — Subagents: Parallel Work with Isolated Context](#part-42--subagents-parallel-work-with-isolated-context)
43. [Part 43 — The MCP Programmatic Tool Calling Best Practices](#part-43--the-mcp-programmatic-tool-calling-best-practices)
44. [Part 44 — The Complete Integration Matrix](#part-44--the-complete-integration-matrix)
45. [Part 45 — The Final Production Hardening Checklist](#part-45--the-final-production-hardening-checklist)

---

## Current Implementation Status Addendum — v10 Supersession

This v9 document is retained as a broad architecture/wiki reference. It contains target-state and aspirational material and should **not** be treated as the current implementation status source.

For current implementation traceability, use:

- [`COMPREHENSIVE_TRACEABILITY_v10.md`](./COMPREHENSIVE_TRACEABILITY_v10.md)
- [`../PROJECT_STATUS.md`](../PROJECT_STATUS.md)
- [`../README.md`](../README.md)

Current validated baseline as of 2026-07-24:

| Area | Current Status |
|---|---|
| Build/test | `npm run build`, `npm run build:sdk`, `npm test` pass |
| Test suite | 29 files / 65 tests passing |
| MCP | Streamable HTTP with session continuity and SDK e2e test |
| Modules | dynamic loader plus filesystem, GitHub, notes, search, browser fetch, calendar REST, echo |
| Auth | DB-backed OAuth client registration and JWT validation |
| Security | kernel hooks, secret scanner, body-size limit, rate limit, confirmation gates, optional module signatures |
| Observability | audit queue, dashboard, Prometheus metrics, OTLP trace exporter, correlation IDs |
| Remaining blockers | sandboxing, production signature enforcement, Cloudflare validation, richer browser/calendar integrations, RBAC |

# SECTION I: ARCHITECTURAL FOUNDATIONS & ECOSYSTEM GROUND TRUTHS

---

## Part 1 — Foundations: What Is MCP and Why Does It Exist?

### 1.1 The Problem Before MCP
Before November 2024, connecting an AI assistant to external tools meant writing a custom integration for every single pair. GitHub needed one adapter. Notion needed another. Your own database needed yet another. Every integration was hand-rolled, fragile, and only worked with the specific AI it was written for.

When you switched AI providers, everything broke. When the AI's function-calling API changed, everything broke again. When you added a new tool, you had to wire it manually into every AI client separately.

This was the problem MCP was designed to eliminate.

### 1.2 What MCP Actually Is
MCP standardizes how AI models interact with external tools, data sources, and systems, earning the nickname "the USB-C of the AI world."

More precisely: the Model Context Protocol (MCP) is an open standard that gives AI models a universal way to connect to external tools, data sources, and services.

Instead of each AI having its own function-calling format, and each tool having its own API adapter, MCP gives you one protocol that any compliant AI host can use to talk to any compliant tool server. Think of it as a USB-C port for AI: any compliant host (Claude, ChatGPT, Cursor, VS Code Copilot) can plug into any compliant server and immediately discover and use its capabilities.

### 1.3 History and Ecosystem Scale
In November 2024, Anthropic open-sourced the Model Context Protocol (MCP), and in just 18 months it has become the de facto standard for AI agent integration.

The numbers validate that claim: as of March 2026, MCP has surpassed 97 million monthly SDK downloads, earned over 81,000 GitHub stars, and is supported by every major AI vendor — Anthropic, OpenAI, Google, Microsoft, and AWS.

The governance story is equally important: in December 2025, Anthropic donated MCP to the Agentic AI Foundation under the Linux Foundation, making it a vendor-neutral, community-governed standard.

What this means practically: MCP is no longer Anthropic's protocol. It belongs to the community, like HTTP or TCP. Building on it means you are not betting on a single company's roadmap.

### 1.4 The Three MCP Primitives
A first-class context type in MCP: Tool (executable action), Resource (read-only data), or Prompt (reusable template). Each has standardized list and get/call methods.

These three primitives are the entire surface area of what your server can expose to Claude:

- **Tools** are things Claude can do — call an API, read a file, write to a database, search the web. Every capability you build is expressed as a Tool.
- **Resources** are things Claude can read — documentation, schemas, configuration files, knowledge bases. They do not execute code; they just provide context.
- **Prompts** are reusable templates Claude can load — a code review template, a research framework, a planning structure. They are parameterized text that shapes Claude's behavior for a specific task.

When Claude interacts with your server, it first calls `tools/list`, `resources/list`, and `prompts/list` to discover what exists. Then it calls `tools/call` with input parameters when it wants to execute something.

### 1.5 MCP Architecture: Host, Client, Server
MCP uses a client-server architecture built on JSON-RPC 2.0. A single host application (Claude Desktop, Claude Code, Cursor, etc.) creates multiple isolated MCP client sessions, each maintaining a stateful JSON-RPC channel with its own MCP server.

Breaking this down:
- **Host** = the AI application (Claude Mobile, Claude Desktop, Claude Web). It orchestrates everything.
- **Client** = a session inside the host that connects to one specific MCP server. The host creates one client per server.
- **Server** = your backend. It exposes tools, resources, and prompts over the network.

The host never connects directly to external services. It connects to your server, and your server connects to external services. This layering is intentional — it keeps the AI application isolated from the complexity of every integration.

---

## Part 2 — Transport: How Claude Actually Talks to Your Server

### 2.1 The Two Transport Modes
MCP supports two transport modes. `stdio` handles local inter-process communication and is the default for running local MCP servers in Claude Desktop or Claude Code. Streamable HTTP, introduced in the November 2025 spec, replaces the legacy SSE (Server-Sent Events) transport and enables MCP servers to run as remote services.

For Claude Mobile, only remote MCP is relevant. Claude Desktop supports both local and remote MCP. However, mobile apps cannot run local scripts, so only remote MCP is available.

This means: you cannot run a local server on your phone. Your server must be deployed on the internet, reachable from Anthropic's cloud. When you add a custom connector, Claude connects to your remote MCP server from Anthropic's cloud infrastructure, rather than from your local device. This is true across every Claude client, including `claude.ai`, Claude Desktop, Cowork, and the mobile apps. This means your MCP server must be reachable over the public internet from Anthropic's IP ranges.

### 2.2 Why Streamable HTTP, Not SSE
The older SSE (Server-Sent Events) transport has been deprecated. The revision it replaces is the still-in-force 2025-11-25 specification, whose transports are `stdio` and Streamable HTTP (the older HTTP+SSE transport was deprecated back in March 2025).

**Always build new servers using Streamable HTTP.** If you use SSE today, you are building on a deprecated transport that will stop being supported.

### 2.3 Auth: OAuth 2.1
Remote MCP servers adopted OAuth 2.1 as the authentication standard starting with the June 2025 spec.

OAuth 2.1 is what allows Claude to connect to your server on behalf of a user, with the user's explicit consent, without exposing raw credentials. The flow works like this:
1. User tells Claude to connect to your server
2. Claude redirects user to your OAuth authorization endpoint
3. User logs in and grants consent
4. Your server issues an access token
5. Claude uses that token for all future requests

The spec also includes Dynamic Client Registration (DCR) — this allows Claude to register itself as an OAuth client with your server automatically, without you having to manually pre-configure every client. This is what makes adding a connector self-service.

---

## Part 3 — The Current State of Claude Mobile Connectors

### 3.1 Free Plan Constraints
Free users are limited to **one custom connector**. This feature is currently in beta. Custom connectors using remote MCP are available on Claude, Cowork, and Claude Desktop for users on Free, Pro, Max, Team, and Enterprise plans.

One connector. That is your budget on the free plan. Every architectural decision in this guide flows from this single constraint.

### 3.2 How to Set Up on Mobile
There's no way to configure remote MCP directly from the mobile app. You need to add remote MCP URLs through the `claude.ai` website. Configuring it on the web version automatically syncs the settings across Mobile, Desktop, and Web platforms.

The steps are:
1. Go to `claude.ai` on a web browser (not the app)
2. Navigate to Settings → Customize → Connectors
3. Click the + button
4. Enter the connector name and remote MCP server URL. Click Advanced settings to add OAuth credentials if required. Click Add, then authenticate.
5. The connector automatically appears in Claude Mobile

### 3.3 What Connectors Can Do
Connectors work across Claude, Claude Desktop, Claude Code, and the API (via the MCP Connector). Once you've connected an app, Claude can bring it into a conversation on its own when it fits what you're asking for — you don't have to name it every time.

The Connectors Directory has 400+ verified integrations. You can use these out of the box, or you can add custom ones. Since you're building your own, you'll be adding a custom connector.

### 3.4 Security Warning (Mandatory Reading)
Custom connectors allow you to connect Claude to services that have not been verified by Anthropic, and allow Claude to access and take action in these services.

This matters because Claude will trust what your server tells it. If your server is compromised, or if you build it incorrectly, Claude could be made to take actions the user did not intend.

---

## Part 4 — The MCP 2026-07-28 Specification

The release candidate for MCP 2026-07-28 is available: a stateless core that scales on ordinary HTTP infrastructure · extensions including server-rendered UIs through MCP Apps and long-running work through the Tasks extension · authorization that aligns more closely with OAuth and OpenID Connect deployments · a formal deprecation policy so the protocol can evolve without breaking what you've built.

### 4.1 Stateless Core (The Biggest Change)
The protocol is now stateless: no handshake, no session id, any request can hit any server instance.

The new stateless model means: you can put your MCP server behind a load balancer, run multiple instances, scale horizontally on Cloudflare Workers or any serverless platform — with no session stickiness required. Store any state you need in a database (SQLite/Turso) or cache (Redis), not in server memory.

### 4.2 MCP Apps (Embedded UIs)
MCP Apps (SEP-1865) lets servers ship interactive HTML interfaces that hosts render in a sandboxed iframe. Tools declare their UI templates ahead of time, so hosts can prefetch, cache, and security-review them before anything runs.

Your server can now ship small interactive interfaces — a Kanban board, a file browser, a dashboard — that render inside Claude's conversation interface.

### 4.3 Tasks Extension (Long-Running Work)
Tasks is the redesign of the experimental long-running-work API, rebuilt for the stateless world: the server answers `tools/call` with a task handle, and the client drives the lifecycle through `tasks/get`, `tasks/update`, and `tasks/cancel`.

Background jobs, long-running agents, document indexing, repository syncing — all of these are expressed as Tasks.

### 4.4 Extensions Framework
An `extensions` field is added to both `ClientCapabilities` and `ServerCapabilities`, and the two sides negotiate optional extensions beyond the core protocol through that map.

### 4.5 Formal Deprecation Policy
A formal deprecation policy guarantees a 12-month deprecation window so the protocol can evolve predictably.

---

## Part 5 — The Hub Gateway Pattern

### 5.1 Why You Need a Gateway
The free-tier constraint (one connector) forces a design decision: the **federated gateway** pattern. The gateway aggregates multiple servers or modules behind a single endpoint. Claude connects to the gateway once. The gateway routes to everything.

### 5.2 The Gateway as a Kernel
The gateway acts as an operating system kernel:
- Plugin loading and lifecycle management
- Tool and capability registry
- Permission checking before execution
- Event routing between modules
- Configuration management & structured logging
- Context assembly

### 5.3 What Claude Sees vs. What Actually Runs

```
Claude's view:                        Your internal reality:
─────────────────────────────────────────────────────────────────────────────
workspace.search                   → github.search_repo
                                   → notion.search_pages
                                   → filesystem.search
                                   → sql.full_text_search
                                   → web.search
                                   → meilisearch.query

workspace.github                   → github.create_issue
                                   → github.review_pr
                                   → github.search_repo
                                   → github.read_file

workspace.workflow                 → workflow_engine.run("deploy")
                                   → workflow_engine.run("sync")
                                   → scheduler.enqueue(...)
```

From Claude's perspective, there are 7 tools (`workspace.*`). From your server's perspective, there are potentially hundreds of capabilities.

### 5.4 Why This Is Better Than Many Small Connectors
1. **Context budget**: Exposing 50 individual tools burns tens of thousands of tokens upfront. 7 hub tools spend almost nothing.
2. **Consistency**: Uniform auth, logging, permissions, and error handling.
3. **Evolution**: Internal module implementations change without altering Claude's public interface.
4. **Security**: Single authorization boundary and audit log.

---

## Part 6 — Security: The Most Underestimated Part

### 6.1 The Threat Landscape Is Real
Documented attack classes in 2025: tool poisoning, rug pulls (silent redefinition), tool shadowing, cross-server attacks, confused-deputy/OAuth weaknesses, prompt injection / "toxic agent flows," and the "lethal trifecta."

Invariant Labs demonstrated that the GitHub MCP server could be hijacked through a malicious GitHub Issue containing embedded prompt instructions to exfiltrate private repository data.

### 6.2 The Confused Deputy Attack
In a confused deputy attack, an attacker exploits trust relationships by tricking a legitimate client into performing unauthorized actions on their behalf. Fix this with per-user token storage, session isolation, and audience validation.

### 6.3 Tool Poisoning
Tool poisoning occurs when user-generated content returned by a tool contains prompt instructions that Claude executes as system instructions. **Defense**: Treat all tool output as untrusted and sanitize inbound data.

### 6.4 Token Validation Rules
Verify the `aud` claim in JWT tokens on every request. Reject tokens intended for different services even if properly signed. Never forward raw tokens to downstream services.

### 6.5 Production Security Checklist
- [x] Per-user OAuth token storage (never shared/cached across users)
- [x] JWT audience (`aud`) claim validation on every request
- [x] Tool output scanning for injected instructions
- [x] Input schema validation (Zod) before any tool executes
- [x] Permissions declared in manifest, checked before execution
- [x] Sensitive tools (delete, send, write) require explicit confirmation
- [x] Secrets in Cloudflare Secrets / Vault (never in code or env files)
- [x] Audit log for every tool call (who, what, when, result)
- [x] Rate limiting per user session
- [x] No token passthrough to downstream services

---

# SECTION II: CORE ENGINE, MEMORY & AGENT RUNTIME

---

## Part 7 — The Plugin/Module System Explained

### 7.1 Why Modular?
Monoliths create tight coupling and single points of failure. The modular approach makes each capability independently deployable, scoped, and testable.

### 7.2 The Module Interface
```typescript
interface Module {
  manifest(): Manifest
  initialize(ctx: ModuleContext): Promise<void>
  tools(): Tool[]
  resources(): Resource[]
  prompts(): Prompt[]
  shutdown(): Promise<void>
}
```

### 7.3 The Manifest File (`manifest.yaml`)
```yaml
id: github
kind: connector
version: 2.0
dependencies:
  - auth
  - cache
permissions:
  - github.read
  - github.write
tools:
  - id: github.search_repo
    description: Search GitHub repositories by query
    input: { query: string, limit?: number }
    output: { repositories: Repository[] }
    cost: low
    latency: medium
  - id: github.create_issue
    description: Create a new issue in a repository
    permissions: [github.write]
    requires_confirmation: true
events:
  emits:
    - pull_request.created
    - issue.updated
  listens:
    - workspace.sync
prompts:
  - review_pr
  - summarize_diff
resources:
  - github_api_schema
```

### 7.4 The Tool Registry
Maps `tool_id` → `{ module_id, handler_function, schema, permissions }`. The Gateway validates auth, permissions, and input schemas before dispatching execution to handler functions.

### 7.5 The Event Bus
Modules communicate loosely via events (`pull_request.created`, `issue.updated`). No module holds direct code dependencies on peer modules.

### 7.6 Plugin Lifecycle
`INSTALL -> LOAD -> INITIALIZE -> REGISTER -> READY <-> SUSPEND -> UNLOAD -> HOT RELOAD`

---

## Part 8 — Memory Architecture Explained

### 8.1 Why Claude Needs External Memory
Claude's context window resets between conversations. External memory provides:
1. Intra-conversation retrieval of past context.
2. Cross-conversation persistence of facts, preferences, and project states.

### 8.2 The Four Memory Layers
- **L1 — Working Memory (In-Process Cache)**: In-memory volatile cache (nanosecond latency).
- **L2 — Project Memory (SQLite / Turso)**: Persistent facts, project states, key-value data (microsecond latency).
- **L3 — Semantic Memory (LanceDB / Qdrant)**: Embeddings & vector similarity search (millisecond latency).
- **L4 — Archive Storage (Cloudflare R2 / S3)**: Cold compressed historical logs and document snapshots (second latency).

### 8.3 Context Budget Manager
Enforces strict prompt allocation:
```
MAX_CONTEXT = 200,000 tokens
Reserve: System Prompt (-2,000) | Tool Schemas ≤10 (-3,000) | User Query (-500) | Output (-4,000)
Available for Context = ~190,500 tokens
Fallback Sequence: Summarize history -> Drop low-relevance memories -> Truncate tool output
```

---

## Part 9 — The Agent Runtime Explained

### 9.1 What Is an Agent?
An agent is a module capable of multi-step planning, subtask generation, tool execution, and output synthesis.

### 9.2 The Planner
Converts user intent into a Directed Acyclic Graph (DAG) execution plan where independent nodes run in parallel.

### 9.3 Specialized Agents
- **Planner**: Generates execution DAG.
- **Researcher**: Crawls and synthesizes web/workspace data.
- **Coder**: Edits and generates codebase patches.
- **Reviewer**: Performs security and correctness audits.
- **Debugger**: Analyzes logs and stack traces.
- **Documenter**: Generates markdown documentation.
- **Executor**: Runs tools and API integrations.
- **Orchestrator**: Routes requests and merges outputs.

### 9.4 Workflow Engine (`workflows/review_pr.yaml`)
```yaml
name: review_pr
description: Full PR review workflow
triggers:
  - manual
  - pull_request.created
steps:
  - id: fetch_pr
    tool: github.get_pull_request
    input: { number: "{{ inputs.pr_number }}" }
  - id: read_files
    tool: filesystem.read_files
    input: { paths: "{{ steps.fetch_pr.output.changed_files }}" }
    depends_on: [fetch_pr]
  - id: security_check
    tool: github.search_repo
    depends_on: [fetch_pr]
  - id: analyze
    agent: reviewer
    input:
      files: "{{ steps.read_files.output }}"
      security: "{{ steps.security_check.output }}"
    depends_on: [read_files, security_check]
  - id: post_comment
    tool: github.create_review_comment
    input: { body: "{{ steps.analyze.output.review }}" }
    depends_on: [analyze]
    requires_confirmation: true
    timeout: 30s
    retry: 3
```

---

## Part 10 — The Technology Stack, Explained in Depth

- **Bun**: Ultra-fast JS/TS runtime, built-in SQLite driver, zero compilation step.
- **Hono**: 13KB edge-compatible HTTP framework (Cloudflare, Fly.io, Bun).
- **Zod**: TypeScript-first schema declaration and input validation.
- **Drizzle ORM**: Lightweight, type-safe SQL ORM for SQLite/Turso.
- **SQLite via Turso**: Edge-replicated serverless database (500MB storage, 1B row reads/mo free).
- **Upstash Redis**: Serverless Redis cache for distributed sessions and rate limiting.
- **LanceDB / Qdrant**: Embedded vector database for local semantic search.
- **Meilisearch**: Fast full-text search engine with typo tolerance.
- **Better Auth**: Self-hosted OAuth 2.1 / DCR authentication framework.
- **Inngest**: Durable function execution and background job queue.
- **Pino**: High-performance structured JSON logging.
- **OpenTelemetry**: Standardized distributed tracing, metrics, and logs.
- **React + Vite + Tailwind**: Modern frontend suite for dashboard and MCP Apps.
- **Deployment**: Cloudflare Workers (Gateway) + Turso (DB) + Upstash (Cache) + Fly.io (Workers).

---

## Part 11 — The Model-Agnostic Adapter Layer

Build the core runtime completely decoupled from Claude. Use thin adapters:
- `MCP Adapter`: Communicates with Claude Mobile/Desktop over Streamable HTTP.
- `OpenAI Adapter`: Serves ChatGPT function calling.
- `Gemini Adapter`: Serves Google AI tool use.
- `REST Adapter`: Exposes REST endpoints.
- `CLI Adapter`: Provides terminal execution.

---

## Part 12 — The Development Roadmap, Explained

- **Phase 1 — Foundation (Week 1–2)**: Bun + Hono MCP server, `workspace` tool, OAuth 2.1 + DCR, Cloudflare deploy.
- **Phase 2 — Core Runtime (Week 3–4)**: Kernel loader, EventEmitter3, SQLite L2 + LanceDB L3, Context Budget Manager.
- **Phase 3 — Capability Modules (Week 5–8)**: Filesystem, GitHub, Search, Notes modules with YAML manifests.
- **Phase 4 — Intelligence (Week 9–12)**: Planner, Inngest workflow scheduler, Calendar, Gmail, Browser modules.
- **Phase 5 — Platform (Month 4+)**: Admin dashboard (React+Vite), `claudeos` CLI, module marketplace.

---

## Part 13 — Complete Project Structure with Explanations

```
claude-hub/
├── apps/
│   ├── gateway/              # The ONE MCP server endpoint Claude sees
│   └── dashboard/            # Admin UI (React + Vite + Tailwind)
├── packages/
│   ├── kernel/               # Loader, registry, lifecycle, DI, permissions
│   ├── mcp-server/           # MCP protocol, Streamable HTTP, OAuth 2.1, DCR
│   ├── memory/               # L1 cache, L2 SQLite, L3 LanceDB
│   ├── context/              # Context Budget Manager
│   ├── events/               # EventEmitter3 bus
│   ├── auth/                 # Better Auth + token storage
│   ├── scheduler/            # Inngest background jobs
│   ├── planner/              # DAG planner & agents
│   ├── logger/               # Pino structured logging
│   ├── telemetry/            # OpenTelemetry tracing
│   └── sdk/                  # Plugin developer SDK
├── modules/                  # Modular capabilities (filesystem, github, search, etc.)
├── skills/                   # High-level composite skills
├── deployment/               # Cloudflare Workers, Fly.io, Docker
└── docs/                     # Documentation wiki
```

---

## Part 14 — Complete Summary: Every Concept in One Place

### The Three Rules
1. One connector visible to Claude → unlimited modules behind it.
2. ≤10 tools in Claude's context at any time → use dynamic tool selection.
3. Never trust tool output → scan it as if it were untrusted HTML.

### The Five Layers
`Layer 1: Claude Mobile -> Layer 2: MCP Hub Gateway -> Layer 3: Plugin Kernel -> Layer 4: Capability Modules -> Layer 5: Infrastructure`

---

# SECTION III: CONTEXT OPTIMIZATION, BIDIRECTIONALITY & PROTOCOLS

---

## Part 15 — The Context Pollution Crisis

### 15.1 The Problem Is Worse Than You Think
MCP tools can consume 66,000+ to 98,700+ tokens of context before a single message is typed. Preloading 50+ tool schemas burns up to 50% of the context window.

### 15.2 Tool Schema Token Cost
Every tool description, parameter schema, and constraint counts against prompt tokens.

### 15.3 Why More Tools = Worse Performance
Exposing >30–50 tools causes reasoning accuracy to collapse. Cursor caps tools at 40; Copilot caps at 128.

### 15.4 The Solution: MCP Tool Search
Anthropic's MCP Tool Search loads tool names initially (~200 tokens) and dynamically fetches top 3–5 schemas on demand, delivering an **85% token reduction**.

### 15.5 Your Gateway's Dynamic Tool Selection Strategy
Expose 1 unified `workspace` tool (~500 tokens) that fans out internally to hundreds of capabilities.

### 15.6 Pagination: The Other Context Overflow Problem
Always enforce pagination on list tools to avoid dumping thousands of items into context.

---

## Part 16 — Sampling and Elicitation: MCP Goes Bidirectional

### 16.1 The Old Mental Model Was Wrong
MCP is bidirectional: servers can issue requests back to client LLMs and users.

### 16.2 Sampling: Your Server Asks Claude to Think
`ctx.client.sampling.createMessage()` allows the server to pause execution and ask Claude to perform mid-task reasoning (e.g., classifying security severity).

### 16.3 Elicitation: Your Server Asks the User a Question
`ctx.client.elicitation.create()` prompts the user for structured input or confirmation before executing dangerous tools.

### 16.4 When to Use Each Pattern
- **Sampling**: Server needs LLM reasoning/classification.
- **Elicitation**: Server needs user confirmation, choices, or credentials.

### 16.5 Recursive Agentic Behavior
Combining Sampling and Elicitation creates self-contained agentic loops inside a single tool execution.

---

## Part 17 — The A2A Protocol: Agent-to-Agent Communication

### 17.1 Why A2A Exists
- **MCP**: Connects Agents to Tools.
- **A2A**: Connects Agents to Agents.

### 17.2 How MCP and A2A Work Together
An agent uses MCP to interact with tools, and A2A to delegate subtasks to peer specialist agents.

### 17.3 The Protocol Stack Summarized
`Claude Mobile -> MCP -> Hub Gateway (Orchestrator) -> A2A -> Sub-Agents -> MCP -> Tools`

### 17.4 A2A Security Warning
Validate Agent Cards cryptographically to prevent prompt injection hijacking in agent selection logic.

---

# SECTION IV: COMPLETE REFERENCE IMPLEMENTATION

---

## Part 18 — Complete Implementation: Building the Hub Gateway from Zero

### 18.1 Entry Point (`src/index.ts`)
```typescript
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger as honoLogger } from 'hono/logger'
import { mcpRouter } from './mcp/server'
import { authRouter } from './auth/router'
import { healthRouter } from './routes/health'
import { logger } from './logger'
import { kernel } from './kernel'

const app = new Hono()

app.use('*', cors({
  origin: ['https://claude.ai', 'https://*.anthropic.com'],
  allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Authorization', 'Content-Type', 'MCP-Session-Id'],
  exposeHeaders: ['MCP-Session-Id'],
}))
app.use('*', honoLogger())

app.route('/mcp', mcpRouter)
app.route('/auth', authRouter)
app.route('/health', healthRouter)

await kernel.start()
logger.info('Kernel started — all modules loaded')

export default {
  port: process.env.PORT || 3000,
  fetch: app.fetch,
}
```

### 18.2 MCP Server (`src/mcp/server.ts`)
```typescript
import { Hono } from 'hono'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { z } from 'zod'
import { kernel } from '../kernel'
import { validateAuth } from '../auth/middleware'
import { logger } from '../logger'

export const mcpRouter = new Hono()

const mcpServer = new McpServer({
  name: 'claude-hub',
  version: '1.0.0',
})

mcpServer.tool(
  'workspace',
  'Unified workspace access. Actions: search, memory, files, github, notes, workflow, admin',
  {
    action: z.string().describe('The action to perform'),
    params: z.record(z.any()).optional().describe('Action parameters'),
  },
  async ({ action, params = {} }, { session }) => {
    const userId = session?.userId
    if (!userId) throw new Error('Unauthorized')
    logger.info({ action, userId }, 'Tool invoked')

    try {
      const result = await kernel.invoke(action, params, { userId })
      return {
        content: [{
          type: 'text',
          text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
        }]
      }
    } catch (error: any) {
      logger.error({ action, error }, 'Tool execution failed')
      return {
        content: [{
          type: 'text',
          text: `Error: ${error.message}`
        }],
        isError: true
      }
    }
  }
)

mcpServer.resource(
  'workspace-schema',
  'workspace://schema',
  async () => ({
    contents: [{
      uri: 'workspace://schema',
      mimeType: 'application/json',
      text: JSON.stringify(kernel.getSchema(), null, 2)
    }]
  })
)

mcpRouter.all('/', validateAuth, async (c) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
  })
  await mcpServer.connect(transport)
  const response = await transport.handle(c.req.raw)
  return new Response(response.body, {
    status: response.status,
    headers: response.headers,
  })
})
```

### 18.3 Kernel Core (`src/kernel/index.ts`)
```typescript
import { EventEmitter } from 'eventemitter3'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { logger } from '../logger'

export class Kernel {

  private modules = new Map<string, any>()
  private tools = new Map<string, Function>()
  private events = new EventEmitter()
  private initialized = false

  async start() {
    if (this.initialized) return
    const modulesDir = join(import.meta.dir, '../../modules')
    const entries = await readdir(modulesDir, { withFileTypes: true })
    const moduleDirs = entries.filter(e => e.isDirectory()).map(e => e.name)

    for (const moduleId of moduleDirs) {
      await this.loadModule(modulesDir, moduleId)
    }
    this.initialized = true
    logger.info({ modules: [...this.modules.keys()] }, 'Kernel ready')
  }

  private async loadModule(baseDir: string, moduleId: string) {
    try {
      const modulePath = join(baseDir, moduleId, 'index.ts')
      const { default: ModuleClass } = await import(modulePath)
      const ctx = this.createContext(moduleId)
      const module = new ModuleClass()
      await module.initialize(ctx)

      for (const tool of module.tools()) {
        const fullId = `${moduleId}.${tool.id}`
        this.tools.set(fullId, tool.execute)
        logger.debug({ toolId: fullId }, 'Tool registered')
      }
      this.modules.set(moduleId, module)
      this.events.emit('module:loaded', { moduleId })
    } catch (error) {
      logger.error({ moduleId, error }, 'Failed to load module')
    }
  }

  async invoke(action: string, params: Record<string, any>, ctx: { userId: string }) {
    const handler = this.tools.get(action) || this.tools.get(`github.${action}`) || this.tools.get(`filesystem.${action}`)
    if (!handler) throw new Error(`Unknown action: ${action}`)

    const start = performance.now()
    try {
      const result = await handler(params, ctx)
      const duration = performance.now() - start
      this.events.emit('tool:executed', { action, userId: ctx.userId, duration, success: true })
      return result
    } catch (error: any) {
      this.events.emit('tool:failed', { action, userId: ctx.userId, error })
      throw error
    }
  }

  getSchema() {
    const schema: Record<string, any> = {}
    for (const [toolId] of this.tools) {
      schema[toolId] = { available: true }
    }
    return schema
  }

  private createContext(moduleId: string) {
    return {
      logger: logger.child({ module: moduleId }),
      events: this.events,
      invoke: this.invoke.bind(this),
      config: { get: (key: string) => process.env[key] },
    }
  }
}

export const kernel = new Kernel()
```

### 18.4 GitHub Capability Module (`modules/github/index.ts`)
```typescript
import { z } from 'zod'
import { Octokit } from 'octokit'

export default class GitHubModule {
  private octokit!: Octokit
  private ctx!: any

  manifest() {
    return {
      id: 'github',
      version: '2.0.0',
      permissions: ['github.read', 'github.write'],
      dependencies: ['auth', 'cache'],
    }
  }

  async initialize(ctx: any) {
    this.ctx = ctx
    const token = ctx.config.get('GITHUB_TOKEN')
    if (!token) throw new Error('GITHUB_TOKEN not configured')
    this.octokit = new Octokit({ auth: token })
    ctx.logger.info('GitHub module initialized')
  }

  tools() {
    return [
      {
        id: 'search_repo',
        description: 'Search GitHub repositories',
        inputSchema: z.object({
          query: z.string().min(1),
          limit: z.number().int().min(1).max(30).default(10),
        }),
        execute: this.searchRepo.bind(this),
      },
      {
        id: 'read_file',
        description: 'Read a file from a GitHub repository',
        inputSchema: z.object({
          owner: z.string(),
          repo: z.string(),
          path: z.string(),
          ref: z.string().default('main'),
        }),
        execute: this.readFile.bind(this),
      },
      {
        id: 'create_issue',
        description: 'Create a new GitHub issue',
        inputSchema: z.object({
          owner: z.string(),
          repo: z.string(),
          title: z.string().min(1).max(256),
          body: z.string().optional(),
        }),
        execute: this.createIssue.bind(this),
      },
    ]
  }

  private async searchRepo({ query, limit }: { query: string; limit: number }) {
    const { data } = await this.octokit.rest.search.repos({ q: query, per_page: limit })
    return {
      total: data.total_count,
      repositories: data.items.map(r => ({
        name: r.full_name,
        description: r.description,
        stars: r.stargazers_count,
        url: r.html_url,
      })),
    }
  }

  private async readFile({ owner, repo, path, ref }: any) {
    const { data } = await this.octokit.rest.repos.getContent({ owner, repo, path, ref })
    if ('content' in data) {
      return {
        path,
        content: Buffer.from(data.content, 'base64').toString('utf-8'),
        size: data.size,
      }
    }
    throw new Error(`${path} is a directory`)
  }

  private async createIssue({ owner, repo, title, body }: any) {
    const { data } = await this.octokit.rest.issues.create({ owner, repo, title, body })
    return { number: data.number, title: data.title, url: data.html_url }
  }
}
```

---

## Part 19 — Production Operations

- **OpenTelemetry Integration**: Traces tool calls, latencies, and token metrics.
- **Rate Limiting Middleware**: Upstash Redis sliding window (60 req/min tool limit).
- **Structured Pino Logging**: Redacts authorization tokens, logs JSON metrics.
- **Cloudflare Workers Config (`wrangler.toml`)**: Edge deployment configuration with R2 and D1 bindings.
- **Health Checks (`src/routes/health.ts`)**: Liveness (`/health`) and readiness (`/health/ready`) probes.

---

## Part 20 — Tool Design Patterns and Best Practices

1. **Single Responsibility**: One tool = one clear action. Avoid monolithic multi-action tools.
2. **Description Quality**: State purpose, return fields, use cases, non-use cases, and sample inputs.
3. **Structured Errors**: Catch exceptions and return structured JSON errors (`success: false`). Never leak raw stack traces.
4. **Idempotency**: Prevent duplicate writes by checking existing resources before mutating.
5. **No `console.log` in `stdio`**: Use `console.error` for debug logs to prevent JSON-RPC stream corruption.

---

## Part 21 — The Complete Development Workflow

```bash
# Day 1 Checklist
bun init
bun add hono @modelcontextprotocol/sdk zod pino
# Start local server and tunnel via cloudflared
cloudflared tunnel --url http://localhost:3000
# Add connector URL at claude.ai -> Syncs automatically to Claude Mobile
```

---

## Part 22 — The Full Ecosystem Map

```
CLIENTS (Claude Mobile, Desktop, Claude Code, ChatGPT, Gemini)
   │ MCP 2026-07-28 (Streamable HTTP + OAuth 2.1)
GATEWAY LAYER (Hub Gateway + Auth + Rate Limiting + Router)
   │
KERNEL LAYER (Loader + Registry + Permissions + Events + Context Manager)
   │
INTELLIGENCE LAYER (Planner + Memory L1-L4 + Workflows + Agents)
   │
MODULE LAYER (filesystem, github, search, gmail, calendar, sql, rag)
   │
INFRASTRUCTURE (SQLite/Turso, Redis, LanceDB, Meilisearch, R2, Inngest)
```

---

## Part 23 — Everything That Matters, in One Final Reference

- **1** Connector visible to Claude.
- **7** Workspace actions (`workspace.*`).
- **85%** Token reduction from Tool Search.
- **5 Production Rules**: No schema dumping, no stack trace leaks, no token passthrough, no static client sharing, mandatory audit logging.

---

# SECTION V: ADVANCED PROTOCOL CAPABILITIES & TOPOLOGIES

---

## Part 24 — MCP Server Cards: The Discovery Revolution

Expose server metadata at `/.well-known/mcp/server-card.json` (SEP-1649) to allow clients and crawlers to discover server tools, transports, auth parameters, and rate limits without establishing a full TCP/MCP session.

---

## Part 25 — Skills vs. MCP Servers: The Most Important Distinction

| Aspect | Claude Skill | MCP Server |
|---|---|---|
| **Purpose** | Teaches Claude HOW to perform a task | Gives Claude ACCESS to external systems |
| **Token Cost** | ~30–50 tokens (Level 1 summary) | ~500–2,000+ tokens per tool schema |
| **Execution** | Reads markdown instructions (`SKILL.md`) | Runs backend code over Streamable HTTP |
| **Packaging** | Local directory (`.claude/skills/`) | Remote HTTP server endpoint |

---

## Part 26 — Triggers: MCP Becomes Event-Driven

Triggers enable push-based notifications from server to client (`pull_request.created`). While awaiting protocol finalization, simulate triggers using Inngest background polling jobs.

---

## Part 27 — Streaming and Reference-Based Results

When returning large datasets (>50 items or >10KB text), return a **reference handle** (`ref_id`) and preview excerpt. Claude uses `workspace.query_result(ref_id, offset, limit)` to fetch paginated slices on demand.

---

## Part 28 — Advanced Security: DPoP and Workload Identity

- **DPoP (Demonstrating Proof-of-Possession)**: Cryptographically binds OAuth tokens to client key pairs to prevent stolen token reuse.
- **Workload Identity**: Uses OIDC tokens (GCP, AWS, GitHub Actions) for machine-to-machine authentication without static secrets.

---

## Part 29 — The Four Enterprise Deployment Topologies

1. **Topology 1 (Single-Tenant)**: Personal Hub Gateway on Cloudflare Workers + Turso.
2. **Topology 2 (Multi-Tenant Row-Isolated)**: Multi-user gateway with strict `user_id` database filtering.
3. **Topology 3 (Federated Gateway)**: Central enterprise gateway routing to internal private MCP servers.
4. **Topology 4 (Edge-Cached Read-Only)**: Edge CDN caching for high-volume discovery endpoints (`tools/list`).

---

## Part 30 — The MCP Registry Ecosystem

Search 9,400+ community MCP servers before building custom code. Use **FastMCP** for rapid prototype servers; use official `@modelcontextprotocol/sdk` for full Gateway control.

---

## Part 31 — Cost Modeling and Optimization

- **Hub Gateway**: Reduces schema token overhead by ~93% ($0.011 vs $0.15 per conversation).
- **Caching Hierarchy**: L1 (In-process Map) -> L2 (Redis) -> L3 (SQLite) -> L4 (External API).

---

## Part 32 — The Complete Skills System Implementation

Expose skills as MCP resources (`skills://{name}`) so Claude can read workflow instructions dynamically without executing backend code.

---

## Part 33 — Multi-Agent Patterns in Depth

Implement execution graphs with sequential chains, parallel fan-out, and hierarchical orchestrator-worker nodes supporting retries, timeouts, and fallback branching.

---

## Part 34 — Observability Dashboard in Practice

Track tool invocation counters, latency histograms, token usage gauges, and automated anomaly detection for prompt injection patterns.

---

## Part 35 — The Final Integration Blueprint

Complete end-to-end trace of a user query through Cloudflare Workers -> Auth Validation -> Kernel Dispatch -> GitHub Module -> Audit Log -> Response.

---

# SECTION VI: EXTENSION SURFACE, AUTOMATION, CODE MODE & ENTERPRISE

---

## Part 36 — The Four Layers of Claude Code Extensions (Clarified)

```
Connector = Remote MCP Server endpoint
Skill     = SKILL.md process instructions
Hook      = Automatic lifecycle event script
Plugin    = Installable Git bundle containing { Skills + Hooks + MCP + Agents }
Subagent  = Isolated Claude instance with specialized context & persona
```

---

## Part 37 — Hooks: Automation at Every Lifecycle Point

Hooks run zero-token lifecycle scripts in `.claude/settings.json`:
- `PreToolUse`: Intercepts and blocks dangerous commands or secrets.
- `PostToolUse`: Records immutable audit logs.
- `Stop`: Sends Slack notifications on long job completions.

### Secret Detection Hook (`detect-secrets.sh`)
```bash
#!/bin/bash
INPUT=$(cat)
CONTENT=$(echo "$INPUT" | jq -r '.input.content // empty')
if echo "$CONTENT" | grep -qiE "(sk-[a-zA-Z0-9]{32,}|ghp_[a-zA-Z0-9]{36}|AKIA[A-Z0-9]{16})"; then
  echo '{"decision": "block", "reason": "Secret detected. Use environment variables."}'
  exit 0
fi
exit 0
```

---

## Part 38 — Programmatic Tool Calling: The Paradigm Shift (Code Mode)

Instead of making 30 sequential tool calls over JSON-RPC, Claude writes a single TypeScript script that executes inside a secure sandbox module (`modules/sandbox`), achieving **10× speedups and 99% token savings**.

```typescript

// Sandboxed execution of tool chains in a single turn
const files = await search("auth")
for (const f of files) {
  const content = await readFile(f.path)
  if (content.includes("deprecated")) {
    await createGitHubIssue("owner", "repo", `Update ${f.path}`)
  }
}
result = "Completed scan and created issues"
```

---

## Part 39 — Live Artifacts: The Newest MCP Capability

Claude artifacts can now embed live MCP connector calls that execute directly inside the viewer's browser session using the viewer's own permissions.

---

## Part 40 — Enterprise-Managed Authorization: Okta Integration

Okta/IdP integrations automatically provision MCP permissions based on enterprise directory groups, enabling zero-touch user onboarding and instant revocation.

---

## Part 41 — The Anti-Pattern Catalog (What Not to Build)

1. **Auto-Generated REST MCP**: Creates 800+ bloated tools. Hand-craft human-shaped tools instead.
2. **Code-Mirroring Descriptions**: Describe purpose and use cases, not internal API code.
3. **Raw API Dumping**: Strip unused fields; return lean JSON representations.
4. **Stateful Servers**: Store state in Redis/SQLite, not server RAM.
5. **Blocking Long Tasks**: Return Task Handles immediately for operations >60s.
6. **Non-Idempotent Mutations**: Prevent duplicate creation on retries.
7. **Missing OAuth `iss`**: Always supply the `iss` parameter (RFC 9207).

---

## Part 42 — Subagents: Parallel Work with Isolated Context

Subagents (`.claude/agents/`) isolate domain-specific tasks in fresh context windows, preventing context bloat in main conversations.

---

## Part 43 — The MCP Programmatic Tool Calling Best Practices

Implement semantic `_search_tools` endpoints, defer tool schema loading, and enforce paginated responses.

---

## Part 44 — The Complete Integration Matrix

Comprehensive mapping across Claude Mobile, Desktop, Claude Code CLI, Live Artifacts, and Enterprise Okta deployments.

---

## Part 45 — The Final Production Hardening Checklist

Full operational readiness checklist spanning OAuth 2.1 PKCE, DPoP, Zod schema validation, threat scanning, rate limiting, audit logging, and edge serverless deployment.

---

*Document Version: v9 (Traceability Documentation & Master Extended Wiki)*
*Traceability Target Repository: Abdus2023/GAR-II (`arena/019f9179-gar-ii`)*
