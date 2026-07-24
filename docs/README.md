# Claude OS Documentation Index

Welcome to the official documentation for **Claude OS / Agentic-Native Runtime (ANR)**.

This is the single source of truth for architecture, security, development, and operations.

---

## Core Documents

| Document                    | Purpose                                      | Audience                  |
|----------------------------|----------------------------------------------|---------------------------|
| [README.md](../README.md)  | Full traceability & high-level architecture  | Everyone                  |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Technical deep-dive into layers, kernel, memory, planner | Engineers & Architects |
| [SECURITY.md](./SECURITY.md)     | Threat model, permission system, audit       | Security & Backend teams  |
| [ROADMAP.md](./ROADMAP.md)       | Phased development plan (Phase 1–5)          | Project managers & devs   |
| [GETTING_STARTED.md](./GETTING_STARTED.md) | Local setup & first connection to Claude | New contributors          |

---

## Quick Navigation

### For New Contributors
1. Start with **[GETTING_STARTED.md](./GETTING_STARTED.md)**
2. Read the high-level overview in **[README.md](../README.md)**
3. Follow the roadmap in **[ROADMAP.md](./ROADMAP.md)**

### For Architects & Technical Leads
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** – Layered design, capability model, execution graphs
- **[SECURITY.md](./SECURITY.md)** – Capability-based security & confused deputy mitigation

### For Implementation Teams
- Phase 1 → Focus on `apps/gateway`
- Phase 2 → `packages/context`, `packages/memory`, `packages/permissions`
- Phase 3 → Individual modules under `modules/`
- Phase 4 → `packages/planner`, `packages/workflow`
- Phase 5 → `packages/sdk`, `apps/dashboard`

---

## Document Status

| Document             | Version | Last Updated | Status     |
|----------------------|---------|--------------|------------|
| Main README          | v5      | 2026-07-23   | Complete   |
| Architecture         | v5      | 2026-07-23   | Complete   |
| Security             | v1      | 2026-07-23   | Complete   |
| Roadmap              | v1      | 2026-07-23   | Complete   |
| Getting Started      | v1      | 2026-07-23   | Complete   |

---

## Contributing to Documentation

All documentation lives in the `docs/` folder and follows the same structure as the codebase.

When adding new features, please also update the relevant document(s) above.

---

*Last updated: 2026-07-23*