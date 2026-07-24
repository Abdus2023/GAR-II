# Claude Hub Gateway

**Single MCP connector. Unlimited internal capabilities.**

Production-grade, model-agnostic AI runtime for Claude (Free tier friendly).

## Quick Start (Development)

```bash
bun install
bun run dev
```

Expose with Cloudflare Tunnel or ngrok, then add the URL at [claude.ai](https://claude.ai) → Connectors.

## Architecture

- **One Hub Gateway** (`workspace` tool)
- **Microkernel** (manifest-driven modules)
- **Skills + Hooks + Plugins** support
- **Stateless** (Cloudflare Workers ready)
- **Secure** (OAuth 2.1 + DPoP + audit logging)

## Documentation

All documentation lives in `docs/`:

- `WIKI_EXTENDED.md` — **Master Extended Wiki Portal & Component Index** (Parts 1–45)
- `COMPREHENSIVE_TRACEABILITY_v9.md` — **Master Extended Source of Truth & Wiki Specs** (v9 - Updated July 24, 2026)
- `WIKI.md` — Core Wiki Portal & Glossary
- `MODULE_DEVELOPMENT_GUIDE.md` — How to build capability modules
- `PLUGIN_DEVELOPMENT_GUIDE.md` — How to build Claude Code plugins
- `DEPLOYMENT_GUIDE.md` — Local → Production
- `API_REFERENCE.md` — Tool & kernel API reference
- `HOW_TO_TEST.md` — Testing with real Claude
- `NEXT_STEPS.md` — Prioritized action plan

## Current Status

**All 5 Phases Complete** ✅

- **Phase 1** — Foundation (Gateway, Auth, Security, Discovery)
- **Phase 2** — Core Runtime (Context Budget, Tool Search, Semantic Memory)
- **Phase 3** — Capability Modules (6 modules, 16 tools)
- **Phase 4** — Intelligence Layer (Planner, Executor, Agents, Workflows)
- **Phase 5** — Platform (Plugin SDK + CLI)

See `FINAL_STATUS.md` for a complete summary.

## License

MIT

---

Built for the future of agentic AI. One connector today. A full AI operating system tomorrow.