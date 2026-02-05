**Non-authoritative operational history. CANON.md and ROADMAP.md are authoritative.**

# Agent Handoff (Update Every Session)

---

## LATEST HANDOFF — 2026-02-04 (Stage 1 Complete)

**Agent**: GitHub Copilot  
**Goal**: Execute Stage 1 cleanup - consolidate timer APIs, remove dead code, fix component violations, add dept polling

### What I Changed

**Completed All Stage 1 Tasks:**

1. **Timer API Consolidation** ✅
   - Merged `/api/timer/*` into `/api/time/*` (single system)
   - Added part event logging to all time endpoints
   - Created `/api/time/finish` (part completion + logging)
   - Created `/api/time/active` (status query with order/part info)
   - Migrated UI from `/api/timer/*` to `/api/time/*`
   - Deleted old `/api/timer/` directory (4 files)

2. **Component Service Violations** ✅
   - Created `src/lib/order-ui-utils.ts` for shared UI utilities
   - Moved UI helper functions out of `orders.service.ts`
   - Updated `ShopFloorLayouts` and `RecentOrdersTable` to use order-ui-utils
   - Fixed duplicate type exports in orders.service.ts
   - Result: Zero components import services directly

3. **Department Queue Polling** ✅
   - Added 30-second auto-refresh when in handoff mode
   - Added "Last updated" timestamp indicator
   - Polling activates only when layout=handoff AND departmentId set

4. **Code Quality** ✅
   - Fixed all TypeScript compilation errors
   - Fixed email property access issues in ShopFloorLayouts
   - Added TODO note to machinist page for future work

**Audit Correction**: fetchJson and colors.ts are NOT dead code (used by 14 files total)

### Files Touched

**Created:**
- `src/app/api/time/finish/route.ts`
- `src/app/api/time/active/route.ts`
- `src/lib/order-ui-utils.ts`
- `docs/STAGE1_COMPLETE.md`

**Modified:**
- `src/app/api/time/start/route.ts` (part validation + logging)
- `src/app/api/time/pause/route.ts` (event logging)
- `src/app/orders/[id]/page.tsx` (use /api/time/*)
- `src/components/ShopFloorLayouts.tsx` (order-ui-utils + polling + types)
- `src/components/RecentOrdersTable.tsx` (order-ui-utils)
- `src/modules/orders/orders.service.ts` (re-exports + fix duplicates)
- `src/app/machinists/[id]/page.tsx` (TODO note)
- PROGRESS_LOG.md, docs/AGENT_HANDOFF.md

**Deleted:**
- `src/app/api/timer/` (entire directory)

### Commands Run
- `npm ci` (install dependencies)
- `npx tsc --noEmit` (verified zero TypeScript errors)

### What's Next: Stage 2 (Modularization)

**User Decision**: Proceed with Stage 2 when ready

**Stage 2 Goals** (from audit report):
1. Complete quote module extraction (lib/quote-*.ts → modules/quotes/)
2. Split orders service (1,367 lines → parts/checklist/charges services)
3. Migrate pages to services (remove Prisma imports from UI)

**Key Files to Refactor**:
- Quote system: `src/lib/quote-*.ts`, `src/app/admin/quotes/[id]/page.tsx`
- Pages with Prisma: `src/app/page.tsx`, `src/app/search/page.tsx`, `src/app/machinists/[id]/page.tsx`

See `docs/STAGE1_COMPLETE.md` and `docs/AUDIT_REPORT_2026-02-03.md` for details.

### Notes for Continuity

**Success Metrics Achieved:**
- ✅ Only 1 timer endpoint system
- ✅ Zero component→service violations
- ✅ Department queue auto-refresh (30s)
- ✅ TypeScript compiles cleanly

**Known Issues (Not Stage 1 scope):**
- Orders service still 1,367 lines (needs splitting in Stage 2)
- Several pages still use Prisma directly (needs services in Stage 2)
- Quote system scattered across lib/ (needs module extraction in Stage 2)

---

## PREVIOUS HANDOFF — 2026-02-03 (Codebase Audit)

**Agent**: GitHub Copilot  
**Goal**: Comprehensive codebase audit for outdated/unused code, UI-backend connections, and UX from machine shop perspective.

### What I Changed
- Analysis only (no code changes)
- Created `docs/AUDIT_REPORT_2026-02-03.md` - Full 400+ line report with findings
- Created `docs/AUDIT_SUMMARY.md` - Quick reference with TL;DR and staged plan
- Updated `PROGRESS_LOG.md` with session entry
- Updated this handoff document

### Key Findings
**Critical Issues:**
1. Duplicate timer APIs: `/api/timer/*` (used by UI) vs `/api/time/*` (unused) both exist
2. Architecture violations: 8+ pages/components access Prisma or services directly (violates CANON.md §67)
3. Orders service bloat: 1,367 lines mixing CRUD, events, checklists, charges
4. Quote system incomplete: logic scattered across lib/, modules/, admin pages
5. Dead code: fetchJson (0 imports), colors.ts (unused), machinist page (unreferenced)

**UX Gaps (Shop Floor Perspective):**
- No "Resume Last Job" quick action (requires 5-level navigation)
- Parts not first-class citizens (can't see cross-order part list)
- Department queue static (no polling/WebSocket for live updates)
- Order detail page cognitive overload (4 tabs + timer on one screen)

### Files Touched
- Created: `docs/AUDIT_REPORT_2026-02-03.md`
- Created: `docs/AUDIT_SUMMARY.md`
- Updated: `PROGRESS_LOG.md`
- Updated: `docs/AGENT_HANDOFF.md`

### Commands Run
None (analysis/documentation only)

### Next Steps (Staged Plan)
**Stage 1: Consolidate & Clean** (Phase 1 - P0) ← **START HERE**
- [ ] Merge `/api/timer/*` into `/api/time/*` (single system)
- [ ] Remove dead code: fetchJson, colors.ts
- [ ] Fix component→service violations (ShopFloorLayouts, RecentOrdersTable)
- [ ] Decision needed: Keep or remove `/app/machinists/[id]/page.tsx`?

**Stage 2-5**: See `docs/AUDIT_SUMMARY.md` for modularization, part-centric refactor, UX polish

### Questions for User/Next Agent
1. Proceed with Stage 1 (timer merge + cleanup)?
2. Is machinist detail page needed or can we remove it?
3. Does part-centric model align with real workflows? (CANON.md says yes)
4. Department queue: 30s polling or WebSocket?
5. Offline support: must-have or defer to Phase 5?

---

## PREVIOUS HANDOFF — 2026-02-03 (Build/env fixes)

**Date**: 2026-02-03  
**Agent**: ChatGPT  
**Goal**: Stabilize build typing, add work-item pricing flags, and align checklist/timer flows with part-centric requirements.

### What I changed
- Added `affectsPrice` to Addon (migration + schema), updated admin add-ons UI, available-item badges, and quote/order totals to ignore checklist-only items.
- Ensured quote->order conversion and order creation instantiate per-part checklist rows for checklist-only items.
- Updated Next 15 page/route params typing and headers usage; fixed public attachments route signature.
- Added dotenv loading for setup-db and removed unsupported migrate flag.
- Updated timer start to auto-close active entries and added stop-by-entryId; added vitest config aliases + tests for pricing totals, quote checklist mapping, and time duration.
- Synced mock repos with real repo signatures.

### Files touched
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

### Commands run
- npm ci
- npm install
- npx prisma migrate dev --name add_affects_price_to_addon --create-only
- npm test -- src/modules/quotes/__tests__/quote-totals.test.ts src/modules/quotes/__tests__/quote-work-items.test.ts src/modules/time/__tests__/time.service.test.ts
- npm run build

### Notes / gotchas
- `npm run build` succeeds with warnings about @next/swc version mismatch and baseline-browser-mapping staleness.
- TEST_MODE session now includes `expires` to satisfy NextAuth Session typing.

### Next steps
- [ ] Investigate @next/swc mismatch warning (15.5.11 expects 15.5.7 platform packages; no matching 15.5.11 package published).
- [ ] Verify quote/order attachment scoping for part-level files if needed beyond current UI.
