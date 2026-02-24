## 2026-02-24 — Unplanned consolidation: tx timeout fix + single Work Queue + timer semantics

### Completed
- Fixed Orders transaction safety by propagating transaction client usage through department recompute + part event creation paths used by checklist complete-and-advance, and increased interactive Prisma transaction `maxWait`/`timeout` to `20_000ms` for SQLite stability.
- Consolidated list experience into Home Work Queue: added New Order action on `/`, replaced legacy `/orders` list with redirect to `/`, and updated navigation/back-links to point at `/`.
- Reworked department queue behavior to department-tab + include-completed flow, grouped by order with part rows, and service-level sorting aligned to business rules (rework-flagged first, due date asc null-last, order number asc, part-level flagged then partNumber).
- Updated timer behavior to second-level totals and persistent selected-part elapsed display (stored total + active segment), separated Finish timer from part completion, and added explicit Complete Part action gated by checklist completeness.
- Added checklist-gated completion API route (`POST /api/orders/[id]/parts/[partId]/complete`) and server-side validation that returns 409 when checklist work remains.
- Added/updated tests for second-based totals and completion guardrail.

### Verification
- `npm run lint` ✅
- `npm run test` ✅
- `npm run build` ⚠️ (type/build compile passes, but static prerender fails at `/about` due existing Prisma `appSettings` unique constraint in this environment)
- Browser screenshot attempt ⚠️ (Playwright Chromium crashed with SIGSEGV in container, no artifact produced)

### Next
- Investigate `/about` prerender side-effect creating duplicate `appSettings` records in build-time execution path.
- If browser container stability improves, capture updated Work Queue screenshot artifact for visual audit.

**Non-authoritative operational history. CANON.md and ROADMAP.md are authoritative.**

# Progress Log

# PROGRESS_LOG — ShopApp1

Running “what happened / what next” log.
Agents MUST update this at the end of every session.

## Current Priorities (P0 → P3)

### P0 — Platform Stability
- Auth/session reliability (single approach, consistent guards)
- App shell reliability (providers, CSS, layout stability)
- Mobile nav + core shell usability

### P1 — UX + Core Flows
- Orders page redesign (clean, usable, fast)
- Time tracking that supports stop/switch/resume without inflating time

### P2 — Modularization
- Migrate domain logic out of src/lib/* into src/modules/*
- Enforce “repo/service/ui/schema” boundaries
- Establish consistent patterns for validation and data access

### P3 — Expansion
- Reporting/export, attachments, and other add‑ons as needed

## Latest Status

### Repo state summary
- Next.js App Router
- Prisma database layer
- shadcn/tailwind UI
- Auth utilities exist in src/lib/auth.ts
- Domain logic exists in src/lib/* (orders/quotes/etc.) but needs module boundaries

### Important domain note (do not regress)
- All charge kinds are now canonically per-part (`partId` required for all kinds); any order-level charge behavior is legacy drift to be removed.

## Session Log (append newest at top)

### 2026-02-24 — Timer resume workflow for paused part context
- Implemented resume workflow for order-detail timers so a paused part can be resumed (not restarted) from the same Active Work control.
- Added `POST /api/timer/resume` route with the same 409 switch-confirmation payload semantics used by `POST /api/timer/start`, then resumed entries via `resumeTimeEntry`.
- Extended `GET /api/timer/active` to include `lastPartEntries` so client can detect whether selected part has a paused entry to resume.
- Updated `src/app/orders/[id]/page.tsx` to switch primary action label/behavior (`Start selected part` vs `Resume selected part`) and run resume when applicable.
- Added `time.service` test coverage for pause → resume → pause totals retention to ensure prior worked minutes remain intact across interruptions.

Commands run:
- npm run test -- src/modules/time/__tests__/time.service.test.ts
- npm run lint
- npm run dev
- Playwright screenshot capture against http://127.0.0.1:3000 (auth-limited capture)

Verification note:
- Time service tests passed (6/6).
- Lint passed with no ESLint warnings/errors.
- Screenshot capture succeeded, but auth/session in this environment prevented reaching an authenticated order-detail timer view during automated browser capture.


### 2026-02-24 — Timer start 400 fix (missing operation in order detail payload)
- Implemented a scoped bugfix in `src/app/orders/[id]/page.tsx` to include `operation: "Part Work"` when calling `POST /api/timer/start` from the order detail Active Work controls.
- This aligns the client payload with `TimeEntryStart` validation requirements and prevents immediate 400 rejection for missing `operation`.
- No additional refactors or dependency changes were made.

Commands run:
- npm run lint

Verification note:
- Lint passed successfully.
- Timer start payload now includes required `operation` field on this code path.


### 2026-02-23 — Unplanned maintenance: local install docs + timer FK guard + order timer UI cleanup
- Executed targeted maintenance scope requested by user (no broad refactors):
  - Rewrote `README.md` local setup instructions with a clean install/migrate/seed flow and explicit demo-password setup.
  - Added timer-start guard in `src/modules/time/time.service.ts` to map Prisma foreign-key violations (`P2003`) to a deterministic, actionable 409 message (re-login guidance instead of opaque failure).
  - Updated order detail timer actions layout in `src/app/orders/[id]/page.tsx` to use a stacked button grid in the narrow sidebar, preventing control overlap/crowding.
- Validation run completed with production checks and runtime UI capture.

Commands run:
- npm run seed
- npm run set-demo-passwords
- npm run test -- src/modules/time/__tests__/time.service.test.ts
- npm run lint
- npm run build
- npm run dev
- Playwright screenshot capture against `/orders/[id]`

Verification note:
- Seed script succeeded in this environment.
- Time service tests passed (5/5).
- Lint passed with no ESLint warnings/errors.
- Build passed successfully.
- Non-blocking advisories remain: `@next/swc` version mismatch and stale `baseline-browser-mapping` data.
- Screenshot artifact captured: `browser:/tmp/codex_browser_invocations/1794e8d53796eb0b/artifacts/artifacts/order-timer-controls.png`.

### 2026-02-23 — P4-T3 Phase 4 gate closeout evidence
- Executed P4-T3 only; no product-code or behavior changes.
- Validated prior dependency quality for P4-T2 artifacts before proceeding; no unresolved blockers found.
- Produced explicit pass/fail evidence mapping for ROADMAP Phase 4 outcomes:
  - Operators can start/stop/switch without inflation: PASS (time service switch/conflict tests remain green).
  - Managers can trust totals without manual reconciliation: PASS (interval-based totals behavior validated and build/type checks pass).
- Updated continuity/planning artifacts for this closeout session: `tasks/todo.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`.

Commands run:
- npm run test -- src/modules/time/__tests__/time.service.test.ts
- npm run lint
- npm run build

Verification note:
- Time service tests passed (5/5).
- Lint passed with no ESLint warnings/errors.
- Build passed successfully.
- Non-blocking advisories remain in output: `@next/swc` mismatch and stale `baseline-browser-mapping` data.

### 2026-02-23 — P4-T1 + P4-T2 timer control clarity and switch-context visibility
- Executed P4-T1 and P4-T2 only; no unrelated refactors.
- Updated the order detail Active Work panel (`src/app/orders/[id]/page.tsx`) to improve operator control clarity:
  - Added explicit control labels (`Start selected part`, `Pause active timer`, `Finish active timer`) with action icons.
  - Added running/stopped state badge and explicit switch-warning callout when an active timer exists on another part.
  - Added switch helper text so operators understand that switch confirmation is required to avoid overlap.
- Added last-action visibility beside timer controls by surfacing the most recent part event message + timestamp.
- Preserved prior server-side switch enforcement path (no inflation logic changes in this task).
- Dependency quality validation note: reviewed prior P3-T4 artifacts before implementation; no blockers found.

Commands run:
- npm run test -- src/modules/time/__tests__/time.service.test.ts
- npm run lint
- npm run build
- TEST_MODE=true npm run dev -- --hostname 0.0.0.0 --port 3000
- Playwright screenshot capture against `/orders/<id>` order detail page

Verification note:
- Time service tests passed (5/5), including switch-confirmation no-inflation coverage.
- Lint passed with no ESLint warnings/errors.
- Build failed due to pre-existing Prisma prerender issue on `/auth/signin` (`P2002` unique constraint on `AppSettings.id`), unchanged by this task.
- Screenshot artifact captured: `browser:/tmp/codex_browser_invocations/b16608d19312dfd6/artifacts/artifacts/p4-t1-t2-order-detail.png`.

### 2026-02-23 — P3-T3 + P3-T4 Phase 3 closeout and switch-confirmation safety
- Executed P3-T3 and P3-T4 only; no unrelated refactors.
- Added Phase 3 gate evidence in continuity artifacts with explicit pass/fail mapping to ROADMAP Phase 3 criteria.
- Updated `POST /api/timer/start` conflict behavior to require explicit switch confirmation:
  - Uses `startTimeEntryWithConflict` to prevent silent auto-switch.
  - Returns deterministic 409 payload with `requiredAction`, active order/part context, and elapsed time for dialog rendering.
- Hardened order detail switch path in `src/app/orders/[id]/page.tsx`:
  - Conflict dialog now states the currently active order/part and explicit switch consequence.
  - Switch action now aborts if pause/finish fails (prevents accidental follow-on start attempts).
- Added targeted time service tests for conflict-first start behavior and no-inflation switch confirmation flow.
- Dependency quality validation note: reviewed prior P3-T2 artifacts before implementation; no blockers found.

Commands run:
- npm run test -- src/modules/time/__tests__/time.service.test.ts
- npm run lint
- npm run build
- TEST_MODE=true npm run dev -- --hostname 0.0.0.0 --port 3000
- browser screenshot capture via Playwright on `/orders`

Verification note:
- Time service tests passed (5/5).
- Lint passed with no ESLint warnings/errors.
- Build passed successfully.
- Non-blocking advisories remain: `@next/swc` mismatch and stale `baseline-browser-mapping` data warning.
- Screenshot artifact captured: `browser:/tmp/codex_browser_invocations/da1fb07ea0875b74/artifacts/artifacts/orders-page.png`.

### 2026-02-23 — P3-T1 + P3-T2 time invariants and API enforcement
- Executed P3-T1 and P3-T2 only; no unrelated refactors.
- Added closed-interval edit support in the Time module (`time.schema`, `time.types`, `time.service`, `time.repo`) with closed-only conflict handling.
- Added admin-only API endpoint `PATCH /api/time/entries/[entryId]` requiring explicit reason and recording `TIME_ENTRY_EDITED` PartEvent audit metadata when a part-linked entry is edited.
- Strengthened timer API enforcement for deterministic server behavior:
  - `POST /api/timer/start` now uses `TimeEntryStart` schema parsing and explicit `partId` requirement.
  - `GET /api/timer/active` now returns deterministic error status when totals computation fails.
- Added targeted service tests for closed interval edit success/failure and kept existing duration test coverage.
- Dependency quality validation note: reviewed prior P2-T4 evidence before implementation; no blockers found.

Commands run:
- npm run test -- src/modules/time/__tests__/time.service.test.ts
- npm run lint
- npm run build

Verification note:
- Time service tests passed (3/3).
- Lint passed with no ESLint warnings/errors.
- Build passed successfully; non-blocking environment advisories observed for `@next/swc` version mismatch and stale `baseline-browser-mapping` data.

### 2026-02-23 — Fix React hook warnings on Orders detail page
- Scoped change to the user-requested warning cleanup only in `src/app/orders/[id]/page.tsx`.
- Replaced unstable `parts` inline conditional with a memoized `parts` value so hook dependencies are stable.
- Reworked elapsed timer ticker from `tick` counter to `nowMs` timestamp state and updated memo dependencies to remove the unnecessary dependency warning.

Commands run:
- npm run lint
- npm run build

Verification note:
- `npm run lint` now reports `✔ No ESLint warnings or errors`.
- `npm run build` completes successfully; React hook warnings are no longer emitted.

### 2026-02-23 — Resolve Next.js SWC mismatch warning from project-level run
- Scoped change to dependency alignment only (no application code changes).
- Adjusted `next` and `eslint-config-next` from `^15.5.11` to `^15.5.7` so installed SWC binary versions match and the Next.js build no longer emits the SWC version mismatch warning.
- Confirmed existing React hooks warnings in `src/app/orders/[id]/page.tsx` remain pre-existing and intentionally untouched per request scope.

Commands run:
- npm install next@15.5.7 eslint-config-next@15.5.7
- npm run build
- npm run lint

Verification note:
- `npm run build` passes and no longer prints `Mismatching @next/swc version` warning.
- `npm run lint` passes with the same pre-existing React hook warnings only.

### 2026-02-23 — P2-T3 Customers boundary alignment + P2-T4 Phase 2 audit closeout
- Executed P2-T3 and P2-T4 only.
- Added module-owned Customers boundary files: `src/modules/customers/customers.repo.ts`, `customers.service.ts`, `customers.schema.ts`, and `customers.types.ts`.
- Refactored Customers API routes (`/api/admin/customers`, `/api/admin/customers/[id]`) and Customers server pages (`/customers`, `/customers/[id]`, `/customers/[id]/print`) to call Customers services instead of direct Prisma queries.
- Converted `src/lib/zod-customers.ts` into a compatibility shim that re-exports module-owned customer schema/types.
- Dependency quality validation note: P2-T2 continuity docs and verification evidence were reviewed before starting P2-T3/P2-T4; no dependency blocker found.

Commands run:
- rg --files -g 'AGENTS.md'
- sed/cat reads of required pre-read docs (CANON/ROADMAP/AGENT_CONTEXT/PROGRESS_LOG/AGENT_HANDOFF/AGENT_TASK_BOARD/AGENT_PROMPTS/tasks files)
- rg audits for Customers/Orders/Quotes Prisma usage and layering checks
- npm run lint
- npm run build

Verification note:
- Prisma audit commands report no Orders/Quotes/Customers model access outside their domain repo files.
- `npm run lint` passes with pre-existing warnings in `src/app/orders/[id]/page.tsx` (out of scope).
- `npm run build` passes with the same pre-existing warnings and non-blocking advisory warnings for baseline-browser-mapping/@next/swc mismatch.

### 2026-02-23 — P2-T2 Quotes layering enforcement
- Executed P2-T2 only by enforcing Quotes Prisma boundaries and module-owned Quotes schema usage.
- Added `findQuoteAttachmentByStoragePath` to `src/modules/quotes/quotes.repo.ts` with service re-export in `src/modules/quotes/quotes.service.ts`.
- Updated `src/app/(public)/attachments/[...path]/route.ts` to resolve quote attachment metadata via Quotes service instead of direct `prisma.quoteAttachment` access.
- Added `src/modules/quotes/quotes.schema.ts` and migrated Quotes call sites (`quotes.service`, Quotes APIs, Quotes editor UI typing) to module schema imports.
- Converted `src/lib/zod-quotes.ts` into a deprecated compatibility shim re-exporting from `src/modules/quotes/quotes.schema.ts` so domain ownership is module-first without breaking legacy imports.
- Dependency quality validation note: prior dependency task P2-T1 has fresh build/lint evidence in latest continuity docs; no blocker found before starting P2-T2.

Commands run:
- rg --files -g 'AGENTS.md'
- cat required pre-read docs (CANON/ROADMAP/AGENT_CONTEXT/PROGRESS_LOG/AGENT_HANDOFF/AGENT_TASK_BOARD/AGENT_PROMPTS/tasks)
- rg --files src | rg 'quotes|quote'
- rg -n Prisma/Quotes boundary audits across `src`
- npm run test -- src/modules/quotes/__tests__/quote-totals.test.ts src/modules/quotes/__tests__/quote-work-items.test.ts
- npm run lint
- npm run build

Verification note:
- Quotes Prisma boundary audit command returns no Quotes Prisma usage outside `src/modules/quotes/quotes.repo.ts`.
- `npm run test` (targeted Quotes module tests), `npm run lint`, and `npm run build` all pass; build/lint include pre-existing warnings in `src/app/orders/[id]/page.tsx` outside P2-T2 scope.

### 2026-02-23 — P2-T1 Orders layering + mental model enforcement
- Executed P2-T1 only by enforcing Orders data access boundaries for server pages that were still querying Orders via direct Prisma (`/` and `/search`).
- Added Orders repo functions (`getDashboardOrderOverview`, `searchOrdersByTerm`) and corresponding service wrappers (`getHomeDashboardData`, `searchOrders`) so UI/server pages consume Orders data through the module boundary.
- Updated mock Orders repo parity for TEST_MODE by implementing `getDashboardOrderOverview` and `searchOrdersByTerm` in `src/repos/mock/orders.ts`.
- Replaced direct Prisma usage in `src/app/page.tsx` and `src/app/search/page.tsx` with Orders service calls; verified no `prisma.order*`/Orders-table Prisma access remains outside `src/modules/orders/*.repo.ts`.
- Dependency quality validation note: prior phase closeout evidence exists in continuity docs (`P1-T3` in recent logs); no dependency blocker found for starting P2-T1.

Commands run:
- rg --files -g 'AGENTS.md'
- sed -n reads of required pre-reads (CANON/ROADMAP/AGENT_CONTEXT/PROGRESS_LOG/AGENT_HANDOFF/TASK_BOARD/AGENT_PROMPTS/tasks files)
- rg -n "P2-T1|Phase 2|Orders layering" docs/AGENT_TASK_BOARD.md ROADMAP.md PROGRESS_LOG.md docs/AGENT_CONTEXT.md
- rg --files src | rg 'orders|order|api/.*/orders|modules/orders'
- rg -n "@/lib/prisma|prisma\." src/app/api/orders src/modules/orders src/app/orders src/repos/orders.ts
- rg -n "prisma\.(order|orderPart|orderCharge|orderChecklist|partAttachment|partEvent)" src | rg -v "src/modules/orders/.*\.repo\.ts|src/repos/mock/orders.ts"
- npm run lint
- npm run build

Verification note:
- `npm run build` passes after changes (with pre-existing lint warnings in `src/app/orders/[id]/page.tsx`, outside this task scope).
- P2-T1 DoD evidence captured in this session + handoff.

### 2026-02-23 — Governance/canon/task-board standards alignment
- Aligned agent governance docs to ShopApp workflow orchestration standards: mandatory plan-first (`tasks/todo.md`), stop/replan behavior, verification-before-complete, and lessons loop (`tasks/lessons.md`).
- Updated agent task board rules for prior-task validation before new work, mandatory build/test checks, and correction-driven lessons entries.
- Corrected AGENT_PROMPTS task IDs to match task board (`P1-T1/P1-T2/P1-T3`) and added strict verification deliverables.
- Updated CANON/ROADMAP/AGENT_CONTEXT for confirmed business rules: strict part-level charges, orders-as-container/parts-as-work-units enforcement, switch-context dialog expectation, and admin-audited closed-interval edit policy.
- Added new required workflow artifacts: `tasks/todo.md` and `tasks/lessons.md`.

Commands run:
- rg --files -g 'AGENTS.md'
- cat AGENTS.md
- cat docs/AGENT_CONTEXT.md
- cat PROGRESS_LOG.md
- cat docs/AGENT_HANDOFF.md
- cat docs/AGENT_TASK_BOARD.md
- cat AGENT_PROMPTS.md
- cat ROADMAP.md
- cat CANON.md
- rg --files src | head -n 120
- python (doc update scripts)
- rg -n "P0-T1|P0-T2|P0-T3|part-level|orders are containers|tasks/todo.md|tasks/lessons.md|TEST_MODE|admin" AGENT_PROMPTS.md docs/AGENT_TASK_BOARD.md CANON.md ROADMAP.md AGENTS.md docs/AGENT_CONTEXT.md PROGRESS_LOG.md
- npm run lint
- npx prisma db push
- npm run demo:setup
- npm run build

Build note:
- `npm run build` fails in current baseline at prerender due Prisma `appSettings.create()` unique constraint (`P2002`) on `/about`; treated as pre-existing baseline issue and logged for follow-up.


### 2026-02-18 — P1-T2/P1-T3 shell+mobile-nav verification and Phase 1 closeout
- Executed runtime verification for shell/provider stability and mobile nav reachability using Playwright on mobile viewport, including logged-out refresh and logged-in refresh checks on `/`, `/orders`, and `/customers`.
- Seeded demo credentials (`npm run demo:setup`) to ensure authenticated navigation checks could run deterministically.
- Produced a Phase 1 gate report with pass/fail evidence mapped 1:1 to ROADMAP Phase 1 exit criteria (`docs/PHASE1_CLOSEOUT_REPORT.md`).
- Logged non-blocking warnings observed during runtime checks (`@next/swc` version mismatch warning in dev and Radix sheet `Description` warning) as backlog notes rather than drive-by fixes.

Commands run:
- rg --files -g 'AGENTS.md'
- cat AGENTS.md
- cat docs/AGENT_CONTEXT.md
- cat PROGRESS_LOG.md
- cat docs/AGENT_HANDOFF.md
- cat docs/AGENT_TASK_BOARD.md
- cat ROADMAP.md
- cat CANON.md
- npm run lint
- npm run test -- src/lib/auth-redirect.test.ts
- npm run demo:setup
- npm run dev
- Playwright runtime checks against localhost:3000 (refresh + mobile nav reachability)

### 2026-02-18 — P1-T1 auth/session single-source convergence
- Added `src/lib/auth-redirect.ts` as the shared callback URL normalization + sign-in redirect path utility so middleware/pages/sign-in consume one redirect policy.
- Updated middleware and key server route guards (home, search, customers, customer detail/print, order print, account password) to use the shared redirect builder instead of hand-built query strings.
- Updated sign-in to honor and sanitize incoming `callbackUrl`, so logged-out refresh/login now returns to the originating page.
- Added Vitest coverage for callback normalization and redirect path building.

Commands run:
- rg --files -g 'AGENTS.md'
- cat AGENTS.md
- cat docs/AGENT_CONTEXT.md
- cat PROGRESS_LOG.md
- cat docs/AGENT_HANDOFF.md
- cat docs/AGENT_TASK_BOARD.md
- cat AGENT_PROMPTS.md
- cat ROADMAP.md
- cat CANON.md
- rg -n "auth/signin" src middleware.ts
- npm run test -- src/lib/auth-redirect.test.ts
- npm run lint
- npx prisma db push
- npm run demo:setup
- npm run build

Build note:
- `npm run build` fails in current baseline at prerender due Prisma `appSettings.create()` unique constraint (`P2002`) on `/about`; treated as pre-existing baseline issue and logged for follow-up.

### 2026-02-18 — P0-C1 continuity docs freshness check
- Performed a continuity freshness pass for `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, and `docs/AGENT_CONTEXT.md` to ensure the latest completed work is reflected consistently.
- Confirmed latest session ordering is preserved and refreshed handoff metadata/command evidence for this run.
- Added a Decision Log note codifying continuity freshness audits as explicit scoped tasks.

Commands run:
- sed -n '1,220p' PROGRESS_LOG.md
- sed -n '1,260p' docs/AGENT_HANDOFF.md
- sed -n '1,260p' docs/AGENT_CONTEXT.md
- sed -n '1,260p' docs/AGENT_TASK_BOARD.md

### 2026-02-18 — Agent season execution pack (task board + prompt wrappers)
- Added a new ticket-sized execution board (`docs/AGENT_TASK_BOARD.md`) that maps each roadmap phase into atomic tasks with dependencies, scope boundaries, and definition-of-done checklists.
- Added a root-level prompt pack (`AGENT_PROMPTS.md`) with one-task-per-session wrappers and copy/paste prompts keyed to task IDs for low-drift delegation.
- Linked ROADMAP to the new execution companion docs and logged the new delegation pattern in the Decision Log for continuity.

Commands run:
- git status --short --branch
- rg --files | rg 'AGENT_PROMPTS|ROADMAP|PROGRESS_LOG|AGENT_HANDOFF|docs/'

### 2026-02-03 — Build/env fixes + work item flags + checklist/time alignment
- Added affectsPrice to Addon with migration, updated admin add-ons UI + library badges, and ensured quote totals ignore checklist-only items.
- Ensured quote->order conversion and order creation instantiate per-part checklist rows for checklist-only items.
- Fixed Next 15 params/searchParams typing in pages and API routes, and updated public attachments route signature.
- Updated setup-db to load dotenv and removed unsupported migrate flag; aligned test tooling with vitest aliases and server-only stub.
- Timer start now auto-closes active entries; added stop-by-entryId; added tests for pricing totals, quote checklist mapping, and time durations.
- Adjusted mock repos for new signatures and checklist/timer flows.

Commands run:
- npm ci
- npm install
- npx prisma migrate dev --name add_affects_price_to_addon --create-only
- npm test -- src/modules/quotes/__tests__/quote-totals.test.ts src/modules/quotes/__tests__/quote-work-items.test.ts src/modules/time/__tests__/time.service.test.ts
- npm run build

### 2026-02-02 — Restrict non-admin access to PO/quote/invoice attachments
- Filtered order/part attachments for non-admin responses and blocked public attachment downloads when labels indicate Quote/PO/Invoice.
- Added unit tests for attachment filtering in quote-visibility.

Commands run:
- npm test -- src/lib/__tests__/quote-visibility.test.ts
- npm run lint (fails: existing QuoteEditor no-unescaped-entities + existing hooks warnings)
- npm run build (fails: Google Fonts fetch blocked in this environment)

### 2026-02-10 — Store PartEvent meta as text for sqlite compatibility
- Changed PartEvent.meta to TEXT in the Prisma schema, added a migration to redefine the column, and serialize/parse meta JSON in orders repo so sqlite Prisma Client generation works.
- Prisma generate now succeeds locally with sqlite after the schema update.

Commands run:
- DATABASE_URL="file:./dev.db" npx prisma migrate reset --force
- npx prisma generate

### 2026-02-09 — Checklist toggle fix + per-part add-on library + quote field staging
- Fixed checklist toggle API to derive toggler identity from session and return JSON errors; UI now surfaces toggle failures and reverts optimistic state.
- Replaced raw selects/buttons in quote/order flows with shadcn equivalents and added shared AvailableItemsLibrary + AssignedItemsPanel for drag/drop add-ons.
- Added per-part add-on assignments for order creation and quote build parts, with reorder/removal and notes/units fields.
- Introduced CustomField.uiSection (string) and filtered quote custom fields so Finish Required appears in build stage; updated seed/migration.

Validation attempts (blocked by Prisma client generation in this environment):
- Orders checklist toggle flow, quote build parts drag/drop flow, order create flow, and print route could not be verified because `@prisma/client` was not generated (root layout crashed).

Commands run:
- TEST_MODE=true npm run dev -- --hostname 0.0.0.0 --port 3000 (app error: Prisma client not generated)
- DATABASE_URL="file:./dev.db" npx prisma migrate deploy
- DATABASE_URL="file:./dev.db" npm run seed (failed: Prisma client not generated)
- npx prisma generate (failed: Json field unsupported by sqlite connector)

### 2026-02-08 — Add TEST_MODE harness for mock auth + in-memory repos
- Added TEST_MODE switch, centralized auth session helper, and middleware bypass in test mode.
- Added repo factory with mock orders/time/users repos and seeded deterministic data for orders UI.
- Wired orders/time services and admin users API to repo factory, plus test-mode smoke route.
- Documented TEST_MODE (enable via `TEST_MODE=true` locally/Codex/Replit; keep OFF in production) in CANON, handoff, and env example.

Commands run:
- None

### 2026-02-07 — Fix seed vendor record reference in JS seed
- Added vendor upsert tracking in prisma/seed.js to match seed.ts and prevent vendorRecords undefined errors.

Commands run:
- None

### 2026-02-07 — Verified print page template wiring
- Reviewed order/quote print pages and confirmed they render with PrintControls and template-driven section layouts from document templates.

Commands run:
- None

### 2026-02-07 — Quote/order intake steppers and part-centric layouts
- Added stepper-based navigation for quote creation and order creation to separate info, parts, build/review steps.
- Restructured both flows to use a parts list + selected part editor layout for clearer part-centric editing.
- Reorganized assembly-level notes, attachments, and review sections to keep all existing fields reachable.

Commands run:
- None

### 2026-02-06 — Seed data expansion + order detail button polish
- Updated order detail tab and action button spacing to clean up the part details card layout.
- Expanded seed data with 10 orders, per-part addons/checklists, per-part time entries, and 10 quotes to show realistic multi-part workflows.

Commands run:
- npm run dev (failed: Prisma client not initialized for AppSettings)
- npm run seed (failed: Prisma client not initialized)
- npx prisma generate (failed: Json field unsupported by current connector)

### 2026-02-05 — Two-card order workspace, part events, and timer conflict handling
- Refactored the order detail view into a two-card workspace with a sticky active-work timer header, parts list, and tabbed part details (overview, notes/files, checklist, log).
- Added PartEvent + OrderPart.status to track part completion and activity logs, plus new timer API endpoints with conflict handling.
- Logged checklist toggles, notes, file uploads, part updates, timer start/pause/finish, and part completion into the part event log.

Files changed:
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

Commands run:
- None

### 2026-02-04 — Department initialization, checklist enforcement, and seed corrections
- Added currentDepartmentId backfill + migration scripts for order-level department checklists, plus service helpers to initialize parts after checklist sync.
- Enforced per-part department checklist rules in checklist toggle handling and added an assign-department API + UI safety net for unassigned parts.
- Updated department addon seed data to match department-specific defaults and documented charge/checklist glossary.

Files changed:
- src/modules/orders/orders.repo.ts, src/modules/orders/orders.service.ts
- src/app/api/orders/[id]/checklist/route.ts
- src/app/api/orders/[id]/parts/assign-department/route.ts
- src/app/orders/[id]/page.tsx
- scripts/backfill-current-department.ts
- scripts/migrate-orderlevel-dept-checklists-to-parts.ts
- prisma/seed.ts, prisma/seed.js
- README.md
- PROGRESS_LOG.md, docs/AGENT_HANDOFF.md

Commands run:
- npm ci
- npm test
- npm run lint
- npm run build (failed: Prisma unable to open database file during prerender)
- DATABASE_URL="file:./dev.db" npx prisma migrate deploy
- DATABASE_URL="file:./dev.db" npm run seed
- DATABASE_URL="file:./dev.db" npm run set-demo-passwords

### 2026-02-03 — Department routing + feed + transitions
- Added OrderPart.currentDepartmentId with migration plus routing service helpers, feed queries, and transition API routes.
- Implemented department feed cards + filter on Shop Floor Intelligence and added routing dialog for checklist completion with bulk moves.
- Added department readiness unit test and adjusted supporting module helpers.

Files changed:
- prisma/schema.prisma, prisma/migrations/20260130175735_part_current_department/migration.sql
- src/modules/orders/department-routing.ts, src/modules/orders/orders.repo.ts, src/modules/orders/orders.service.ts
- src/modules/orders/__tests__/department-routing.test.ts
- src/app/api/intelligence/department-feed/route.ts
- src/app/api/orders/[id]/parts/transition/route.ts
- src/app/page.tsx, src/components/ShopFloorLayouts.tsx
- src/app/orders/[id]/page.tsx

Commands run:
- npx prisma migrate dev --name part-current-department
- npm ci
- npm test
- npm run lint
- npm run build (failed: Prisma unique constraint error during prerender on AppSettings)
- npm run set-demo-passwords

### 2026-02-02 — Lockdown pass cleanup + build hardening
- Removed patch zip artifacts, archived process docs under docs/archive, and ignored future zip artifacts.
- Added non-authoritative banners to continuity docs and aligned README to npm as the canonical install path.
- Standardized admin quotes pages to use canAccessAdmin and adjusted API routes for consistent ServiceResult handling.
- Converted admin API PrismaClient usage to the shared prisma proxy, added lazy prisma init, and deferred prisma imports in public attachment routes to reduce build-time initialization.
- Removed pnpm-lock.yaml.

Files changed:
- AGENTS.md, PROGRESS_LOG.md, docs/AGENT_CONTEXT.md, docs/AGENT_HANDOFF.md
- README.md, .gitignore, pnpm-lock.yaml (removed)
- docs/archive/* (archived process/patch docs)
- src/app/admin/quotes/[id]/page.tsx, src/app/admin/quotes/page.tsx
- src/app/api/admin/*, src/app/api/orders/*, src/app/api/time/*
- src/app/(public)/attachments/[...path]/route.ts, src/app/(public)/branding/logo/route.ts
- src/lib/auth.ts, src/lib/prisma.ts
- src/modules/orders/orders.repo.ts, src/modules/orders/orders.service.ts, src/modules/time/time.types.ts

Commands run:
- npm ci (succeeded; warnings about deprecated packages)
- npm test (passed)
- npm run lint (passed)
- npm run prisma:generate (failed: Prisma schema validation error on TimeEntry.part relation)
- npm run build (failed: Prisma client not initialized during prerender without generated client)

### 2026-02-01 — Prompt E time tracking UX in orders/parts
- Added time tracking summary API plus repo/service helpers to surface active/last entries per order and part.
- Added order-level and part-level time tracking controls inside the order detail page with clear active/last status.
- Kept UI time tracking calls routed through API to avoid Prisma usage in UI components.

Tests run:
- Not run (not requested).

### 2026-01-31 — Prompt D time tracking interval core
- Added TimeEntry model and time tracking module with interval-based start/pause/stop/resume services.
- Created API routes for time start/pause/stop/resume that enforce single active entry per user.
- Added total computation helper from intervals (no stored totals).

Tests run:
- Not run (not requested).

### 2026-01-30 — Prompt C Orders/Quotes boundary cleanup
- Moved quote preparation logic into quotes service/repo helpers and routed quotes API handlers through the service layer.
- Removed Prisma usage from Orders/Quotes UI pages by fetching through new print-data endpoints and existing admin quote APIs.
- Added print-data API routes for quotes and orders and centralized document template listing.

Tests run:
- Not run (not requested).

### 2026-01-30 — Prompt B steps 3-4 layout/nav stability review
- Reviewed layout/provider tree for unstable conditionals; none found that would drop the shell or providers.
- No layout/nav code changes needed for step 3-4; mobile nav already covers core pages.

Tests run:
- Not run (review only).

### 2026-01-30 — Prompt A Step 3-5 auth guard alignment
- Standardized admin checks in middleware and whoami to use shared RBAC helper for consistent session-based admin evaluation.
- Reviewed layout/providers for duplication; no changes needed.

Tests run:
- Not run (not requested).

### 2026-01-30 — Add roadmap and mechanical agent prompts
- Added ROADMAP.md with gate-based phases and exit criteria.
- Added AGENT_PROMPTS.md with strict, rule-driven agent instructions.
- Logged the decision in docs/AGENT_CONTEXT.md.
- Updated handoff notes for continuity.

Tests run:
- Not run (not requested).

### 2026-01-30 — Add canonical project document
- Created CANON.md to define the product purpose, mental model, UX principles, and roadmap.
- Logged the new canon file in the Decision Log to prevent context drift.
- Updated handoff notes for continuity.

Tests run:
- Not run (per request).

### 2026-01-29 — Fix middleware response status typing
- Updated middleware to set status via NextResponse.rewrite init to satisfy read-only typing.
- Build now advances past middleware but fails in Orders assign route type narrowing (not modified).

Tests run:
- `npm run build` (failed: src/app/api/orders/[id]/assign/route.ts ServiceResult .data typing)

### 2026-01-29 — Regenerated Prisma client for build
- Ran `npx prisma generate` to fix the missing Prisma client artifacts.
- Build now progresses further but fails due to a TypeScript error in middleware (no changes made per constraints).

Tests run:
- `npx prisma generate`
- `npm run build` (failed: middleware.ts type error assigning to read-only status)

### 2026-01-29 — Mark quotes routes server-only
- Added `server-only` imports to all Quotes API routes.
- Re-ran build; failure persists due to missing Prisma client browser artifacts in this environment.

Tests run:
- `npm run build` (failed: Module not found: Can't resolve '.prisma/client/index-browser')

### 2026-01-29 — Add server-only to quotes repo
- Added the server-only import to the Quotes repo module.
- Re-ran build; failure persists due to missing Prisma client browser artifacts in this environment.

Tests run:
- `npm run build` (failed: Module not found: Can't resolve '.prisma/client/index-browser')

### 2026-01-29 — Quotes API routes use quotes repo
- Created src/modules/quotes/quotes.repo.ts and moved Quotes API Prisma queries into repo functions.
- Updated Quotes API routes to use the repo, keeping runtime behavior the same while enforcing Prisma boundaries.
- Build failed in this environment due to missing Prisma client build artifacts (see tests).

Tests run:
- `npm run build` (failed: Module not found: Can't resolve '.prisma/client/index-browser')

### 2026-01-30 — Orders API routes layered via repo/service
- Moved all Orders API route Prisma access into src/modules/orders/orders.repo.ts and added service wrappers for each Orders route.
- Updated Orders API routes to call orders.service.ts for data access and business rules, keeping routes thin.
- Orders routes no longer import Prisma directly, enforcing the Orders module boundary.

Next steps (immediate)
- Continue module extraction for the next domain (Quotes) following the Orders repo/service pattern.

### 2026-01-29 — Orders module extraction (repo/service/schema/types)
- Moved Orders domain helpers out of src/lib into src/modules/orders (repo/service/schema/types).
- Updated Orders-related API routes and UI imports to use the new module entry points.
- Documented remaining boundary gap: Orders API routes still use Prisma directly and need repo/service extraction later.

Next steps (immediate)
- Move Prisma access from Orders API routes into src/modules/orders/orders.repo.ts with service wrappers.
- Continue module extraction for the next domain (Quotes) after Orders routes are fully layered.

### 2026-01-28 — Architecture map + continuity docs alignment
- Reviewed current app shell, domains, data flow, and charge model to establish a repo-backed architecture map.
- Documented boundary violations and a plan-only Orders module extraction list (no code changes).
- Added docs/ARCHITECTURE_MAP.md and created docs/AGENT_CONTEXT.md and docs/AGENT_HANDOFF.md (docs were missing in /docs).

Next steps (immediate)
- Decide whether to deprecate/remove root AGENT_CONTEXT.md and AGENTS_HANDOFF.md now that docs/ copies exist.
- Begin Orders module extraction planning with repo/service/schema split.

### 2026-01-28 — Continuity spine created + corrected charge note
- Added AGENTS.md (agent charter + architecture rules)
- Added docs/AGENT_CONTEXT.md (priorities + invariants + decision log)
- Added docs/AGENT_HANDOFF.md (handoff template)
- Clarified that LABOR/ADDON are already per‑part; only other charge kinds may be order‑level

Next steps (immediate)
- Confirm desired UX direction for Orders page (hierarchy, what fields matter)
- Decide initial module split: Orders / Quotes / Customers / Time
- Begin “architecture lock” (file moves + boundary enforcement) without changing functionality

## Upcoming Work Queue (short list)

- [ ] Create src/modules/* structure and migrate one domain (Orders) first
- [ ] Standardize server-side data access pattern (repo/service)
- [ ] Standardize validation entry points (zod schemas in module)
- [ ] Establish mobile-first app shell nav pattern and apply across key pages
- [ ] Implement time tracking model (TimeEntry, active timer constraints)



## 2026-01-28
- Summary: Added admin-only part management controls with invoice handling prompts, add-on/labor charge copying, and server-side logging for part changes.
- Tests run: `npm run lint`

## 2026-01-23
- Summary: Expanded the Replit agent playbook with publishing rules, debugging checklist, and deployment templates.
- Tests run: `npm run lint`

## 2026-01-22
- Summary: Normalized template section data for the admin template designer and restored the Shop Floor Intelligence nav link.
- Tests run: `npm run lint`

## 2026-01-22
- Summary: Added Replit deployment playbook, fixed admin access handling, improved mobile navigation and orders list, and ensured standalone asset copying for Replit deployments.
- Tests run: `npm run lint`

## 2026-01-22
- Summary: Simplified NextAuth credential handling by removing debug logs and centralizing role/admin normalization helpers for cleaner session/token mapping.
- Tests run: `npm run lint`

## 2026-01-22
- Summary: Replaced raw img tags with Next.js Image components and fixed an effect dependency with useCallback.
- Tests run: `npm run lint`

## 2025-09-27
- Summary: Rebuilt the admin template builder into a drag-and-drop section canvas with a website-builder-style library and richer live preview.
- Tests run: `npm run lint` (failed: ESLint not installed in environment)

## 2026-01-21
- Summary: Added invoice and order-print specific live preview content in the template editor so layouts reflect the selected document type.
- Tests run: `npm run lint`

## 2026-01-21
- Summary: Added template selection controls for quote printing so admins can preview and print with any active quote template.
- Tests run: `npm run lint`

## 2026-01-21
- Summary: Added template selection for order print previews and disabled webpack caching in dev to avoid missing .next cache warnings.
- Tests run: `npm run lint`

## 2026-02-24
- Summary: Implemented department auto-advance confirmation flow for checklist completion, centralized part department recompute logic, and reason/flag logging for rework/backward/manual transitions.
- Scope highlights:
  - Added checklist preview + complete-and-advance API endpoints for order-part checklist items.
  - Added `recomputePartDepartment` service and routing-aware checklist filtering (`isChecklistItem` only).
  - Added reason-required enforcement for backward snap-back and manual department transitions with flagged `PartEvent` meta.
  - Updated order detail checklist behavior to avoid optimistic check on last-item completion and to request reason on backward reopen.
  - Updated intelligence department feed to support include-completed and surfaced REWORK badges for flagged parts.
- Tests run:
  - `npm run lint`
  - `npm run test -- src/modules/orders/__tests__/department-routing.test.ts`
  - `npm run build`
- Backlog notes (not implemented):
  - Replace browser-native `confirm/prompt` interactions in order checklist with first-class shadcn modal forms for richer validation/UX parity.
  - Add focused service tests for `recomputePartDepartment`, `previewChecklistComplete`, and backward-reason enforcement branches.
