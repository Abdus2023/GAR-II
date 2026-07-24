# Claude Hub Gateway Documentation Index

Welcome to the documentation portal for **Claude Hub Gateway (GAR-II)**.

The repository contains both current implementation documentation and older target-state architecture/wiki material. Use the table below to pick the right source.

---

## Current Source of Truth

| Document | Purpose | Audience | Status |
|---|---|---|---|
| **[COMPREHENSIVE_TRACEABILITY_v10.md](./COMPREHENSIVE_TRACEABILITY_v10.md)** | Current implementation traceability matrix | Engineers, auditors | Current |
| **[README.md](../README.md)** | Repository overview, quickstart, current limitations | Everyone | Current |
| **[PROJECT_STATUS.md](../PROJECT_STATUS.md)** | Current maturity, working features, production gaps | Product/engineering | Current |
| **[ROADMAP.md](./ROADMAP.md)** | Realistic 6–12 month roadmap | Project managers, engineers | Current |
| **[API_REFERENCE.md](./API_REFERENCE.md)** | Endpoint/tool reference | API consumers | Needs periodic sync |
| **[SECURITY.md](./SECURITY.md)** | Threat model and security guidance | Security/backend teams | Partially aspirational |
| **[MODULE_DEVELOPMENT_GUIDE.md](./MODULE_DEVELOPMENT_GUIDE.md)** | Capability module authoring | Module authors | Useful |
| **[PLUGIN_DEVELOPMENT_GUIDE.md](./PLUGIN_DEVELOPMENT_GUIDE.md)** | Plugin/SDK guidance | Plugin authors | Useful |
| **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** | Deployment notes | Operators | Needs Cloudflare revalidation |

---

## Historical / Target-State Traceability

| Document | Purpose | Status |
|---|---|---|
| **[COMPREHENSIVE_TRACEABILITY_v9.md](./COMPREHENSIVE_TRACEABILITY_v9.md)** | Broad target-state architecture/wiki reference | Historical target-state; superseded for implementation status by v10 |
| **[COMPREHENSIVE_TRACEABILITY_v8.md](./COMPREHENSIVE_TRACEABILITY_v8.md)** | Earlier target-state architecture reference | Historical |
| **[COMPREHENSIVE_TRACEABILITY_v7.md](./COMPREHENSIVE_TRACEABILITY_v7.md)** | Earlier Phase-1 snapshot | Historical; redirects to v10 |
| **[COMPREHENSIVE_TRACEABILITY_v6.md](./COMPREHENSIVE_TRACEABILITY_v6.md)** | Legacy traceability snapshot | Historical |
| **[WIKI.md](./WIKI.md)** / **[WIKI_EXTENDED.md](./WIKI_EXTENDED.md)** | Navigation and architecture wiki material | Useful but may reference aspirational components |

---

## Current Implementation Snapshot

As of the v10 traceability update:

- `npm run build` passes.
- `npm run build:sdk` passes.
- `npm test` passes with **29 test files / 65 tests**.
- MCP Streamable HTTP is e2e-tested with the official MCP SDK client.
- Dynamic module loading is implemented.
- Modules currently include filesystem, GitHub, notes, search, browser fetch, calendar REST, and echo.
- OAuth/JWT, migrations, confirmation gates, secret scanning, telemetry, dashboard, metrics, CLI, and SDK structure are implemented.
- Production blockers remain: sandboxing, enforced signed-module deployment, Cloudflare validation, RBAC, and deeper browser/calendar workflows.

---

## Quick Navigation

### New Contributors
1. Read [README.md](../README.md).
2. Read [PROJECT_STATUS.md](../PROJECT_STATUS.md).
3. Read [COMPREHENSIVE_TRACEABILITY_v10.md](./COMPREHENSIVE_TRACEABILITY_v10.md).
4. Run `npm install`, `npm run build`, and `npm test`.

### Architects and Technical Leads
- [COMPREHENSIVE_TRACEABILITY_v10.md](./COMPREHENSIVE_TRACEABILITY_v10.md) — current implementation matrix.
- [ARCHITECTURE.md](./ARCHITECTURE.md) — layered design background.
- [SECURITY.md](./SECURITY.md) — threat model and controls.
- [ROADMAP.md](./ROADMAP.md) — current roadmap.

### Implementation Teams
- Adapter/MCP: `src/mcp/server.ts`, `src/index.ts`, `src/node.ts`
- Kernel/modules: `src/kernel/`, `modules/`
- Security: `src/security/`, `src/middleware/`
- Database: `src/database/`, `drizzle/`
- Workflows/planning: `src/workflow/`, `src/planner/`
- CLI/SDK: `packages/cli/`, `packages/sdk/`
- Tests: `tests/`

---

## Documentation Maintenance Rule

When changing runtime behavior, update at least one of:

- `COMPREHENSIVE_TRACEABILITY_v10.md` for implementation traceability,
- `PROJECT_STATUS.md` for maturity/status,
- `README.md` for user-facing setup/runtime changes,
- `docs/ROADMAP.md` for roadmap or gap changes.

---

*Last updated: 2026-07-24*
