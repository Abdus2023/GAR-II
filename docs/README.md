# Claude OS Documentation Index & Master Extended Wiki

Welcome to the official documentation and wiki portal for **Claude OS / Agentic-Native Runtime (ANR)**.

This is the single source of truth for architecture, security, development, and operations across all **45 Parts** of the platform guide.

---

## Master Extended Wiki & Traceability

| Document | Purpose | Audience |
|---|---|---|
| **[WIKI_EXTENDED.md](./WIKI_EXTENDED.md)** | **Master Extended Wiki Navigation Portal** & Component Index | Everyone |
| **[COMPREHENSIVE_TRACEABILITY_v9.md](./COMPREHENSIVE_TRACEABILITY_v9.md)** | **Complete Traceability Wiki Extended v9** (Master Technical Specs, Parts 1–45) | Engineers & Architects |
| **[WIKI.md](./WIKI.md)** | Core Wiki Portal & Glossary | Everyone |
| **[README.md](../README.md)** | High-level repository overview & quickstart | Everyone |
| **[ARCHITECTURE.md](./ARCHITECTURE.md)** | Technical deep-dive into layers, kernel, memory, planner | Engineers & Architects |
| **[SECURITY.md](./SECURITY.md)** | Threat model, permission system, audit & confused deputy | Security & Backend teams |
| **[ROADMAP.md](./ROADMAP.md)** | Phased development plan (Phase 1–5) | Project managers & devs |
| **[GETTING_STARTED.md](./GETTING_STARTED.md)** | Local setup & first connection to Claude Mobile | New contributors |

---

## Quick Navigation

### For New Contributors
1. Start with **[WIKI_EXTENDED.md](./WIKI_EXTENDED.md)** and **[GETTING_STARTED.md](./GETTING_STARTED.md)**
2. Read the high-level overview in **[README.md](../README.md)**
3. Follow the roadmap in **[ROADMAP.md](./ROADMAP.md)**

### For Architects & Technical Leads
- **[COMPREHENSIVE_TRACEABILITY_v9.md](./COMPREHENSIVE_TRACEABILITY_v9.md)** – Comprehensive Master Extended Wiki Specs (Parts 1–45)
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** – Layered design, capability model, execution graphs
- **[SECURITY.md](./SECURITY.md)** – Capability-based security & confused deputy mitigation

### For Implementation Teams
- Phase 1 → Focus on `apps/gateway` / `src/mcp/server.ts`
- Phase 2 → `src/context/budget.ts`, `src/memory/`, `src/auth/`
- Phase 3 → Individual modules under `modules/`
- Phase 4 → `src/planner/`, `src/workflow/`
- Phase 5 → `packages/sdk`, `packages/cli`

---

## Document Status

| Document | Version | Last Updated | Status |
|---|---|---|---|
| Traceability Wiki Extended v9 | v9 | 2026-07-24 | Complete |
| Master Extended Documentation Wiki | v9 | 2026-07-24 | Complete |
| Main README | v5 | 2026-07-23 | Complete |
| Architecture | v5 | 2026-07-23 | Complete |
| Security | v1 | 2026-07-23 | Complete |
| Roadmap | v1 | 2026-07-23 | Complete |
| Getting Started | v1 | 2026-07-23 | Complete |

---

## Contributing to Documentation

All documentation lives in the `docs/` folder and follows the same structure as the codebase.

When adding new features, please also update the relevant document(s) above.

---

*Last updated: 2026-07-24*