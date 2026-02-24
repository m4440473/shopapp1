Date: 2026-02-24
Agent: GPT-5.2-Codex
Goal (1 sentence): Add true timer resume behavior in order detail so paused part work can continue without losing previously captured time.

## What I changed
- Added `src/app/api/timer/resume/route.ts`:
  - Validates `TimeEntryResume` input.
  - Returns 409 switch-confirmation payload if another timer is active.
  - Calls `resumeTimeEntry` when no active timer exists and logs `Timer resumed.` part event metadata.
- Updated `src/app/api/timer/active/route.ts` to include `lastPartEntries` from `getTimeEntrySummary` for selected-order part context.
- Updated `src/app/orders/[id]/page.tsx` timer UI behavior:
  - Added `lastPartEntries` state.
  - Primary action now chooses resume vs start automatically for selected part.
  - Start button label/help text now reflects resume path.
  - Conflict follow-up action now re-runs the unified activate handler.
- Added regression test in `src/modules/time/__tests__/time.service.test.ts` confirming pause/resume retains accumulated totals.
- Updated continuity artifacts: `tasks/todo.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, and `docs/AGENT_TASK_BOARD.md` session note.

## Files touched
- src/app/api/timer/resume/route.ts
- src/app/api/timer/active/route.ts
- src/app/orders/[id]/page.tsx
- src/modules/time/__tests__/time.service.test.ts
- tasks/todo.md
- PROGRESS_LOG.md
- docs/AGENT_HANDOFF.md
- docs/AGENT_TASK_BOARD.md

## Commands run
- npm run test -- src/modules/time/__tests__/time.service.test.ts
- npm run lint
- npm run dev
- Playwright screenshot script against http://127.0.0.1:3000

## Verification Evidence
- Time service test suite passed (6/6), including new pause/resume retention coverage.
- Lint passed with no ESLint warnings/errors.
- Browser screenshot artifact captured; due auth/session limitations in this environment, capture reflects unauthenticated/new-order context rather than authenticated order-detail timer panel.

## Next steps
- [ ] Optional UX follow-up: consider exposing explicit “Resume last paused” context text with timestamp/elapsed from last entry.
- [ ] Optional auth-e2e follow-up: stabilize scripted sign-in path for browser capture of authenticated order-detail interactions.

---

Date: 2026-02-24
Agent: GPT-5.2-Codex
Goal (1 sentence): Fix timer start 400 on order detail by sending the required `operation` field expected by `TimeEntryStart`.

## What I changed
- Updated `src/app/orders/[id]/page.tsx` so `handleStart` sends `operation: 'Part Work'` in the `/api/timer/start` JSON body.
- Updated continuity artifacts for this session: `tasks/todo.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`.

## Files touched
- src/app/orders/[id]/page.tsx
- tasks/todo.md
- PROGRESS_LOG.md
- docs/AGENT_HANDOFF.md

## Commands run
- npm run lint

## Verification Evidence
- Lint passed.
- The order detail timer start request payload now includes all required schema fields (`orderId`, `partId`, `operation`) for `/api/timer/start`.

## DoD Checklist
- [x] Reproduced/confirmed root cause from code path (missing `operation` in payload).
- [x] Applied minimal scoped fix without unrelated refactors.
- [x] Ran verification command and logged evidence.

## Next steps
- [ ] Optional follow-up: unify overlapping `/api/time/start` and `/api/timer/start` contract expectations to reduce drift risk.

---

Date: 2026-02-23
Agent: GPT-5.2-Codex
Goal (1 sentence): Resolve local setup friction and timer/order-detail issues by updating install docs, handling timer FK failures gracefully, and fixing order timer control overlap.

## What I changed
- Rewrote `README.md` local install section into a deterministic setup flow (`npm ci` → env setup → prisma generate/migrate → seed → demo password setup).
- Added timer start FK-failure handling in `src/modules/time/time.service.ts`:
  - catches Prisma known request error `P2003` during time-entry creation.
  - returns deterministic 409 with actionable re-login guidance for stale-session scenarios.
- Updated order detail timer controls in `src/app/orders/[id]/page.tsx` from a fixed 3-column action row to stacked actions to prevent overlap/crowding in the narrow sidebar.
- Updated continuity artifacts for this session: `tasks/todo.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, `docs/AGENT_TASK_BOARD.md`.

## Files touched
- README.md
- src/modules/time/time.service.ts
- src/app/orders/[id]/page.tsx
- tasks/todo.md
- PROGRESS_LOG.md
- docs/AGENT_HANDOFF.md
- docs/AGENT_TASK_BOARD.md

## Commands run
- npm run seed
- npm run set-demo-passwords
- npm run test -- src/modules/time/__tests__/time.service.test.ts
- npm run lint
- npm run build
- npm run dev
- Playwright screenshot script against http://127.0.0.1:3000/orders/<id>

## Verification Evidence
- Seed completed successfully.
- Demo password script completed successfully.
- Time service tests passed (5/5).
- Lint passed with no ESLint warnings/errors.
- Build passed successfully.
- Runtime UI screenshot captured for updated order timer controls.
- Non-blocking advisories observed: `@next/swc` mismatch warning and stale `baseline-browser-mapping` data warning.

## Next steps
- [ ] Backlog: align `next` and `@next/swc` versions to remove build advisory.
- [ ] Backlog: refresh `baseline-browser-mapping` dev dependency data.

---

Date: 2026-02-23
Agent: GPT-5.2-Codex
Goal (1 sentence): Execute P4-T3 only by producing explicit Phase 4 gate pass/fail evidence from existing timer behavior and verification commands.

## What I changed
- Performed P4-T3 evidence closeout only; no product code changes.
- Updated planning/continuity artifacts to capture dependency validation, commands, and DoD evidence:
  - `tasks/todo.md`
  - `PROGRESS_LOG.md`
  - `docs/AGENT_HANDOFF.md`

## Files touched
- tasks/todo.md
- PROGRESS_LOG.md
- docs/AGENT_HANDOFF.md

## Commands run
- npm run test -- src/modules/time/__tests__/time.service.test.ts
- npm run lint
- npm run build

## Verification Evidence
- Time service tests passed (5/5), including conflict/switch flow coverage for no-inflation behavior.
- Lint passed with no ESLint warnings/errors.
- Build passed successfully with no blocking errors.
- Non-blocking environment advisories observed: `@next/swc` version mismatch warning and stale `baseline-browser-mapping` data.

## DoD Checklist (P4-T3)
- [x] Operators can start/stop/switch without inflation.
  - Evidence: `time.service` test suite passed, including switch/conflict coverage that enforces explicit transitions and no overlapping intervals.
- [x] Managers can trust totals without manual reconciliation.
  - Evidence: interval-based time service totals checks passed and full production build/type validation succeeded.

## Next steps
- [ ] Backlog: align `next` and `@next/swc` package versions to clear mismatch advisory.
- [ ] Backlog: refresh `baseline-browser-mapping` dataset to remove staleness advisory.

---

Date: 2026-02-23
Agent: GPT-5.2-Codex
Goal (1 sentence): Execute P4-T1 and P4-T2 only by improving timer control clarity and switch/last-action visibility on order detail.

## What I changed
- Updated `src/app/orders/[id]/page.tsx` Active Work panel only (UI scope):
  - Added explicit control labels and icons for `Start selected part`, `Pause active timer`, and `Finish active timer`.
  - Added running/stopped status badge plus clear switch-warning callout when active work is on a different part.
  - Added helper copy explaining switch-confirmation behavior.
  - Added `lastPartEvent` display so the most recent part action is visible beside timer controls.
- Updated session control artifacts: `tasks/todo.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`.

## Files touched
- src/app/orders/[id]/page.tsx
- tasks/todo.md
- PROGRESS_LOG.md
- docs/AGENT_HANDOFF.md

## Commands run
- npm run test -- src/modules/time/__tests__/time.service.test.ts
- npm run lint
- npm run build
- TEST_MODE=true npm run dev -- --hostname 0.0.0.0 --port 3000
- Playwright screenshot script against http://127.0.0.1:3000/orders/<id>

## Verification Evidence
- Time service tests passed (5/5), including switch no-inflation behavior.
- Lint passed with no ESLint warnings/errors.
- Build failed on pre-existing `/auth/signin` prerender Prisma `P2002` (`AppSettings.id` unique constraint), unchanged by this scope.
- Runtime smoke check in TEST_MODE succeeded for order detail timer panel; screenshot captured.

## DoD Checklist (P4-T1 & P4-T2)
- [x] P4-T1: Start/pause/resume controls are obvious and unambiguous (explicit action labels + status context in Active Work panel).
- [x] P4-T1: Active state is clearly visible without extra navigation (running/stopped badge + elapsed time + active-part callout).
- [x] P4-T2: Switching operations does not inflate time (existing switch-confirmation backend/service behavior unchanged; no-inflation test suite remains passing).
- [x] P4-T2: Last operation/action context is visible and understandable (most recent part log event surfaced in controls panel).

## Next steps
- [ ] Backlog: normalize Next.js/SWC version mismatch warnings in environment dependencies.
- [ ] Backlog: resolve pre-existing `/auth/signin` prerender Prisma `AppSettings` uniqueness bootstrap issue so production build can pass end-to-end.

---

Date: 2026-02-23
Agent: GPT-5.2-Codex
Goal (1 sentence): Execute P3-T3 and P3-T4 only by closing Phase 3 with explicit evidence and enforcing switch-confirmation timer UX safety.

## What I changed
- Updated `src/app/api/timer/start/route.ts` to enforce conflict-first starts via `startTimeEntryWithConflict` and return explicit 409 switch payload context (`requiredAction`, active order/part, elapsed seconds).
- Updated `src/app/orders/[id]/page.tsx` timer switch behavior:
  - `handleStart`/`handlePause`/`handleFinish` now return success booleans.
  - Conflict follow-up start runs only when pause/finish succeeds.
  - Conflict dialog copy now explicitly states which active timer exists and what will happen on switch confirmation.
- Added targeted tests in `src/modules/time/__tests__/time.service.test.ts`:
  - conflict result when starting with an existing active entry.
  - confirmation-path switch totals proving no interval inflation.
- Updated session control artifacts: `tasks/todo.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`.

## Files touched
- src/app/api/timer/start/route.ts
- src/app/orders/[id]/page.tsx
- src/modules/time/__tests__/time.service.test.ts
- tasks/todo.md
- PROGRESS_LOG.md
- docs/AGENT_HANDOFF.md

## Commands run
- npm run test -- src/modules/time/__tests__/time.service.test.ts
- npm run lint
- npm run build
- TEST_MODE=true npm run dev -- --hostname 0.0.0.0 --port 3000
- Playwright screenshot script against http://127.0.0.1:3000/orders

## Verification Evidence
- Time service test suite for touched behavior passed (5/5).
- Lint passed with no ESLint warnings/errors.
- Build passed.
- Runtime smoke check in TEST_MODE succeeded for `/orders`; screenshot captured.
- Non-blocking advisories observed: `@next/swc` version mismatch and stale `baseline-browser-mapping` data.

## DoD Checklist (P3-T3 & P3-T4)
- [x] P3-T3: Phase 3 exit criteria explicitly pass/fail with evidence.
- [x] P3-T3: No blocking gaps; remaining non-blocking advisories logged as backlog notes.
- [x] P3-T4: Starting a new timer with an active timer yields an explicit context dialog trigger payload (409 conflict + active context).
- [x] P3-T4: Dialog identifies active order/part and switch action consequence.
- [x] P3-T4: Switch confirmation path avoids inflation by closing current interval before the new start and test-proving expected totals.

## Next steps
- [ ] Backlog: unify `/api/time/*` and `/api/timer/*` overlap after current roadmap gate sequence allows endpoint consolidation.
- [ ] Backlog: optional environment hygiene task to align `@next/swc` and refresh `baseline-browser-mapping` data outside P3 scope.

---

---
**Non-authoritative operational history. CANON.md and ROADMAP.md are authoritative.**

# Agent Handoff (Update Every Session)

Date: 2026-02-23
Agent: GPT-5.2-Codex
Goal (1 sentence): Execute P3-T1 and P3-T2 by enforcing closed-interval time invariants and deterministic server-side API rules only.

## What I changed
- Time module invariant enforcement updates:
  - Added `TimeEntryClosedEdit` schema and `TimeEntryClosedEditInput` type.
  - Added `editClosedTimeEntry` service path with deterministic 404/403/409/400 outcomes.
  - Added `updateClosedTimeEntryById` repo + mock-repo support with closed-entry-only guard (`endedAt != null`).
- Time API enforcement updates:
  - Added `PATCH /api/time/entries/[entryId]` (admin-only via RBAC) with required reason and PartEvent audit record (`TIME_ENTRY_EDITED`) for part-linked entries.
  - Updated `POST /api/timer/start` to validate request via `TimeEntryStart` schema and require `partId` explicitly.
  - Updated `GET /api/timer/active` to return deterministic error status if totals lookup fails.
- Added/updated tests:
  - Extended `src/modules/time/__tests__/time.service.test.ts` with closed-entry edit success and active-entry edit rejection cases.

## Files touched
- src/modules/time/time.schema.ts
- src/modules/time/time.types.ts
- src/modules/time/time.service.ts
- src/modules/time/time.repo.ts
- src/repos/time.ts
- src/repos/mock/time.ts
- src/app/api/time/entries/[entryId]/route.ts
- src/app/api/timer/start/route.ts
- src/app/api/timer/active/route.ts
- src/modules/time/__tests__/time.service.test.ts
- tasks/todo.md
- PROGRESS_LOG.md
- docs/AGENT_HANDOFF.md
- docs/AGENT_CONTEXT.md

## Commands run
- npm run test -- src/modules/time/__tests__/time.service.test.ts
- npm run lint
- npm run build

## Verification Evidence
- Time service tests pass (3/3), including closed-entry edit paths.
- Lint passes with no ESLint warnings/errors.
- Production build succeeds and includes new `/api/time/entries/[entryId]` route in output.

## Diff/Review Notes
- Scope limited to P3-T1 and P3-T2; no dependency additions and no unrelated domain edits.
- Existing environment warnings (`@next/swc` mismatch and `baseline-browser-mapping` freshness) were observed but are outside this task scope.

## Next steps
- [ ] P3-T3: produce formal Phase 3 gate closeout pass/fail report with explicit mapping to ROADMAP criteria.
- [ ] Backlog: consider DB-level partial uniqueness guard for active entries if/when SQLite migration strategy is approved.

---

Date: 2026-02-23
Agent: GPT-5.2-Codex
Goal (1 sentence): Fix the React hook warnings in `src/app/orders/[id]/page.tsx` only, per user clarification.

## What I changed
- Updated `src/app/orders/[id]/page.tsx` to stabilize hook dependencies:
  - Memoized `parts` derived from `item?.parts`.
  - Replaced `tick` state with `nowMs` timestamp state.
  - Updated `activeElapsedSeconds` memo to depend on `nowMs` and `activeEntry?.startedAt`.
- Kept the change narrowly scoped to the warning-producing hooks in this file only.

## Files touched
- src/app/orders/[id]/page.tsx
- tasks/todo.md
- PROGRESS_LOG.md
- docs/AGENT_HANDOFF.md
- tasks/lessons.md

## Commands run
- npm run lint
- npm run build

## Verification Evidence
- `npm run lint` reports no ESLint warnings/errors.
- `npm run build` succeeds and no longer prints React hook warnings for `src/app/orders/[id]/page.tsx`.

## Diff/Review Notes
- No drive-by refactors; only hook-dependency stabilization related to the requested warnings.

## Next steps
- [ ] If desired separately, address non-hook build advisories (`@next/swc` mismatch and baseline-browser-mapping freshness).

---

Date: 2026-02-23
Agent: GPT-5.2-Codex
Goal (1 sentence): Fix the project-run Next.js SWC mismatch warning only, while leaving known pre-existing React hook warnings untouched.

## What I changed
- Updated dependency versions only:
  - `next` from `^15.5.11` to `^15.5.7`
  - `eslint-config-next` from `^15.5.11` to `^15.5.7`
- Regenerated lockfile entries via install to keep dependency graph consistent.
- No source code files were changed.

## Files touched
- package.json
- package-lock.json
- PROGRESS_LOG.md
- docs/AGENT_HANDOFF.md
- tasks/todo.md

## Commands run
- npm install next@15.5.7 eslint-config-next@15.5.7
- npm run build
- npm run lint

## Verification Evidence
- Build completes successfully and does not emit `Mismatching @next/swc version` warning anymore.
- Lint completes successfully with only pre-existing React hook warnings in `src/app/orders/[id]/page.tsx` (known baseline).

## Diff/Review Notes
- Scope was intentionally limited to the dependency version mismatch warning identified in project-level run output.
- No refactors or unrelated fixes were included.

## Next steps
- [ ] Optional follow-up outside this scoped fix: evaluate upgrading to a patched Next.js version path that avoids the known 15.5.7 security advisory while retaining SWC alignment.

---

Date: 2026-02-23
Agent: GPT-5.2-Codex
Goal (1 sentence): Execute P2-T3 and P2-T4 by aligning Customers to repo/service boundaries and producing a Phase 2 Prisma/layering audit with explicit gate pass/fail.

## What I changed
- Added module-owned Customers boundary files:
  - `src/modules/customers/customers.repo.ts`
  - `src/modules/customers/customers.service.ts`
  - `src/modules/customers/customers.schema.ts`
  - `src/modules/customers/customers.types.ts`
- Refactored Customers API routes to call Customers services (thin route handlers):
  - `src/app/api/admin/customers/route.ts`
  - `src/app/api/admin/customers/[id]/route.ts`
- Refactored Customers server pages to call Customers services instead of direct Prisma:
  - `src/app/customers/page.tsx`
  - `src/app/customers/[id]/page.tsx`
  - `src/app/customers/[id]/print/page.tsx`
- Converted `src/lib/zod-customers.ts` into a compatibility shim that re-exports module-owned schema/types.
- Updated continuity/planning artifacts: `tasks/todo.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`.

## Files touched
- src/modules/customers/customers.repo.ts
- src/modules/customers/customers.service.ts
- src/modules/customers/customers.schema.ts
- src/modules/customers/customers.types.ts
- src/app/api/admin/customers/route.ts
- src/app/api/admin/customers/[id]/route.ts
- src/app/customers/page.tsx
- src/app/customers/[id]/page.tsx
- src/app/customers/[id]/print/page.tsx
- src/lib/zod-customers.ts
- tasks/todo.md
- PROGRESS_LOG.md
- docs/AGENT_HANDOFF.md

## Commands run
- rg --files -g 'AGENTS.md'
- sed/cat required pre-reads:
  - CANON.md
  - ROADMAP.md
  - docs/AGENT_CONTEXT.md
  - PROGRESS_LOG.md
  - docs/AGENT_HANDOFF.md
  - docs/AGENT_TASK_BOARD.md
  - AGENT_PROMPTS.md
  - tasks/todo.md
  - tasks/lessons.md
- rg -n "prisma\.customer" src
- rg -n "prisma\.(order|orderPart|orderCharge|orderChecklist|partAttachment)" src --glob '!src/modules/orders/orders.repo.ts'
- rg -n "prisma\.(quote|quotePart|quoteAttachment|quoteVendorItem|quoteAddonSelection)" src --glob '!src/modules/quotes/quotes.repo.ts'
- rg -n "prisma\.customer" src --glob '!src/modules/customers/customers.repo.ts'
- rg -n "@/lib/prisma" src/app/api/orders src/app/api/admin/quotes src/app/api/admin/customers src/app/customers
- npm run lint
- npm run build

## Verification Evidence
- Orders/Quotes/Customers Prisma out-of-repo audit commands returned no matches.
- Customers API and pages no longer import `@/lib/prisma`; call paths now go route/page -> customers.service -> customers.repo.
- `npm run lint` passed (pre-existing warnings remain in `src/app/orders/[id]/page.tsx`, not touched in this task).
- `npm run build` passed (same pre-existing warnings plus non-blocking advisories for baseline-browser-mapping and @next/swc mismatch).

## Diff/Review Notes
- Scope intentionally limited to P2-T3 + P2-T4.
- No new dependencies added.
- No unrelated refactors outside Customers alignment and Phase 2 audit evidence capture.

## Notes / gotchas
- P2-T4 gate evidence is captured via command output + continuity docs; legacy order-centric migration-note consolidation is still a documentation follow-up.

## Next steps
- [ ] Start P3-T1 (time model invariants verification) only after owner confirms Phase 2 gate acceptance.
- [ ] Optional docs-only follow-up: consolidate legacy order-centric deprecation/migration notes into a single appendix for future gate audits.

---
Date: 2026-02-24
Agent: GPT-5.2-Codex
Goal (1 sentence): Deliver department auto-advance confirmation and centralized routing recompute with required reason/flag logging for backward/rework/manual transitions.

## What I changed
- Added new checklist APIs:
  - `POST /api/orders/[id]/parts/[partId]/checklist/[itemId]/preview-complete`
  - `POST /api/orders/[id]/parts/[partId]/checklist/[itemId]/complete-and-advance`
- Extended Orders service routing logic:
  - Introduced `recomputePartDepartment(...)` as the routing source of truth.
  - Added `previewChecklistComplete(...)` and `completeChecklistAndAdvance(...)` service flows.
  - Updated `toggleChecklistItem(...)` to recompute routing on toggle and enforce reason on backward reopen.
  - Updated manual transition paths (`assignPartDepartment`, `transitionPartsDepartment`) to require reason and emit department events with flag metadata.
- Extended repo layer:
  - Added routing-oriented fetch/update helpers and transaction wrapper used by service layer.
  - Enhanced department feed repo query to support optional include-completed behavior + latest part event.
- UI updates:
  - Order detail checklist now calls preview API before check; last-item completion is guarded by user confirmation and no optimistic checkbox flip.
  - Reopen that triggers backward move now requests reason and retries mutation with reason payload.
  - Part list tiles and intelligence feed part chips show `REWORK` badge when latest event meta has `flag: true`.
  - Intelligence feed added include-completed toggle and forwards query parameter to API.

## Files touched
- `src/modules/orders/orders.service.ts`
- `src/modules/orders/orders.repo.ts`
- `src/repos/orders.ts`
- `src/repos/mock/orders.ts`
- `src/app/api/orders/[id]/checklist/route.ts`
- `src/app/api/orders/[id]/parts/assign-department/route.ts`
- `src/app/api/orders/[id]/parts/transition/route.ts`
- `src/app/api/intelligence/department-feed/route.ts`
- `src/app/api/orders/[id]/parts/[partId]/checklist/[itemId]/preview-complete/route.ts`
- `src/app/api/orders/[id]/parts/[partId]/checklist/[itemId]/complete-and-advance/route.ts`
- `src/app/orders/[id]/page.tsx`
- `src/components/ShopFloorLayouts.tsx`
- `PROGRESS_LOG.md`
- `tasks/todo.md`
- `docs/AGENT_HANDOFF.md`

## Commands run
- npm run lint
- npm run test -- src/modules/orders/__tests__/department-routing.test.ts
- npm run build
- npm run dev (temporary, for screenshot capture)

## Verification Evidence
- Lint passed with zero ESLint errors/warnings.
- Existing department-routing unit tests passed.
- Full Next.js production build passed after type-check.

## Diff/Review Notes
- Scoped to Orders/checklist/department-feed workflows only (no broad architecture refactor).
- Backlog follow-up intentionally deferred: replace native confirm/prompt dialogs with richer in-app modal components.

## Next steps
- [ ] Add focused unit/integration tests for new routing recompute, preview, and backward-reason branches.
- [ ] Replace native `window.confirm/window.prompt` with dedicated UI modal patterns for consistency and accessibility.

## Session Handoff — 2026-02-24 (Consolidated queue/tx/timer pass)

## Goal
Implement consolidated P0-P5 pass: transaction timeout/client consistency fix, merge orders list into home intelligence queue, add integrated Work Queue layout + customers-style cards, and timer semantics corrections.

## Scope completed
- Transaction path hardening:
  - `recordPartEvent` now accepts optional db/tx client and passes through to repo.
  - `recomputePartDepartment` now reads departments + writes part events using the provided tx client.
  - `runInTransaction` now uses `maxWait: 20_000` and `timeout: 20_000`.
- Queue consolidation:
  - `/orders` list replaced with redirect to `/`.
  - Home actions/nav links updated to avoid duplicate queue-page behavior.
- Intelligence UI:
  - Existing KPI and prior layouts retained.
  - Added `workQueue` layout mode in `ShopFloorLayouts` with department tabs and include-completed toggle.
  - Added reusable customers-style `WorkQueueOrderCard` tile component and wired department feed shape/sorting updates.
- Timer behavior:
  - `getOrderPartTimeTotals` now returns second-level totals (`totalsSeconds`).
  - `/api/timer/active` now returns `totalsSeconds`.
  - Order detail timer panel now shows persistent selected-part elapsed (stored totals + live delta).
  - `/api/timer/finish` now stops timer and logs event without completing the part.
  - `completeOrderPart` now rejects with 409 if active checklist items remain incomplete.
- Tests:
  - Updated time service tests for seconds-based totals.
  - Added orders service test for checklist-completion gate.

## Files touched
- `src/modules/orders/orders.repo.ts`
- `src/modules/orders/orders.service.ts`
- `src/repos/mock/orders.ts`
- `src/app/page.tsx`
- `src/app/orders/page.tsx`
- `src/components/AppNav.tsx`
- `src/components/ShopFloorLayouts.tsx`
- `src/components/work-queue/WorkQueueOrderCard.tsx`
- `src/app/api/timer/active/route.ts`
- `src/app/api/timer/finish/route.ts`
- `src/modules/time/time.service.ts`
- `src/modules/time/__tests__/time.service.test.ts`
- `src/modules/orders/__tests__/orders.service.test.ts`
- plus minor route-link updates in order/machinist pages.

## Commands run
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run dev` (temporary for screenshot attempt)
- `npm run set-demo-passwords` (to support local login automation)

## Verification evidence
- Lint: passed.
- Tests: passed (full vitest suite).
- Build: passed (Next production build + standalone asset copy).
- Browser capture: automation login path failed on selector discovery; auth-gate screenshot artifact captured instead.

## Next steps / follow-up
- If desired, add robust Playwright auth helper for deterministic screenshot capture on authenticated pages.
- Optional: refine work queue “latest activity” to include non-flagged operational events beyond rework/dept transitions.
