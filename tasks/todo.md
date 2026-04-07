# tasks/todo.md — Session Plan + Verification

## Session Metadata
- Date: 2026-04-07
- Agent: GPT-5.3-Codex
- Task ID: Unplanned account sign-out UX follow-up
- Goal: Add a visible logout control on the account page so users can sign out and log into a different account.

## Dependency Validation
- [x] Reviewed `docs/AGENT_CONTEXT.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, and `docs/AGENT_TASK_BOARD.md` before implementation.
- [x] Validated prior dependency quality via the latest continuity entry for the nav/about change session.
- [x] Scope constrained to account page sign-out access only.

## Plan First
- [x] Add a clear sign-out control within the account password page UI.
- [x] Ensure sign-out redirects users back to the sign-in page to support account switching.
- [x] Run lint and update continuity docs.

## Verification Checklist
- [x] `npm run lint`

## Review + Results
- Added an explicit `Sign out` button on the account password page so logged-in users can immediately log out before switching accounts.
- Wired sign-out to NextAuth `signOut({ callbackUrl: '/auth/signin' })` so logout returns directly to the sign-in page for a quick account swap flow.
- Lint passed with no ESLint warnings/errors.

---

# tasks/todo.md — Session Plan + Verification

## Session Metadata
- Date: 2026-04-07
- Agent: GPT-5.3-Codex
- Task ID: Unplanned nav/auth/about cleanup
- Goal: Add a clear Sign In tab to the main navigation and remove the About page/route from the app shell.

## Dependency Validation
- [x] Reviewed `docs/AGENT_CONTEXT.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, and `docs/AGENT_TASK_BOARD.md` before implementation.
- [x] Validated prior dependency quality by checking latest completed session evidence (2026-04-07 explicit department submit flow) in continuity logs.
- [x] Scope constrained to navigation/auth entry visibility and about route removal only.

## Plan First
- [x] Update `AppNav` links to remove About and add a visible Sign In nav tab when unauthenticated.
- [x] Remove the `/about` page route implementation file.
- [x] Run lint verification for touched paths.
- [x] Update continuity docs (`PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`) with commands/results after verification.

## Verification Checklist
- [x] `npm run lint`

## Review + Results
- Updated `AppNav` to remove the About tab and add a `Sign In` tab in the nav link set for unauthenticated users while preserving the existing account/sign-in CTA button.
- Removed `src/app/about/page.tsx` so `/about` is no longer an application page.
- Lint passed with no ESLint warnings/errors.

---

# tasks/todo.md — Session Plan + Verification

## Session Metadata
- Date: 2026-04-07
- Agent: GPT-5.3-Codex
- Task ID: Unplanned workflow fix (explicit department submit + checklist grouping + manual time adjustment)
- Goal: Replace checklist auto-advance with explicit department completion submission, enforce department checklist gate, show grouped checklist UI, and include manual added-time notes in part totals.

## Dependency Validation
- [x] Reviewed `docs/AGENT_CONTEXT.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, and `docs/AGENT_TASK_BOARD.md` before implementation.
- [x] Scope constrained to Orders/Time flow and order detail UX for requested behavior.
- [x] No new npm dependencies added.

## Plan First
- [x] Add explicit submit endpoint/service path for department completion with server-side checklist gate and optional manual time addition note.
- [x] Remove checklist toggle auto-advance behavior and keep checklist toggles as checklist-only updates.
- [x] Update order detail checklist UI to render all checklist items grouped under department labels.
- [x] Add part-detail total-time presentation showing timer total + manual added time + notes.
- [x] Add focused tests and run lint/test/build verification.

## Verification Checklist
- [x] `npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/20260407120000_add_part_time_adjustments/migration.sql`
- [x] `npx prisma migrate deploy`
- [x] `npx prisma generate`
- [x] `npm run lint`
- [x] `npm run test -- src/modules/orders/__tests__/orders.service.test.ts`
- [ ] `npm run build` *(fails on pre-existing sterling-site TypeScript moduleResolution/plugin-react issue in this environment)*

## Review + Results
- Added `PartTimeAdjustment` persistence model and order-detail data loading for manual added-time entries with user/note/seconds metadata.
- Added authenticated machinist route `POST /api/orders/[id]/parts/[partId]/submit-department-complete` with service-level validation that all checklist items in the part's current department are complete before movement/completion.
- Added optional manual added-time capture during submit flow, requiring a note when additional time is entered.
- Removed checklist auto-advance from checkbox toggles so checkbox actions no longer trigger department transitions.
- Updated order detail checklist UI to group all part checklist items by department labels.
- Added total time block in order detail that shows timer total, manual total, combined total, and manual-note history for the selected part.

---

# tasks/todo.md — Session Plan + Verification

## Session Metadata
- Date: 2026-04-02
- Agent: GPT-5.3-Codex
- Task ID: Follow-up fix (part complete route + order detail status parity)
- Goal: Restore a reachable part-complete API path and remove the order-detail UI status override that could show COMPLETE before persisted part status.

## Dependency Validation
- [x] Reviewed `docs/AGENT_CONTEXT.md`, `PROGRESS_LOG.md`, and `docs/AGENT_HANDOFF.md` before implementation.
- [x] Scope constrained to stale route/path parity and UI/backend completion-state mismatch.
- [x] No new dependencies added.

## Plan First
- [x] Add a dedicated part-complete API route that invokes `completeOrderPart` with existing machinist auth guards.
- [x] Wire order-detail UI with a "Mark selected part complete" action using that route.
- [x] Remove checklist-derived status override so part cards use persisted part status.
- [x] Verify with lint and then update continuity docs.

## Verification Checklist
- [x] `npm run lint`

## Review + Results
- Added `POST /api/orders/[id]/parts/[partId]/complete` and routed it to `completeOrderPart`.
- Added a "Mark selected part complete" action in order detail so the completion path is reachable from current UI flows.
- Updated part-card status rendering to use persisted part status (`part.status`) instead of UI-only checklist override.
- Lint passed.

---

# tasks/todo.md — Session Plan + Verification

## Session Metadata
- Date: 2026-03-23
- Agent: GPT-5.2-Codex
- Task ID: Unplanned standalone marketing site
- Goal: Create an isolated one-page premium manufacturing marketing site in a dedicated subfolder with its own tooling, polished motion, responsive sections, and delivery docs.

## Dependency Validation
- [x] Reviewed `docs/AGENT_CONTEXT.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, and `docs/AGENT_TASK_BOARD.md` before implementation.
- [x] Validated this work is isolated from the main app and will live in its own subfolder with separate config/dependencies.
- [x] Applied relevant lessons: plan first for multi-file work, keep edits scoped, and record verification evidence explicitly.

## Plan First
- [x] Choose the isolated frontend stack/folder structure and scaffold the standalone site without coupling to the main app.
- [x] Build the one-page responsive experience, sticky nav, section content, motion system, and easy-to-swap media/content structure.
- [x] Add standalone project README plus continuity/decision-log updates for the new subproject.
- [x] Verify install/build behavior, then update continuity docs, commit, and prepare PR metadata.

## Verification Checklist
- [x] `npm install`
- [x] `npm run build`
- [x] `npm run check`
- [x] Screenshot capture attempt for the new marketing site

## Review + Results
- Added an isolated `sterling-site/` Vite + React + TypeScript subproject with its own package/config files so the marketing site does not share the main app's runtime, styles, or dependencies.
- Built a premium one-page manufacturing site with a sticky section nav, smooth scrolling, reveal animations, animated ambient mesh/parallax motion, and all requested content sections.
- Centralized editable marketing copy/data in `sterling-site/src/siteContent.ts` and documented run/build/deploy/media-swap instructions in `sterling-site/README.md`.
- Verified install, type-check, production build, and local HTTP smoke response for the standalone site.
- Screenshot capture could not be completed because the required browser screenshot tool is unavailable in this environment.

---


# tasks/todo.md — Session Plan + Verification

## Session Metadata
- Date: 2026-03-23
- Agent: GPT-5.2-Codex
- Task ID: Unplanned workflow/status alignment (order rollup + admin override)
- Goal: Simplify order status into a dashboard/search-friendly workflow rollup that auto-syncs from part activity and remains admin-editable with audit reasons.

## Dependency Validation
- [x] Reviewed `docs/AGENT_CONTEXT.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, and `docs/AGENT_TASK_BOARD.md` before implementation.
- [x] Scope constrained to order workflow status behavior, dashboard/search/filter alignment, admin editability, seeds/tests, and continuity updates.
- [x] Applied existing lessons: plan first for multi-file work and keep verification explicit.

## Plan First
- [x] Add clear workflow status rules and normalization helpers in Orders service.
- [x] Auto-sync order status from part activity/checklist/department/timer transitions.
- [x] Align dashboard/search/filter/UI/admin edit flows with the simplified statuses.
- [x] Update seed/mock data and add focused regression coverage.
- [x] Verify with lint/tests/build, then refresh continuity docs.

## Verification Checklist
- [x] `npm run lint`
- [x] `npm run test -- src/modules/orders/__tests__/department-routing.test.ts src/modules/orders/__tests__/orders.service.test.ts src/modules/orders/__tests__/orders.status.test.ts`
- [x] `npm run build`
- [x] `npx tsc --noEmit`

## Review + Results
- Simplified manager-facing order statuses to `RECEIVED`, `IN_PROGRESS`, `COMPLETE`, and `CLOSED` while normalizing legacy values into that set for dashboard/search surfaces.
- Added workflow status auto-sync after real part progress actions and kept `CLOSED` as the admin terminal state.
- Added an admin order-status editor with required reason entry on the order detail page and changed the order-status API to admin-only audited updates.
- Updated seed/mock fixtures and added focused helper tests for workflow status derivation.
- Production build/lint/tests all passed after including a small quotes repo type-annotation compatibility fix required by the current toolchain.
- Browser screenshot capture was skipped because the browser screenshot tool is unavailable in this environment.

# tasks/todo.md — Session Plan + Verification

## Session Metadata
- Date: 2026-03-19
- Agent: GPT-5.2-Codex
- Task ID: Unplanned bugfix (order create validation, sign-in discoverability, LAN-safe auth URLs)
- Goal: Fix the order creation Prisma validation failure, expose an obvious sign-in entry point, and make auth/base-URL handling work more reliably when the app is opened from a local-network IP.

## Dependency Validation
- [x] Reviewed `docs/AGENT_CONTEXT.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, and `docs/AGENT_TASK_BOARD.md` before implementation.
- [x] Scope constrained to the reported order-create/auth/LAN access issues plus required continuity/doc updates.
- [x] Applied relevant lessons: plan first for cross-file work and keep the fix narrow.

## Plan First
- [x] Inspect the failing order-create path and Prisma schema mismatch to confirm the root cause.
- [x] Implement the minimal order-create fix and LAN-aware auth/base-URL handling.
- [x] Add/adjust visible sign-in navigation so unauthenticated users have a clear click path.
- [x] Run targeted verification, then update continuity docs with evidence and instructions.

## Verification Checklist
- [x] npm run prisma:generate
- [x] npx prisma migrate deploy
- [x] node - <<'JS' ... PRAGMA table_info("OrderPart") ... JS
- [x] npm run lint
- [x] npm run test -- src/lib/auth-redirect.test.ts src/lib/base-url.test.ts
- [x] npm run dev -- --hostname 0.0.0.0 --port 3000
- [x] curl -I --max-time 20 http://127.0.0.1:3000/about
- [x] curl -I --max-time 20 'http://127.0.0.1:3000/auth/signin?callbackUrl=%2F'
- [x] curl -I --max-time 20 http://127.0.0.1:3000/

## Review + Results
- Root cause of the order-create 500: `orders.service.ts` selected nested `parts` ordered by `createdAt`, but `OrderPart` did not actually have `createdAt` / `updatedAt` columns in the Prisma schema or SQLite DB, so Prisma rejected `order.create()` before writing the order.
- Added `createdAt` / `updatedAt` to `OrderPart`, created a SQLite-safe table-redefinition migration, regenerated Prisma Client, and confirmed the columns exist in `OrderPart` after migration.
- Added a shared base-URL resolver so auth redirects/sign-out prefer the incoming request origin when env vars still point at loopback (`localhost`) but the app is being opened from a LAN IP.
- Made `/about` publicly reachable, added it to main navigation, and preserved sign-in/dashboard CTAs so unauthenticated users now have an obvious page with a clickable sign-in path.
- Hardened `getAppSettings()` with `upsert()` after runtime verification exposed a singleton-create race when multiple requests hit a fresh database.
- Browser screenshot capture was not performed because the required browser screenshot tool was not available in this environment.

---

# tasks/todo.md — Session Plan + Verification

## Session Metadata
- Date: 2026-02-26
- Agent: GPT-5.2-Codex
- Task ID: Admin IA cleanup + installer/seed orchestration
- Goal: Clean up admin navigation/landing UX and add a single installer entrypoint with basic vs demo seed modes for local or Docker setups.

## Dependency Validation
- [x] Reviewed `docs/AGENT_CONTEXT.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, and `docs/AGENT_TASK_BOARD.md` before implementation.
- [x] Scope limited to admin IA/UI organization, seed mode tooling, and installation workflow docs/scripts.

## Plan First
- [x] Rework admin information architecture: add an admin landing page and grouped tab navigation that is easier to scan.
- [x] Add seed-mode split (`basic` functionality seed vs `demo` populated seed) with scripts that remain deterministic.
- [x] Add one-command installer script supporting local machine bootstrap and Docker bootstrap with selectable seed mode.
- [x] Verify with lint + seed dry run command + screenshot evidence; then update continuity docs.

## Verification Checklist
- [x] `npm run lint`
- [x] `npm run seed:basic`
- [x] `npm run seed:demo`
- [x] `bash scripts/install.sh --help`

## Review + Results
- Added a dedicated `/admin` landing page with grouped admin control cards and improved navigation clarity for the newly polished UI style.
- Refactored admin tab navigation into grouped sections (Overview, People, Catalog, Quote Ops) with icons and wrapped layout for cleaner scanning.
- Added a one-command installer (`scripts/install.sh`) supporting `--target local|docker` and `--seed basic|demo` with clear help/validation.
- Added a new `prisma/seed-basic.js` foundational seed and split package scripts into `seed:basic` and `seed:demo` modes.
- Captured updated admin UI screenshot artifact after signing in with seeded admin credentials.

---

## Session Metadata
- Date: 2026-02-26
- Agent: GPT-5.2-Codex
- Task ID: Follow-up bugfix (QA findings remediation)
- Goal: Fix high-priority issues discovered in prior QA pass: duplicate order number risk, TEST_MODE repo split-brain, and timer TEST_MODE mismatch.

## Dependency Validation
- [x] Reviewed `docs/AGENT_CONTEXT.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, and `docs/AGENT_TASK_BOARD.md`.
- [x] Scope limited to proven flow defects; no unrelated refactors/dependencies.

## Plan First
- [x] Make TEST_MODE repo selection explicit (`TEST_MODE_USE_MOCK_REPOS`) to keep runtime API flows DB-consistent.
- [x] Move quote→order number generation into conversion transaction and enforce schema uniqueness on `Order.orderNumber`.
- [x] Re-run quote conversion tests and full suite; live-verify conversion + timer active/pause flow in TEST_MODE dev.
- [x] Update continuity docs with fix evidence and remaining risks.

## Verification Checklist
- [x] `npm run test`
- [x] `TEST_MODE=true npm run dev -- --hostname 0.0.0.0 --port 3000`
- [x] Runtime python/curl script for quote conversion + order fetch + timer start/active/pause

## Review + Results
- Fixed conversion to generate order numbers inside DB transaction and return generated number from conversion service.
- Added `@unique` constraint to `Order.orderNumber` in Prisma schema as a hard guard.
- Fixed TEST_MODE split-brain by defaulting repos to Prisma unless `TEST_MODE_USE_MOCK_REPOS=true`; Vitest now sets the mock flag via setup file to preserve existing unit test behavior.
- Runtime verification confirms converted order is now visible to `/api/orders/{id}` and timer start/active/pause are consistent in TEST_MODE dev.

---

# tasks/todo.md — Session Plan + Verification

## Session Metadata
- Date: 2026-02-26
- Agent: GPT-5.2-Codex
- Task ID: QA architecture pass (quote/order/admin flow verification)
- Goal: Reverse-engineer implemented business workflow, add executable tests for high-risk transitions, run runtime verification, and log prioritized bugs for admin/backend flow correctness.

## Dependency Validation
- [x] Reviewed `docs/AGENT_CONTEXT.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, and `docs/AGENT_TASK_BOARD.md` before implementation.
- [x] Scope constrained to QA/testing plus minimal bug fixes only when proven by failing tests.
- [x] Applied lessons: plan-first for cross-file work and evidence-backed reporting.

## Plan First
- [x] Inventory stack/run commands and existing tests (Phase 0).
- [x] Map actual implemented workflow for quote create/approval/print-data/conversion/custom fields and department transitions (Phase 1).
- [x] Add tests for happy paths and edge cases in those workflows (Phase 2).
- [x] Run tests and live local flow checks via app/API (Phase 3).
- [x] Document prioritized bugs with repro + code refs; update continuity docs (Phase 4).

## Verification Checklist
- [x] `npm run test`
- [x] `TEST_MODE=true npm run dev -- --hostname 0.0.0.0 --port 3000`

## Review + Results
- Added route-level Vitest coverage for quote conversion and approval endpoints with mocked auth/settings/service boundaries.
- Executed full Vitest suite and runtime API flow scripts in TEST_MODE to validate quote creation, conversion gating behavior, department transition guards, and timer lifecycle behavior.
- Identified critical flow defects in TEST_MODE runtime (quote conversion duplicate order numbers, timer active-state mismatch, and conversion route bypassing orders mock repo).

---

# tasks/todo.md — Session Plan + Verification

## Session Metadata
- Date: 2026-02-26
- Agent: GPT-5.2-Codex
- Task ID: Unplanned bugfix (BOM part attachment retrieval path)
- Goal: Fix BOM analyzer failure by making `/attachments/<storagePath>` resolve part-level attachments used by Notes & Files uploads.

## Dependency Validation
- [x] Reviewed `docs/AGENT_CONTEXT.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, and `docs/AGENT_TASK_BOARD.md` before implementation.
- [x] Validated scope is a minimal server route fix only; no schema/dependency changes.
- [x] Applied relevant lessons: keep fix narrow and verify with lint.

## Plan First
- [x] Update attachment-serving route to include `PartAttachment` lookup by `storagePath`.
- [x] Preserve existing auth/restricted-label behavior and route file-serving path checks.
- [x] Run lint and record verification evidence.
- [x] Update continuity docs and lessons after user tool-usage correction.

## Verification Checklist
- [x] `npm run lint`

## Review + Results
- Updated `src/app/(public)/attachments/[...path]/route.ts` to resolve `prisma.partAttachment` records when quote/order attachment lookups miss.
- This unblocks BOM analyzer retrieval for Notes & Files uploads because part files are stored in `PartAttachment`.
- Preserved existing attachment visibility checks and response behavior.

---

# tasks/todo.md — Session Plan + Verification

## Session Metadata
- Date: 2026-02-26
- Agent: GPT-5.2-Codex
- Task ID: Unplanned investigation (BOM tab image analysis failure)
- Goal: Diagnose why BOM tab image analysis fails with `Failed to load selected image attachment` for existing and newly uploaded files, without implementing a fix.

## Dependency Validation
- [x] Reviewed `docs/AGENT_CONTEXT.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, and `docs/AGENT_TASK_BOARD.md` before investigation.
- [x] Scope constrained to diagnosis/evidence only (no behavior changes).
- [x] Applied relevant lessons: plan first for multi-step work and provide evidence-backed root cause.

## Plan First
- [x] Trace BOM analyzer client path from selected attachment → attachment fetch → print analyzer API request.
- [x] Trace server attachment-serving route and verify whether part attachments are resolvable by storage path.
- [x] Correlate findings with user-observed error text and identify single root cause chain.
- [x] Update continuity docs with root cause and next-step recommendation (no code fix this session).

## Verification Checklist
- [x] `rg -n "Failed to load selected image attachment|/attachments/|storagePath" src/app src/lib prisma -g '*.ts*'`
- [x] `sed -n '1,220p' src/app/orders/[id]/PartBomTab.tsx`
- [x] `sed -n '1,220p' 'src/app/(public)/attachments/[...path]/route.ts'`
- [x] `sed -n '180,340p' prisma/schema.prisma`

## Review + Results
- Confirmed BOM tab throws `Failed to load selected image attachment.` when fetch to `/attachments/<storagePath>` is non-OK.
- Confirmed the public attachment-serving route checks `QuoteAttachment` and legacy order-level `Attachment` records only.
- Confirmed part Notes & Files uploads are stored as `PartAttachment` records, which are not queried by the attachment-serving route.
- Diagnosis: part attachment uploads can succeed, but retrieval via `/attachments/<storagePath>` returns 404 because `PartAttachment` is omitted in lookup, causing BOM analysis to fail before analyzer API is called.

---

# tasks/todo.md — Session Plan + Verification

## Session Metadata
- Date: 2026-02-26
- Agent: GPT-5.2-Codex
- Task ID: Unplanned bugfix (Part BOM analyzer attachment handling + quote→order conversion audit)
- Goal: Fix Part BOM analyzer failures when selecting Notes & Files attachments and audit quote-to-order conversion flow for obvious logic gaps.

## Dependency Validation
- [x] Reviewed `docs/AGENT_CONTEXT.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, and `docs/AGENT_TASK_BOARD.md` before implementation.
- [x] Validated this scope is limited to BOM analyzer attachment ingestion and conversion-path review (no schema/dependency changes).
- [x] Applied relevant lessons: plan first for multi-step work, verify behavior with lint + runtime evidence.

## Plan First
- [x] Reproduce/read BOM analyzer attachment source path and identify why Files/Notes uploads fail.
- [x] Apply a minimal Part BOM fix so only valid image attachments are analyzed and MIME selection is resilient.
- [x] Audit quote→order conversion flow (`/api/admin/quotes/[id]/convert` + repo conversion transaction) and record findings.
- [x] Run lint and capture screenshot evidence for the affected front-end flow.
- [x] Update continuity docs with commands, evidence, and remaining follow-ups.

## Verification Checklist
- [x] `npm run lint`
- [x] `npm run dev -- --hostname 0.0.0.0 --port 3000` (runtime smoke)
- [x] Playwright screenshot capture via browser tool

## Review + Results
- Root cause for BOM analyzer failure: the Part BOM attachment picker admitted PRINT attachments with explicit non-image MIME types and preferred `blob.type`, which can be non-image; this created invalid `data:` payloads for `/api/print-analyzer/analyze`.
- Updated Part BOM attachment filtering to exclude explicit non-image MIME attachments from analyzer source options.
- Updated selected-attachment MIME resolution to prefer known image MIME hints, then image blob MIME, with an explicit error when the selected file is not image content.
- Audited quote→order conversion flow and confirmed core transaction behavior remains: order create, parts create, attachment copy, charge/checklist carry-over, and quote metadata conversion stamp are wired as expected in current scope.
- Captured runtime screenshot artifact (sign-in route reached from app root redirect in this environment): `browser:/tmp/codex_browser_invocations/a282bb14452d16f9/artifacts/artifacts/bom-tab-update.png`.

---

# tasks/todo.md — Session Plan + Verification

## Session Metadata
- Date: 2026-02-26
- Agent: GPT-5.2-Codex
- Task ID: Unplanned UX/auth/print-analyzer alignment
- Goal: Reorder order-detail tabs, wire BOM analyzer to print-file workflow, add quote-time print upload designation, remove Overview from nav, and ensure sign-in-first routing to dashboard.

## Dependency Validation
- [x] Reviewed `docs/AGENT_CONTEXT.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, and `docs/AGENT_TASK_BOARD.md` before implementation.
- [x] No dependency blockers found for this scoped cross-file UX/auth update.
- [x] Applied relevant lessons: plan first for multi-step changes and verify full requested UI surfaces with screenshots.

## Plan First
- [x] Move order-part BOM tab next to Notes & Files and update Notes & Files headings to include a dedicated print-image section used by BOM analyzer.
- [x] Update BOM tab source selection to prioritize/use dedicated print images from part attachments; expand attachment kind options accordingly.
- [x] Add a quote-creation attachment option to mark uploads as print images for downstream analyzer workflows.
- [x] Hide Overview route from main nav without deleting the page.
- [x] Enforce sign-in-first UX (redirect unauthenticated `/about` to sign-in, then return to dashboard).
- [x] Run lint/tests (or focused checks), capture multiple screenshots, and update continuity docs.

## Verification Checklist
- [x] `npm run lint`
- [x] `npm run test -- src/lib/auth-redirect.test.ts`
- [x] Browser screenshots captured for nav/auth/order routes (runtime currently returns 500 error shell in this environment).

## Review + Results
- Reordered order-part tabs so BOM appears immediately after Notes & Files and added a dedicated print-image guidance slot under Files & print drawings.
- Added `PRINT` as a first-class part attachment kind and updated BOM attachment chooser to prioritize/label PRINT-tagged sources from Notes & Files.
- Added a quote attachment-level analyzer role checkbox that marks uploads with a `[PRINT]` label tag for downstream print selection workflows.
- Removed Overview from primary app nav and added unauthenticated redirect on `/about` to sign-in with dashboard callback.
- Strengthened print analyzer prompts to explicitly extract lower-right title-block decimal-place tolerances (`.X`, `.XX`, `.XXX`).
- Verification: lint + focused auth redirect tests passed; browser screenshots captured but pages currently render 500 error state in this runtime environment.

---

# tasks/todo.md — Session Plan + Verification

## Session Metadata
- Date: 2026-02-25
- Agent: GPT-5.2-Codex
- Task ID: Unplanned order-part BOM tab integration
- Goal: Integrate existing Print Analyzer API into Order → Part detail as a native BOM tab with dark-theme cards/tables and deterministic tolerance/thread helpers.

## Dependency Validation
- [x] Reviewed `docs/AGENT_CONTEXT.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, and `docs/AGENT_TASK_BOARD.md` before implementation.
- [x] Validated scope constraints: no DB/schema/global CSS changes, no unrelated refactors, use existing `/api/print-analyzer/analyze`.
- [x] Applied relevant lessons: plan first for cross-file UI work and keep verification evidence explicit.

## Plan First
- [x] Add a dedicated `PartBomTab` client component under `src/app/orders/[id]/` with upload/select-image input, analyze action, loading/error states, and results cards/tables.
- [x] Implement UI-local helpers for unit conversion/formatting, thread-pitch parsing, and deterministic tight-tolerance heuristics.
- [x] Wire BOM into order-part tabs in `src/app/orders/[id]/page.tsx` without changing existing tab behavior.
- [x] Update `docs/PRINT_ANALYZER.md` with BOM-tab integration note.
- [x] Run `npm run lint` and `npm run build`; capture BOM tab screenshot evidence if app runtime allows.

## Verification Checklist
- [x] `npm run lint`
- [!] `npm run build` (fails in current repo baseline: missing `openai` package for pre-existing `src/app/api/print-analyzer/analyze/route.ts` import)
- [!] Manual/browser verification: UI screenshot captured, but auth/data constraints in this environment prevented drilling into a real order part with BOM tab active.

## Review + Results
- Added `PartBomTab` as a native order-part tab panel using existing app cards/tables/badges and analyzer endpoint integration.
- Added deterministic BOM helper logic for unit conversion display, thread-pitch parsing (metric + imperial), and tight-tolerance flagging with fit-based heuristics.
- Integrated `bom` into part tabs in order detail without modifying existing tab workflows.
- Updated Print Analyzer docs with an order-detail BOM integration note.
- Screenshot evidence captured in dev mode: `browser:/tmp/codex_browser_invocations/bec823ec399c834f/artifacts/artifacts/bom-tab-testmode-orders.png`.

---

# tasks/todo.md — Session Plan + Verification

## Session Metadata
- Date: 2026-02-25
- Agent: GPT-5.2-Codex
- Task ID: Unplanned feature build (sealed Print Analyzer page + API)
- Goal: Add a fully isolated `/private/print-analyzer` feature with upload UI, OpenAI vision API analysis, validated JSON contract, tap-drill enrichment, and scoped styling only.

## Dependency Validation
- [x] Reviewed `docs/AGENT_CONTEXT.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, and `docs/AGENT_TASK_BOARD.md` before implementation.
- [x] Validated scope constraints: new route only, no global style or existing-route changes, isolated feature files.
- [x] Applied relevant lesson: plan first for cross-file feature work and keep verification evidence explicit.

## Plan First
- [x] Create isolated UI route at `src/app/private/print-analyzer/page.tsx` with local CSS module and no shared global styling edits.
- [x] Create `POST /api/print-analyzer/analyze` Node route using server-side OpenAI Responses API vision analysis + zod validation + safe error handling.
- [x] Add print analyzer helper libs (`schema.ts`, `tapDrills.ts`, `normalize.ts`) and wire tap-drill enrichment.
- [x] Add/update docs (`docs/PRINT_ANALYZER.md`, `.env.example`) and decision log continuity if dependency added.
- [x] Run lint/build checks, manually validate route behavior, capture screenshot evidence, and update continuity logs/handoff.

## Verification Checklist
- [x] `npm run lint`
- [x] `npm run build`
- [x] Manual run: load `/private/print-analyzer`, upload image, analyze success + error states
- [!] Browser screenshot captured for Print Analyzer UI (attempted; browser tool crashed with Chromium SIGSEGV in this environment)

## Review + Results
- Added a sealed `/private/print-analyzer` client page with isolated CSS module, upload preview, analyze action, table rendering for all required sections, warning list, and collapsible raw JSON viewer.
- Added `POST /api/print-analyzer/analyze` Node runtime route with request validation, OpenAI Responses vision call, forced JSON-object output, zod validation, capped raw model text in schema-failure responses, and tap-drill enrichment.
- Added print-analyzer helper libs (`schema.ts`, `normalize.ts`, `tapDrills.ts`) and documentation (`docs/PRINT_ANALYZER.md`) plus `.env.example` OpenAI key entry.
- Verification: lint + build passed; manual route/API checks passed for page load, invalid input handling (400), and missing-key error handling (500).
- Screenshot attempt performed but browser-tool Chromium crashed (SIGSEGV), so no artifact available this session.

---

# tasks/todo.md — Session Plan + Verification

## Session Metadata
- Date: 2026-02-25
- Agent: GPT-5.2-Codex
- Task ID: Unplanned dashboard follow-up (restore Fab/Shipping in department touch visibility)
- Goal: Fix department-touch counting so dashboard grid reflects real departments touched, including Fab/Shipping paths.

## Dependency Validation
- [x] Reviewed `docs/AGENT_CONTEXT.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, and `docs/AGENT_TASK_BOARD.md` before implementation.
- [x] Validated prior dashboard task and identified follow-up gap: touch counter used fields not present in list query payload.
- [x] Applied relevant lesson: keep fix scoped and validate data wiring end-to-end (repo select -> type -> UI).

## Plan First
- [x] Update orders list query select to expose department identifiers needed for dashboard touch counting.
- [x] Update order list types and grid touch counting logic to include checklist and part department sources.
- [x] Run lint and record verification evidence.
- [x] Update continuity artifacts with root cause + fix details.

## Verification Checklist
- [x] `npm run lint`

## Review + Results
- Root cause confirmed: dashboard touch counter relied on checklist `departmentId`, but the order-list query feeding Dashboard did not select `departmentId` (or part current department IDs), so touched counts under-reported and missed Fab/Shipping routing context.
- Updated order list/dashboard query selects to include checklist `departmentId` and part `currentDepartmentId`.
- Updated dashboard grid touch counter to combine both checklist and part department sources so Fab/Shipping transitions are represented again.

---

# tasks/todo.md — Session Plan + Verification

## Session Metadata
- Date: 2026-02-25
- Agent: GPT-5.2-Codex
- Task ID: Unplanned dashboard UX cleanup (remove Ready for fab + add department touch count)
- Goal: Remove the Ready for fab layout option from Dashboard and show per-order department-touch counts on Grid digest tiles.

## Dependency Validation
- [x] Reviewed `docs/AGENT_CONTEXT.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, and `docs/AGENT_TASK_BOARD.md` before implementation.
- [x] No dependency blockers found for this scoped dashboard UI update.
- [x] Applied relevant lesson: keep changes minimal and verify requested visual surfaces with screenshot evidence.

## Plan First
- [x] Remove the `Ready for fab` layout toggle and dead-path rendering from `ShopFloorLayouts`.
- [x] Add a department-touch metric in Grid digest tiles (count distinct departments represented on each order).
- [x] Run lint and capture an updated Dashboard screenshot artifact.
- [x] Update continuity artifacts with commands and verification evidence.

## Verification Checklist
- [x] `npm run lint`
- [x] Browser screenshot captured for updated Dashboard controls and digest tiles

## Review + Results
- Removed the `Ready for fab` layout toggle and corresponding handoff render path from Dashboard layout controls.
- Added a `Departments` metric to Grid digest tiles that counts distinct department IDs present on each order checklist.
- Captured updated Dashboard screenshot artifact: `browser:/tmp/codex_browser_invocations/692d07767d918caa/artifacts/artifacts/dashboard-readyfab-removed.png`.

---

# tasks/todo.md — Session Plan + Verification

## Session Metadata
- Date: 2026-02-25
- Agent: GPT-5.2-Codex
- Task ID: Unplanned bugfix (timer elapsed reset + Department queue wrapper transparency)
- Goal: Ensure active timer display starts from zero for new active intervals and make Department Work Queue wrapper background transparent.

## Dependency Validation
- [x] Reviewed `docs/AGENT_CONTEXT.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, and `docs/AGENT_TASK_BOARD.md` before implementation.
- [x] No dependency blockers found for this scoped follow-up fix.
- [x] Applied relevant lesson: verify all requested visual surfaces (border + background) for wrapper-style changes.

## Plan First
- [x] Locate timer elapsed calculation path and confirm why active timer display appears to start with pre-existing seconds.
- [x] Apply minimal elapsed-display fix so running timer shows active-entry elapsed time while preserving paused total context.
- [x] Remove Department Work Queue wrapper background fill (transparent wrapper).
- [x] Run lint and record continuity evidence.

## Verification Checklist
- [x] `npm run lint`

## Review + Results
- Updated order detail elapsed math to show only active-entry elapsed seconds while timer is actively running, preventing new runs from visually inheriting previously accumulated part totals.
- Updated Department Work Queue wrapper container styling to use a transparent background (`bg-transparent`).

---

# tasks/todo.md — Session Plan + Verification

## Session Metadata
- Date: 2026-02-25
- Agent: GPT-5.2-Codex
- Task ID: Follow-up UI polish (Dashboard border/buttons/admin New Order location)
- Goal: Remove Department Work Queue container border, remove homepage quick-action buttons, and relocate New Order access to Admin quotes actions.

## Dependency Validation
- [x] Reviewed `docs/AGENT_CONTEXT.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, and `docs/AGENT_TASK_BOARD.md` before implementation.
- [x] No dependency blockers found for this scoped follow-up UI change.
- [x] Applied relevant lesson: keep edits minimal and use approved file editing workflow.

## Plan First
- [x] Update `ShopFloorLayouts` to keep overall/tile borders but remove Department Work Queue section border wrapper.
- [x] Remove `New Order`/`Open dashboard` buttons from Dashboard hero and remove `New Order` from top nav.
- [x] Add `New order` action beside Admin Quotes `New quote` action.
- [x] Run lint and capture updated screenshot.
- [x] Update continuity docs with verification evidence.

## Verification Checklist
- [x] `npm run lint`
- [x] Browser screenshot captured for updated Dashboard layout

## Review + Results
- Removed the border around the Department Work Queue wrapper while keeping the parent Shop Floor Layout card border and work-order tile borders intact.
- Removed hero quick-action buttons from Dashboard and removed `New Order` from top nav to avoid duplicate entry points.
- Added `New order` action next to `New quote` in Admin Quotes so order creation is still available in the requested admin location.
- Captured updated screenshot artifact: `browser:/tmp/codex_browser_invocations/1beb2a2aeb55c846/artifacts/artifacts/dashboard-border-button-fix.png`.

---

# tasks/todo.md — Session Plan + Verification

## Session Metadata
- Date: 2026-02-25
- Agent: GPT-5.2-Codex
- Task ID: Unplanned nav cleanup (Dashboard naming + default work queue layout)
- Goal: Replace duplicate top-nav entries with a single Dashboard link and make Work Queue the default Dashboard layout.

## Dependency Validation
- [x] Reviewed `docs/AGENT_CONTEXT.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, and `docs/AGENT_TASK_BOARD.md` before implementation.
- [x] No dependency blockers found for this scoped UI/navigation cleanup.
- [x] Applied relevant lesson: keep edits minimal and use approved file editing workflow (no shell `apply_patch`).

## Plan First
- [x] Update primary nav links so `/` appears once as `Dashboard` and remove duplicate Queue/Shop Floor labels.
- [x] Make `workQueue` the default selection in `ShopFloorLayouts` for Dashboard entry.
- [x] Sweep nearby Dashboard-facing copy references that could conflict with the rename intent.
- [x] Run lint (and any focused checks needed) and capture a Dashboard screenshot artifact.
- [x] Update continuity docs with scope, commands, and verification evidence.

## Verification Checklist
- [x] `npm run lint`
- [x] Browser screenshot captured for Dashboard nav/layout state

## Review + Results
- Dashboard nav now has a single `/` entry labeled `Dashboard`; duplicate `Shop Floor Intelligence` and `Queue` items were removed.
- Dashboard page title/button copy was aligned to `Dashboard` naming to avoid stale queue-intelligence wording.
- `ShopFloorLayouts` now defaults to `workQueue`, so Dashboard lands directly on Work Queue layout.

---

# tasks/todo.md — Session Plan + Verification

## Session Metadata
- Date: 2026-02-24
- Agent: GPT-5.2-Codex
- Task ID: Unplanned timer reliability fix (start validation compatibility + resume FK handling)
- Goal: Prevent timer start 400s from missing `operation` payloads and make resume path gracefully handle FK violations.

## Dependency Validation
- [x] Reviewed `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, and `docs/AGENT_TASK_BOARD.md` before implementation.
- [x] No unresolved dependency blocker found for this scoped timer reliability fix.

## Plan First
- [x] Inspect timer start schema/route and resume service error handling to confirm failing paths.
- [x] Implement minimal server-side compatibility fix for missing `operation` and reuseable FK error handling.
- [x] Run focused verification (`time.service` tests + lint) and record evidence.
- [x] Update continuity artifacts (`PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, `docs/AGENT_TASK_BOARD.md`).

## Implementation Checklist
- [x] Made `TimeEntryStart.operation` optional with server default of `Part Work`.
- [x] Added FK error handling to `resumeTimeEntry` so resume failures return deterministic API errors instead of uncaught exceptions.
- [x] Updated FK message text to cover missing order/part/user linkage, not only stale session wording.

## Verification Checklist
- [x] `npm run test -- src/modules/time/__tests__/time.service.test.ts`
- [x] `npm run lint`

## Review + Results
- `/api/timer/start` now accepts older payloads without `operation` and defaults to `Part Work`, eliminating immediate 400 validation failures on that contract drift path.
- Resume flows now catch Prisma FK violations and return controlled service errors, preventing raw crash behavior when linked records are invalid/deleted.
- No dependency/package changes or unrelated refactors were introduced.

---

# tasks/todo.md — Session Plan + Verification

## Session Metadata
- Date: 2026-02-24
- Agent: GPT-5.2-Codex
- Task ID: Unplanned timer UX fix (resume paused part timer)
- Goal: Allow machinists to resume paused timer context for a part instead of always starting a fresh timer interaction.

## Dependency Validation
- [x] Reviewed `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, and `docs/AGENT_TASK_BOARD.md` before implementation.
- [x] No dependency blocker found for this scoped timer workflow improvement.

## Plan First
- [x] Verify current order detail timer interactions and existing resume service support.
- [x] Add `/api/timer/resume` route + active-summary payload data needed for resume selection.
- [x] Update order detail timer controls to show/use Resume when a paused entry exists for selected part.
- [x] Run focused verification and capture continuity evidence.

## Implementation Checklist
- [x] Backend timer resume route created with existing switch-confirmation semantics.
- [x] Timer active summary includes latest user entries by part for resume affordance.
- [x] Order detail timer UI resumes paused entries for selected part.

## Verification Checklist
- [x] npm run test -- src/modules/time/__tests__/time.service.test.ts
- [x] npm run lint

## Review + Results
- Added `/api/timer/resume` route so paused entries can be resumed from order detail with the same switch-confirmation response shape used by timer start conflicts.
- Extended `/api/timer/active` response with `lastPartEntries` so UI can determine whether selected part should show Resume vs Start.
- Updated order detail timer controls to route the primary action through resume when a paused selected-part entry exists; switch dialog now states it will activate selected work.
- Added service-level regression coverage proving pause → resume → pause retains total accumulated minutes for the part.

---

# tasks/todo.md — Session Plan + Verification

## Session Metadata
- Date: 2026-02-24
- Agent: GPT-5.2-Codex
- Task ID: Unplanned bugfix (timer start 400 validation)
- Goal: Fix order detail timer start request payload so `/api/timer/start` passes schema validation.

## Dependency Validation
- [x] Reviewed `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, and `docs/AGENT_TASK_BOARD.md` before implementation.
- [x] No dependency blocker found for this scoped bugfix.

## Plan First
- [x] Confirm the failing payload path and schema requirement.
- [x] Apply minimal UI payload fix without broad refactors.
- [x] Run focused verification and capture evidence.
- [x] Update continuity artifacts (`PROGRESS_LOG.md` and `docs/AGENT_HANDOFF.md`).

## Implementation Checklist
- [x] Added required `operation` field to the order detail timer start request body.

## Verification Checklist
- [x] `npm run lint`

## Review + Results
- Order detail timer start now sends `{ orderId, partId, operation: "Part Work" }`, matching `TimeEntryStart` validation and preventing the immediate 400 schema rejection path.

---

# tasks/todo.md — Session Plan + Verification

## Session Metadata
- Date: 2026-02-23
- Agent: GPT-5.2-Codex
- Task ID: Unplanned maintenance (README local install + timer start failure + order timer controls UI)
- Goal: Fix local install/docs friction, resolve timer start foreign-key failure mode, and clean up order timer control layout overlap.

## Dependency Validation
- [x] Reviewed dependency artifacts in `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, and `docs/AGENT_TASK_BOARD.md`.
- [x] No dependency blocker requiring pause before this maintenance scope.

## Plan First
- [x] Reproduce/inspect current install + seed behavior and timer start flow to identify root causes.
- [x] Implement targeted fixes:
  - README local install section cleanup and accurate commands.
  - Timer start error handling for stale-session/foreign-key failures.
  - View-order timer control layout update to prevent control overlap.
- [x] Run focused verification (lint/tests/build where relevant) and collect evidence.
- [x] Update continuity artifacts (`PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, and task board status note).

## Implementation Checklist
- [x] README installation instructions rewritten for clean local setup and seed expectations.
- [x] Timer service gracefully handles Prisma FK violations and returns actionable message.
- [x] Order view timer control layout no longer packs conflicting controls in narrow sidebar width.

## Verification Checklist
- [x] `npm run test -- src/modules/time/__tests__/time.service.test.ts`
- [x] `npm run lint`
- [x] `npm run build`
- [x] Playwright runtime screenshot capture of updated order timer controls.

## Review + Results
- Root-cause guardrail added for timer starts: Prisma `P2003` (foreign key) now maps to an actionable 409 error message instructing session refresh/re-login.
- Local install docs now include required password seeding for demo login reliability (`set-demo-passwords` / `demo:setup`).
- Timer controls no longer force a 3-column layout in the narrow order sidebar, preventing visual overlap/crowding.
- Verification evidence recorded in continuity docs; build/test/lint all passed (with non-blocking environment advisories).

---

# tasks/todo.md — Session Plan + Verification

## Session Metadata
- Date: 2026-02-24
- Agent: GPT-5.2-Codex
- Task ID: Unplanned feature (department auto-advance confirmation + rework reason/flag routing)
- Goal: Implement preview-confirm complete flow for last checklist item, central department recompute routing, and flagged reason logging for backward/manual moves.

## Dependency Validation
- [x] Reviewed `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, and `docs/AGENT_TASK_BOARD.md` before implementation.
- [x] No dependency blocker found; proceeded with scoped Orders-domain changes only.

## Plan First
- [x] Inspect checklist toggle, routing helpers, and department feed endpoints.
- [x] Add centralized routing recompute service + atomic complete-and-advance path.
- [x] Add preview endpoint and UI confirmation/reason prompts with no optimistic pre-check on last-item completion.
- [x] Update intelligence feed payload/filter behavior and surface rework flag badges.
- [x] Verify with lint/tests/build and record evidence.

## Implementation Checklist
- [x] Added `preview-complete` + `complete-and-advance` checklist endpoints for per-part items.
- [x] Implemented `recomputePartDepartment` service and reused `selectDepartmentForPart` as routing source of truth.
- [x] Enforced reason requirements for snap-back reopen + manual transitions, with flagged `PartEvent` meta.
- [x] Updated order detail checklist UI to preview last-item completion and gate mutation behind confirmation.
- [x] Added rework badge surfacing on part list cards and department feed part pills.

## Verification Checklist
- [x] `npm run lint`
- [x] `npm run test -- src/modules/orders/__tests__/department-routing.test.ts`
- [x] `npm run build`

## Review + Results
- Last checklist-item completion now requires confirmation before mutation; cancel keeps checkbox unchanged.
- Confirmed completions atomically mark checklist complete and recompute department in a transaction path.
- Reopen actions that move work backward now require reason and log flagged rework events.
- Department feed supports include-completed toggle and now carries per-part flag/reason metadata for badge display.

---

# tasks/todo.md — Session Plan + Verification

## Session Metadata
- Date: 2026-02-24
- Agent: GPT-5.2-Codex
- Task ID: Consolidated queue/intelligence + tx timeout + timer semantics
- Goal: Keep intelligence dashboard intact while integrating work queue layout, fix SQLite tx timeout pathing, merge /orders list into home, and correct timer semantics/persistence.

## Dependency Validation
- [x] Reviewed required continuity docs (`docs/AGENT_CONTEXT.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`) and task board artifacts.
- [x] Validated no unresolved blocker from prior dependency tasks before implementation.

## Plan First
- [x] Fix transaction plumbing (`tx` client propagation + timeout increase) in complete-and-advance path.
- [x] Deprecate `/orders` list via redirect and re-point queue navigation/actions to `/`.
- [x] Add Work Queue as an additional Shop Floor layout (tabs/toggle) without removing KPI + existing layouts.
- [x] Replace work queue tiles with customers-style reusable order cards.
- [x] Update timer totals to seconds + persistent selected-part elapsed UX + stop/finish semantics + completion gate.
- [x] Validate with lint/test/build and capture a browser screenshot artifact attempt.

## Verification Checklist
- [x] `npm run lint`
- [x] `npm run test`
- [x] `npm run build`
- [x] Browser tool attempted for screenshot capture (auth-gated route screenshot captured after login automation failed).

---

# tasks/todo.md — Session Plan + Verification

## Session Metadata
- Date: 2026-02-24
- Agent: GPT-5.2-Codex
- Task ID: Unplanned bugfix (AppNav duplicate key + timer false-active conflict UX)
- Goal: Remove duplicate React key warning in AppNav and harden timer start/resume conflict handling with actionable navigation context.

## Dependency Validation
- [x] Reviewed `docs/AGENT_CONTEXT.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, and `docs/AGENT_TASK_BOARD.md` before implementation.
- [x] No blocking dependency gaps identified for this scoped bugfix.

## Plan First
- [x] Inspect navigation link mapping and timer start/resume conflict flow.
- [x] Implement key uniqueness fix and conflict payload/UI improvements.
- [x] Run lint/tests and record evidence.
- [x] Update continuity docs (`PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`).

## Verification Checklist
- [x] `npm run lint`
- [x] `npm run test -- src/modules/time/__tests__/time.service.test.ts`
- [ ] `npm run build` (fails currently with prisma appSettings unique-constraint during prerender of /403 in this environment)
- [x] Browser screenshot captured for navigation/timer UI touchpoint.

## Review + Results
- AppNav now uses composite keys (`href+label`) so duplicate `'/'` links no longer trigger React key collisions.
- Timer conflict payloads now include `activeOrderHref`; order page conflict dialog surfaces a direct navigation link to the active timer context.
- When timer API returns 409 without switch-confirmation action, UI now shows a sync/refresh error instead of opening misleading conflict dialog.

---

# tasks/todo.md — Session Plan + Verification

## Session Metadata
- Date: 2026-02-24
- Agent: GPT-5.2-Codex
- Task ID: FK/auth modal/status-complete/seed-diversity/intelligence-card-style
- Goal: Apply minimal mechanical fixes for FK/auth failures, shared auth-required modal UX, part completion status badge logic, richer seed diversity, and home metric card styling parity.

## Dependency Validation
- [x] Reviewed `docs/AGENT_CONTEXT.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, and existing task board context before edits.
- [x] Scoped changes to requested files/flows only; no drive-by refactors.

## Plan First
- [x] Update test-mode auth session identity to ensure DB-backed user IDs for FK columns.
- [x] Add shared auth-required response/handler + global sign-in popup interception.
- [x] Update part status badge logic to show complete when all active checklist items are done.
- [x] Expand seed dataset diversity and lifecycle distribution.
- [x] Apply Customers card class styling to home intelligence metric cards.
- [x] Verify with prisma push/seed/lint/test/build + screenshot.

## Verification Checklist
- [x] `npm run prisma:push`
- [x] `npm run seed`
- [x] `npm run lint`
- [x] `npm run test`
- [ ] `npm run build` *(fails in current environment with existing Prisma P2002 on AppSettings.id during prerender of /about)*
- [x] Browser screenshot captured for home metric cards

## Review + Results
- Test mode now returns a real persisted DB `User.id`, preventing FK violations from placeholder IDs.
- Protected-action auth failures now trigger a shared sign-in dialog via centralized fetch interception.
- Part list status badge reflects checklist completion (`COMPLETE` when all active items are complete).
- Seed data now includes more customers/orders and mixed lifecycle stages for realistic demos.
- Home metric cards now visually match Customers card styling.
