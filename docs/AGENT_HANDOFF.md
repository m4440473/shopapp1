**Non-authoritative operational history. CANON.md and ROADMAP.md are authoritative.**

# Agent Handoff (Update Every Session)

Date: 2026-02-08
Agent: Codex
Goal (1 sentence): Add a TEST_MODE harness to bypass auth/Prisma with mock repos and a smoke check.

## What I changed
- Summary: Added a centralized TEST_MODE switch with mock auth + in-memory repos, updated orders/time services and admin users routes to use the repo factory, and added a test-mode smoke API.

## Files touched
- middleware.ts
- src/lib/testMode.ts
- src/lib/auth-session.ts
- src/repos/index.ts
- src/repos/orders.ts
- src/repos/time.ts
- src/repos/users.ts
- src/repos/mock/seed.ts
- src/repos/mock/orders.ts
- src/repos/mock/time.ts
- src/repos/mock/users.ts
- src/modules/orders/orders.service.ts
- src/modules/time/time.service.ts
- src/modules/users/users.repo.ts
- src/app/api/test-mode/smoke/route.ts
- src/app/api/admin/users/route.ts
- src/app/api/admin/users/[id]/route.ts
- .env.example
- CANON.md
- docs/AGENT_CONTEXT.md
- PROGRESS_LOG.md
- docs/AGENT_HANDOFF.md

## Commands run
- None

## Notes / gotchas
- Enable with `TEST_MODE=true` in local/Codex/Replit environments to bypass auth + Prisma; keep it OFF in production.

## Next steps
- [ ] Run a local dev smoke check with TEST_MODE=true and visit /api/test-mode/smoke.
