# Claude Hub Gateway (GAR-II)

**Single MCP connector. Dynamically loaded internal capabilities.**

Claude Hub Gateway is a TypeScript/Hono MCP gateway that exposes a compact `workspace` interface while routing work through an internal microkernel, capability modules, workflows, skills, memory, and security hooks.

> **Current maturity:** stabilized prototype / active hardening. The gateway builds, starts, loads modules dynamically, and has automated tests, but it is **not yet production-ready for untrusted multi-tenant use**. Sandbox isolation, module signing, and several real external integrations remain roadmap items.

## Quick Start

```bash
npm install
npm run build
npm test
npm run dev
```

For a built Node server:

```bash
npm run build
npm start
```

Then expose the local server with Cloudflare Tunnel or ngrok and connect Claude to the `/mcp` endpoint.

## What Works Today

- **MCP gateway** using Hono and Web Standard Streamable HTTP transport.
- **Unified `workspace` MCP tool** plus `_search_tools` discovery.
- **Dynamic capability loader** for modules under `modules/`.
- **Loaded modules:** filesystem, GitHub, notes, search, browser fetch reader, Google Calendar client, echo.
- **GitHub module:** repository search, file reads, PR review/diff fetch.
- **Filesystem module:** workspace-contained read/write/list/search with path traversal protection.
- **Memory:** SQLite/libSQL L2 memory plus LanceDB-backed L3 semantic memory.
- **Embeddings:** local hashing embeddings with cache plus optional API-backed embedding provider.
- **Workflows:** DAG executor, reusable workflow definitions, ad-hoc HTTP workflow execution.
- **OAuth/JWT:** DB-backed dynamic client registration and token issuance.
- **Security hooks:** kernel-level pre/post/error hooks, AST-assisted secret scanner, body-size limits.
- **Observability:** audit log queue, request correlation ID, dashboard, health/discovery routes.
- **Tooling:** CLI workflow runner and typed `@claude-hub/sdk` package structure.
- **CI:** automated build/test commands are available locally; GitHub workflow files still require repository workflow permission to add.

## Key Commands

```bash
npm run build          # Compile TypeScript and fix emitted ESM specifiers
npm test               # Run Vitest suite
npm run build:sdk      # Build @claude-hub/sdk declarations/output
npm run db:migrate     # Apply runtime database migrations
npm run db:generate    # Generate Drizzle migration artifacts
npm run module:sign    # Sign a capability module with an Ed25519 private key
npm start              # Run built Node HTTP server
npm run dev            # Run development server through tsx watch
```

CLI examples after the server is running:

```bash
CLAUDE_HUB_URL=http://localhost:3000 node dist/packages/cli/src/index.js module list
CLAUDE_HUB_URL=http://localhost:3000 node dist/packages/cli/src/index.js workflow run examples/workflows/echo.json --input message=Hello --json
```

## Runtime Endpoints

| Endpoint | Purpose |
|---|---|
| `/mcp` | MCP Streamable HTTP endpoint |
| `/health` | Liveness health check |
| `/.well-known/mcp/server-card.json` | MCP server-card discovery |
| `/auth/register` | OAuth dynamic client registration |
| `/auth/token` | Token issuance |
| `/api/modules` | Loaded modules/tools JSON |
| `/api/workspace` | HTTP workspace invocation |
| `/api/workflows/run` | Run registered or ad-hoc workflows |
| `/dashboard` | Protected HTML runtime dashboard |
| `/dashboard/data` | Protected dashboard JSON |

## Configuration

Copy `.env.example` to `.env` and adjust values. Important settings include:

- `JWT_SECRET`
- `MCP_SERVER_URL`
- `TURSO_DATABASE_URL`
- `GITHUB_TOKEN`
- `WORKSPACE_DIR`
- `RATE_LIMIT_*`
- `EMBEDDING_*`
- `MAX_JSON_BODY_BYTES`

Production mode rejects insecure default JWT secrets.

### Module signing

Module signature verification is configurable:

```bash
MODULE_SIGNATURE_MODE=off     # off | warn | enforce
MODULE_SIGNATURE_PUBLIC_KEYS= # comma-separated PEM keys or JSON array
```

Sign a module with:

```bash
npm run module:sign -- --module modules/github --private-key ./trusted-ed25519-private.pem --key-id local-dev
```

Sign the tree you intend to load. If production loads `dist/modules/*`, sign `dist/modules/*` after `npm run build`.

## Documentation

Primary documents:

- `ENGINEERING_REVIEW.md` — architecture audit and prioritized backlog.
- `docs/ROADMAP.md` — current 6–12 month roadmap.
- `docs/API_REFERENCE.md` — endpoint/tool reference.
- `docs/MODULE_DEVELOPMENT_GUIDE.md` — module authoring guide.
- `docs/PLUGIN_DEVELOPMENT_GUIDE.md` — plugin guidance.
- `docs/DEPLOYMENT_GUIDE.md` — deployment notes.

Some older traceability documents are intentionally aspirational and may describe target-state architecture rather than implemented behavior. Treat this README and `ENGINEERING_REVIEW.md` as the current operational status.

## Current Limitations

- Browser is fetch-based rather than full Playwright automation; calendar requires a Google Calendar access token for live use.
- Third-party/untrusted module sandboxing is not implemented.
- Module signing/verification is not implemented.
- Multi-tenant enterprise policy controls are incomplete.
- OpenTelemetry exporter is not wired yet.
- Cloudflare Workers deployment may need adapter-specific validation.

## License

MIT
