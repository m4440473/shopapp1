**Non-authoritative operational history. CANON.md and ROADMAP.md are authoritative.**

# Agent Handoff (Update Every Session)

Date: 2026-02-03
Agent: Codex
Goal (1 sentence): Implement department routing, department feed cards, and routing transitions with migrations, API, UI, and tests.

## What I changed
- Summary: Added OrderPart.currentDepartmentId with migration, department feed and routing transition services/routes, Shop Intelligence department feed + filter UI, order detail routing dialog with bulk moves, and readiness unit test.

## Files touched
- prisma/schema.prisma
- prisma/migrations/20260130175735_part_current_department/migration.sql
- src/modules/orders/department-routing.ts
- src/modules/orders/orders.repo.ts
- src/modules/orders/orders.service.ts
- src/modules/orders/__tests__/department-routing.test.ts
- src/app/api/intelligence/department-feed/route.ts
- src/app/api/orders/[id]/parts/transition/route.ts
- src/app/page.tsx
- src/components/ShopFloorLayouts.tsx
- src/app/orders/[id]/page.tsx
- PROGRESS_LOG.md
- docs/AGENT_HANDOFF.md

## Commands run
- npx prisma migrate dev --name part-current-department
- npm ci
- npm test
- npm run lint
- npm run build (failed: Prisma unique constraint error during prerender on AppSettings)
- npm run set-demo-passwords

## Notes / gotchas
- Next.js build fails during prerender because AppSettings creation hits a unique constraint (P2002) in this environment.

## Next steps
- [ ] Resolve AppSettings unique constraint error in prerender so `npm run build` completes.
