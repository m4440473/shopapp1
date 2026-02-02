**Non-authoritative operational history. CANON.md and ROADMAP.md are authoritative.**

# Agent Handoff (Update Every Session)

Date: 2026-02-09
Agent: Codex
Goal (1 sentence): Fix checklist toggles, add per-part add-on drag/drop library for quotes/orders, and move Finish Required to the build stage.

## What I changed
- Summary: Fixed checklist toggle error handling, replaced raw selects/buttons with shadcn components, introduced shared AvailableItemsLibrary/AssignedItemsPanel drag-drop UI, added per-part add-on assignments on order/quote creation, and added CustomField.uiSection for quote stage placement.

## Files touched
- prisma/schema.prisma
- prisma/seed.ts
- prisma/seed.js
- prisma/migrations/20260208130000_custom_field_ui_section/migration.sql
- src/components/AvailableItemsLibrary.tsx
- src/components/AssignedItemsPanel.tsx
- src/components/CustomFieldInputs.tsx
- src/app/api/orders/[id]/checklist/route.ts
- src/modules/orders/orders.schema.ts
- src/modules/orders/orders.repo.ts
- src/modules/orders/orders.service.ts
- src/repos/orders.ts
- src/repos/mock/orders.ts
- src/app/orders/[id]/page.tsx
- src/app/orders/new/page.tsx
- src/app/admin/quotes/QuoteEditor.tsx
- src/app/admin/quotes/client.tsx
- docs/AGENT_CONTEXT.md
- PROGRESS_LOG.md
- docs/AGENT_HANDOFF.md

## Commands run
- TEST_MODE=true npm run dev -- --hostname 0.0.0.0 --port 3000 (app errored: Prisma client not generated)
- DATABASE_URL="file:./dev.db" npx prisma migrate deploy
- DATABASE_URL="file:./dev.db" npm run seed (failed: Prisma client not generated)
- npx prisma generate (failed: Json field unsupported by sqlite connector)

## Notes / gotchas
- Prisma client generation fails with sqlite due to Json field support; dev server crashes on layout AppSettings without generated client.

## Next steps
- [ ] Resolve Prisma client generation issue (Json type support) so UI flows can be verified locally.
- [ ] Re-run the required order/quote flow validations once Prisma client is available.
