# Development Roadmap – Claude OS / Agentic-Native Runtime

## Vision

Build a production-grade, model-agnostic AI runtime that starts as a single MCP connector for Claude Free users and evolves into a full AI Operating System.

---

## Phase Overview

| Phase | Name                    | Duration     | Focus                              | Goal |
|-------|-------------------------|--------------|------------------------------------|------|
| 1     | Foundation              | Week 1–2     | Core gateway & basic tools         | Working MCP endpoint |
| 2     | Core Runtime            | Week 3–4     | Memory, context, permissions       | Intelligent behavior |
| 3     | Capability Modules      | Week 5–8     | Real integrations                  | Useful daily tools |
| 4     | Intelligence            | Week 9–12    | Planner, agents, workflows         | Autonomous execution |
| 5     | Platform                | Month 4+     | SDK, marketplace, enterprise       | Ecosystem |

---

## Phase 1 – Foundation (Week 1–2)

**Objective**: Deploy a working Hub Gateway that Claude can connect to.

### Deliverables

- [ ] `apps/gateway` – Hono + MCP SDK server
- [ ] `tools/list` and `tools/call` endpoints
- [ ] Basic authentication (Better Auth + OAuth DCR)
- [ ] Plugin manifest loader + registry
- [ ] Simple capability: `workspace.search` (stub)
- [ ] Pino logging + basic OpenTelemetry
- [ ] Deploy to Cloudflare Workers
- [ ] Public URL via Cloudflare Tunnel / ngrok
- [ ] Documentation: how to add to claude.ai

**Success Criteria**
- Claude can call the hub and receive a response
- One remote connector works on Free tier
- Mobile sync verified

---

## Phase 2 – Core Runtime (Week 3–4)

**Objective**: Add intelligence and safety layers.

### Deliverables

- [ ] Context Budget Manager (`packages/context`)
- [ ] Memory layers L1 (cache) + L2 (Turso)
- [ ] L3 Semantic memory (LanceDB)
- [ ] Event bus (`packages/events`)
- [ ] Capability-based permission engine
- [ ] Meilisearch hybrid search integration
- [ ] Basic audit logging
- [ ] Rate limiting per session

**Success Criteria**
- System never exceeds ~10 tools in context
- Memory retrieval works across sessions
- Permissions block unauthorized actions

---

## Phase 3 – Capability Modules (Week 5–8)

**Objective**: Deliver real value through useful integrations.

### Modules to Build

| Module       | Priority | Tools Exposed                     | Notes |
|--------------|----------|-----------------------------------|-------|
| `filesystem` | High     | read, write, list, search         | Local + R2 |
| `github`     | High     | search_repo, review_pr, create_issue | OAuth |
| `browser`    | High     | open_page, extract_content        | Playwright or browserless |
| `search`     | High     | web_search, workspace_search      | Meilisearch + web |
| `notes`      | Medium   | create, search, summarize         | Personal knowledge base |
| `calendar`   | Medium   | list, create, search              | Google Calendar |
| `gmail`      | Medium   | read, search, send (with confirm) | Gmail API |
| `sql`        | Low      | query, schema                     | Read-only initially |

**Success Criteria**
- At least 5 production-ready modules
- All tools pass schema validation
- Confirmation gate works for write/send/delete actions

---

## Phase 4 – Intelligence (Week 9–12)

**Objective**: Move from reactive tools to proactive agents.

### Deliverables

- [ ] Intent Planner (`packages/planner`)
- [ ] Execution Graph (DAG) engine
- [ ] Multi-agent orchestration (Researcher, Coder, Reviewer, Executor)
- [ ] Workflow engine integration (Inngest)
- [ ] Background job scheduler
- [ ] Hybrid search (keyword + semantic + graph)
- [ ] Model Router (Claude + fallback models)
- [ ] Dynamic prompt compiler

**Success Criteria**
- Complex multi-step tasks succeed without manual tool selection
- Workflows can run in background and notify user
- System chooses best model per subtask

---

## Phase 5 – Platform (Month 4+)

**Objective**: Turn the runtime into an extensible ecosystem.

### Deliverables

- [ ] Official Plugin SDK (`packages/sdk`)
- [ ] CLI tool (`claudeos`)
- [ ] Admin Dashboard (React + Vite)
- [ ] Module signing & verification
- [ ] Public marketplace (optional)
- [ ] Policy engine (RBAC + org policies)
- [ ] Visual workflow editor
- [ ] Multi-tenant support
- [ ] Additional adapters (OpenAI, Gemini, local models)

**Success Criteria**
- Third-party developers can build and publish modules
- Enterprise features available
- Runtime works with multiple AI frontends

---

## Long-Term Vision (2026–2027)

- Distributed runtime across edge + cloud
- Self-updating modules with semantic discovery
- Full knowledge graph memory
- Autonomous agent swarms
- Marketplace with revenue sharing
- Open-source core + commercial enterprise edition

---

## Risk & Mitigation

| Risk                        | Mitigation                              | Phase |
|----------------------------|-----------------------------------------|-------|
| Tool count explosion       | Context Budget Manager (hard limit)     | 2     |
| Security vulnerabilities   | Capability ACL + audit + confirmation   | 1–2   |
| Performance on mobile      | Aggressive context compression          | 2     |
| Third-party module abuse   | Module signing + sandboxing             | 5     |
| Vendor lock-in             | Model-agnostic adapters from day one    | 1     |

---

*This roadmap is living — it will be updated after each phase based on learnings.*