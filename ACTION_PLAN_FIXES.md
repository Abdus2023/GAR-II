# Action Plan — Concrete Fixes

## P0: Planner Skeleton Fix (Dependency Resolution)
File: src/planner/index.ts
- Implement topological sort for `dependsOn`
- Execute nodes in dependency order

## P0: Kernel Import Fix
File: src/kernel/index.ts
- Replace `require('../database')` with `import { db } from '../database'`

## P0: Top-Level Await Safety
File: src/index.ts
- Wrap initialization in try/catch; export gracefully

## P1: Basic Unit Tests
Create: tests/planner.test.ts, tests/kernel.test.ts

## P2: Auth Middleware Hardening
File: src/auth/middleware.ts
- Require `JWT_SECRET` in production; reject if missing
