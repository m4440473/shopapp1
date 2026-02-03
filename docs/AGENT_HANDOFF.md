**Non-authoritative operational history. CANON.md and ROADMAP.md are authoritative.**

# Agent Handoff (Update Every Session)

Date: 2026-02-03
Agent: ChatGPT
Goal (1 sentence): Stabilize build typing, add work-item pricing flags, and align checklist/timer flows with part-centric requirements.

## What I changed
- Added `affectsPrice` to Addon (migration + schema), updated admin add-ons UI, available-item badges, and quote/order totals to ignore checklist-only items.
- Ensured quote->order conversion and order creation instantiate per-part checklist rows for checklist-only items.
- Updated Next 15 page/route params typing and headers usage; fixed public attachments route signature.
- Added dotenv loading for setup-db and removed unsupported migrate flag.
- Updated timer start to auto-close active entries and added stop-by-entryId; added vitest config aliases + tests for pricing totals, quote checklist mapping, and time duration.
- Synced mock repos with real repo signatures.

## Files touched
- prisma/schema.prisma, prisma/migrations/20260203020905_add_affects_price_to_addon/migration.sql
- scripts/setup-db.cjs
- src/app/(public)/attachments/[...path]/route.ts
- src/app/admin/addons/client.tsx
- src/app/admin/quotes/QuoteEditor.tsx
- src/app/admin/quotes/[id]/page.tsx, src/app/admin/quotes/[id]/edit/page.tsx, src/app/admin/quotes/[id]/print/page.tsx, src/app/admin/quotes/page.tsx
- src/app/api/**/route.ts (admin + orders + time/timer params typing updates)
- src/app/orders/new/page.tsx, src/app/orders/[id]/print/page.tsx, src/app/search/page.tsx, src/app/customers/[id]/*, src/app/machinists/[id]/page.tsx
- src/components/AvailableItemsLibrary.tsx
- src/lib/auth-session.ts, src/lib/zod.ts
- src/modules/orders/orders.repo.ts, src/modules/orders/orders.service.ts
- src/modules/quotes/quotes.repo.ts, src/modules/quotes/quotes.service.ts, src/modules/quotes/quote-work-items.ts
- src/modules/time/time.schema.ts, src/modules/time/time.service.ts
- src/repos/mock/orders.ts, src/repos/mock/seed.ts
- vitest.config.ts, src/test/server-only.ts
- src/modules/quotes/__tests__/*, src/modules/time/__tests__/*
- docs/audit_20260203.md, PROGRESS_LOG.md, docs/AGENT_CONTEXT.md

## Commands run
- npm ci
- npm install
- npx prisma migrate dev --name add_affects_price_to_addon --create-only
- npm test -- src/modules/quotes/__tests__/quote-totals.test.ts src/modules/quotes/__tests__/quote-work-items.test.ts src/modules/time/__tests__/time.service.test.ts
- npm run build

## Notes / gotchas
- `npm run build` succeeds with warnings about @next/swc version mismatch and baseline-browser-mapping staleness.
- TEST_MODE session now includes `expires` to satisfy NextAuth Session typing.

## Next steps
- [ ] Investigate @next/swc mismatch warning (15.5.11 expects 15.5.7 platform packages; no matching 15.5.11 package published).
- [ ] Verify quote/order attachment scoping for part-level files if needed beyond current UI.
