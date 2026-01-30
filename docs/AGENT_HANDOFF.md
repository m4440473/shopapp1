**Non-authoritative operational history. CANON.md and ROADMAP.md are authoritative.**

# Agent Handoff (Update Every Session)

Date: 2026-02-04
Agent: Codex
Goal (1 sentence): Backfill part department routing, enforce per-part department checklists, and correct department addon seeds with minimal UI safety net.

## What I changed
- Summary: Added scripts + service helpers to backfill currentDepartmentId and migrate order-level department checklists, enforced per-part department checklist rules, added a minimal unassigned department assignment UI + API, and corrected department addon seed data with glossary docs.

## Files touched
- src/modules/orders/orders.repo.ts
- src/modules/orders/orders.service.ts
- src/app/api/orders/[id]/checklist/route.ts
- src/app/api/orders/[id]/parts/assign-department/route.ts
- src/app/orders/[id]/page.tsx
- scripts/backfill-current-department.ts
- scripts/migrate-orderlevel-dept-checklists-to-parts.ts
- prisma/seed.ts
- prisma/seed.js
- README.md
- PROGRESS_LOG.md
- docs/AGENT_HANDOFF.md

## Commands run
- npm ci
- npm test
- npm run lint
- npm run build (failed: Prisma unable to open database file during prerender)
- DATABASE_URL="file:./dev.db" npx prisma migrate deploy
- DATABASE_URL="file:./dev.db" npm run seed
- DATABASE_URL="file:./dev.db" npm run set-demo-passwords

## Notes / gotchas
- Next.js build failed during prerender because Prisma could not open the SQLite database file in this environment.

## Next steps
- [ ] Retry `npm run build` with a valid DATABASE_URL so prerender can access AppSettings.
