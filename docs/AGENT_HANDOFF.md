**Non-authoritative operational history. CANON.md and ROADMAP.md are authoritative.**

# Agent Handoff (Update Every Session)

Date: 2026-02-05
Agent: Codex
Goal (1 sentence): Implement the two-card order workspace with part-level time tracking, notes/files/checklist tabs, and part event logging.

## What I changed
- Summary: Rebuilt the order detail view into the two-card workspace (parts list + time tracking header on the left, tabbed part details on the right) and added part event logging with new timer endpoints, part completion status, and event writes for notes/files/checklists/timers.

## Files touched
- prisma/schema.prisma
- prisma/migrations/20260205123000_part_events_and_status/migration.sql
- src/modules/orders/orders.repo.ts
- src/modules/orders/orders.service.ts
- src/modules/time/time.repo.ts
- src/modules/time/time.service.ts
- src/app/api/timer/active/route.ts
- src/app/api/timer/start/route.ts
- src/app/api/timer/pause/route.ts
- src/app/api/timer/finish/route.ts
- src/app/api/orders/[id]/notes/route.ts
- src/app/api/orders/[id]/checklist/route.ts
- src/app/api/orders/parts/[partId]/attachments/route.ts
- src/app/api/orders/[id]/parts/[partId]/events/route.ts
- src/app/orders/[id]/page.tsx
- PROGRESS_LOG.md
- docs/AGENT_HANDOFF.md

## Commands run
- None

## Notes / gotchas
- New PartEvent and OrderPart.status columns were added; migrations should be applied before relying on event logs or part completion status.

## Next steps
- [ ] Run migrations and sanity-check the order detail view layout against real data.
