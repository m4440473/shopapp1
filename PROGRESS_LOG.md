### 2026-04-08 — Quote view/invoice total carry-over fix
- Fixed quote detail total math to include basis-adjusted part pricing carry-over instead of relying on stale persisted total values.
- Added `Part pricing (basis-adjusted)` line in the admin quote Totals card so the review-step amount is visible in view quote.
- Fixed quote print/invoice totals to include basis-adjusted part pricing in both totals summary and grand total.

Commands run:
- npm run lint

Verification note:
- Lint passed with no ESLint warnings/errors.

### 2026-04-07 — Review-comment gate + admin quote discoverability + per-part pricing basis controls (quotes/orders)
- Added a Phase-0 review gate checklist in `tasks/todo.md` mapping each unresolved PR comment request to a concrete task/disposition before implementation.
- Restored quote discoverability in admin IA:
  - Added `View Quotes` to Admin NavTabs `Quote & Order Ops`.
  - Added `View Quotes` card link in Admin Center `Quote & Order Ops` section.
- Implemented quote review per-part pricing basis controls:
  - Added `pricingMode` (`PER_UNIT` | `LOT_TOTAL`) to quote input schema + metadata typing.
  - Added per-part review rows in Quote Editor with quantity, entered price, mode checkbox, and immediate lot-total recalculation.
  - Persisted `pricingMode` in quote metadata `partPricing` on create/edit and reloaded it in edit flow.
  - Added `Part pricing (basis-adjusted)` as a separate summary line item and included it in quote total estimate.
- Implemented equivalent `/orders/new` review basis controls:
  - Added per-part entered-price + mode checkbox controls with immediate estimate updates.
  - Explicitly documented order-side behavior as review-transient (not persisted in order create payload).
- Added new pricing helper + unit coverage:
  - `src/modules/pricing/part-pricing.ts`
  - `src/modules/pricing/__tests__/part-pricing.test.ts`
- Added Decision Log entry in `docs/AGENT_CONTEXT.md` codifying final estimate behavior (coexist line-item model).

Commands run:
- npm run lint
- npm run test -- src/modules/pricing/__tests__/part-pricing.test.ts
- npm run test -- src/modules/pricing/__tests__/work-item-pricing.test.ts

Verification note:
- Lint passed with no ESLint warnings/errors.
- Targeted pricing tests passed (part-pricing 2/2, work-item-pricing 3/3).

### 2026-04-07 — Order/Quote pricing parity: shared work-item contract + order review totals
- Added shared work-item pricing helpers in `src/modules/pricing/work-item-pricing.ts` to centralize checklist-vs-priced semantics and assignment/subtotal calculations.
- Updated Quote Editor and Order Create assigned-item metadata rendering to reuse the shared helper so “No charge (checklist only)” and `rate × units = total` logic now come from the same rules.
- Added missing Order Create review-step pricing summary card showing add-ons/labor subtotal and total estimate, explicitly excluding checklist-only items.
- Standardized quote add-on fetch source to `/api/orders/addons?active=true&take=100` so quote/order creation flows now consume the same role-aware endpoint.
- Added focused unit tests validating semantic classification and subtotal behavior for priced vs checklist-only items.

Commands run:
- npm run test -- src/modules/pricing/__tests__/work-item-pricing.test.ts
- npm run lint

Verification note:
- Targeted pricing tests passed (3/3).
- Lint passed with no ESLint warnings/errors.

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

### 2026-04-08 — Department flow rework: manual-only department moves + shipping-only manual completion
- Fully decoupled checklist toggles from department movement by removing automatic part-department recompute in checklist toggle flow.
- Reworked Order Detail action from auto-advance submit to explicit manual move prompt:
  - user must choose destination department ID,
  - user must provide a required move note,
  - request routes through manual assign-department API.
- Tightened manual transition validation to require `reasonText` (note) for both single-part assign and bulk transition APIs.
- Enforced manual completion gate in Orders service: part completion is allowed only when current department is Shipping (and existing checklist-complete guard passes).
- Added targeted test coverage for shipping-only completion gating.

Commands run:
- npm run test -- src/modules/orders/__tests__/orders.service.test.ts
- npm run lint

Verification note:
- Targeted Orders service tests passed (4/4).
- Lint passed with no ESLint warnings/errors.

### 2026-04-08 — Hotfix: restore `formatCurrency` in new-order review panel
- Fixed runtime `ReferenceError: formatCurrency is not defined` on `/orders/new` by restoring a local `formatCurrency` helper used by assigned-item review metadata and totals display in `src/app/orders/new/page.tsx`.
- Kept scope intentionally minimal (single-file hotfix, no behavior refactor).

Commands run:
- npm run lint

Verification note:
- Lint passed with no ESLint warnings/errors.

### 2026-04-08 — Post-PR stabilization: quote pricing-basis persistence/projection drift fixes + targeted regression tests
- Reconciled unresolved inline-review scope in `tasks/todo.md` before implementation and completed a pass/fail gap audit for admin discoverability, quote review basis, order review basis, and canonical math behavior.
- Fixed quote payload contract drift in `QuoteEditor` by persisting raw entered `partPricing.priceCents` alongside `pricingMode` (no lossy conversion to lot total at serialization time).
- Replaced quote part-pricing preload/index-only projection with identity-aware projection (`partNumber`/`name` match + index fallback) via `getPartPricingEntries`, preventing silent mismatches/drops when part order changes.
- Added focused tests:
  - pricing-mode toggle recalculation determinism (`src/modules/pricing/__tests__/part-pricing.test.ts`)
  - quote metadata round-trip and projection compatibility (`src/lib/__tests__/quote-part-pricing.test.ts`)
- Verified required commands pass (`npm run lint`, `npm run test`).

Commands run:
- gh pr view 153 --comments *(fails: `gh` not installed in environment)*
- npm run lint
- npm run test

Verification note:
- Lint passed with no ESLint warnings/errors.
- Full Vitest suite passed (15 files / 46 tests).

### 2026-04-07 — Regression fix: admin add-on/labor cost visibility + conversion route build guard
- Restored quote editor add-on library pricing visibility by including `rateCents` in `AvailableItemsLibrary` mapping payload.
- Added per-assignment pricing meta in order creation (`/orders/new`) so admins now see `rate × units = total` under assigned labor/add-on rows, including checklist-only no-charge messaging.
- Hardened quote->order prefill path to merge quote-selected add-on snapshots into local add-on options when those add-ons are inactive/missing from active add-on API results.
- Fixed quote conversion route build/type regression by replacing `Prisma.PrismaClientKnownRequestError` instance check with a code-based guard (`error?.code === 'P2002'`).

Commands run:
- npm run -s lint
- npm run -s build

Verification note:
- Lint passed with no ESLint warnings/errors.
- Build still fails due pre-existing mock repo type mismatch in `src/repos/index.ts` (missing `updateOrderAttachmentStoragePath` and `updatePartAttachmentStoragePath`).

### 2026-04-07 — Quote conversion checklist dedupe fix + actionable conversion errors + admin add-on pricing visibility
- Fixed quote→order conversion failure path caused by duplicate `OrderChecklist` create attempts on unique key `(orderId, addonId, partId)`.
- Updated Orders checklist sync logic to dedupe create candidates by checklist unique tuple (part+addon) in addition to charge linkage.
- Added explicit conversion-route error handling for Prisma `P2002` and generic failures so API returns JSON error messages instead of opaque 500 behavior.
- Improved order creation/conversion UI error parsing and styling so failed conversion/create operations surface a clear destructive message.
- Restored admin pricing visibility in the add-on drag/drop library by allowing `/api/orders/addons` to include `rateCents` for admins and rendering formatted prices in the library cards.
- Updated conversion route test mocks/assertions to include canonical order file sync helper call.

Commands run:
- npm run lint
- npm run test -- src/app/api/admin/quotes/[id]/convert/__tests__/route.test.ts

Verification note:
- Lint passed with no ESLint warnings/errors.
- Targeted convert-route tests passed (3/3).

### 2026-04-07 — Reliability follow-up: client-safe Orders constants/shared helpers + server-only guard
- Replaced hotfix-local status labels with a dedicated client-safe Orders constants module (`src/modules/orders/orders.constants.ts`) and moved reusable dashboard/filter helpers to `src/modules/orders/orders.shared.ts`.
- Added `import 'server-only';` at the top of `src/modules/orders/orders.service.ts` and re-exported constants/shared helpers from the service for server consumers.
- Removed all client-component imports from `orders.service.ts` by updating:
  - `src/components/RecentOrdersTable.tsx` -> `orders.constants`
  - `src/components/ShopFloorLayouts.tsx` -> `orders.shared` + `orders.types`
  - `src/components/work-queue/WorkQueueOrderCard.tsx` -> `orders.types`

Commands run:
- npm run lint
- npm run build

Verification note:
- Lint passed with no ESLint warnings/errors.
- Build failed at a pre-existing type mismatch in `src/repos/index.ts` (mock orders repo missing `updateOrderAttachmentStoragePath` and `updatePartAttachmentStoragePath`).

### 2026-04-07 — Hotfix: remove server-only orders import from client Recent Orders table
- Fixed dashboard/runtime 500 caused by webpack failing to bundle `node:crypto` into client code.
- Root cause: `src/components/RecentOrdersTable.tsx` (`"use client"`) imported `ORDER_STATUS_LABELS` from `src/modules/orders/orders.service.ts`, which transitively imports `src/lib/storage.ts` (`node:crypto`).
- Replaced that import with a local status-label map inside `RecentOrdersTable` to keep the client boundary free of server-only Node module imports.

Commands run:
- npm run lint

Verification note:
- Lint passed with no ESLint warnings/errors.

### 2026-04-07 — Admin Quote & Order Ops IA + admin Full Order Files + order edit mode + canonical order-number file continuity
- Renamed admin navigation grouping from `Quote Ops` to `Quote & Order Ops` and updated actions to `Create Order` + `Create Quote`; moved Templates entry into Business Settings card context on Admin Center.
- Added admin order-detail edit mode supporting broad order header edits (`customer`, `dates`, `priority`, `vendor`, `PO`, assignee, material/model flags) and selected-part editing (`part number`, `quantity`, `material`, stock/cut lengths, notes) with add/delete part actions.
- Added new admin-only order-detail tab: `Full Order Files`, aggregating order-level and part-level attachments into a single list with source labels and direct links.
- Added canonical order-file storage continuity helper in Orders service (`ensureOrderFilesInCanonicalStorage`) that copies order-owned attachments into `business/customer/orderNumber/` paths when needed and updates attachment records.
- Wired canonicalization to run after direct order creation and after quote→order conversion so uploaded files remain attached through conversion while ending up under order-number storage paths.

Commands run:
- npm run lint

Verification note:
- Lint passed with no ESLint warnings/errors.

### 2026-04-07 — Department-based timer starts + department history totals
- Added `departmentId` support on `TimeEntry` (Prisma schema + migration) so timers are now tied to departments.
- Updated timer domain/service/repo logic to enforce one active timer per user per department (while allowing concurrent active timers across different departments).
- Updated timer start APIs (`/api/timer/start` and `/api/time/start`) to require an explicit department and reject Shipping timers.
- Updated order detail timer UI to require a fresh department dropdown selection before every start action, pass `departmentId` to timer start, and target pause/stop actions by specific entry ID.
- Added selected-part timer history presentation grouped by department: summary total cards plus a detailed recent-entry area per department.
- Extended order details payload to include `timeEntries` with department and user context for history rendering.
- Updated mock repo/time tests to include department-aware timer behavior and coverage for per-department concurrency.

Commands run:
- npx prisma format
- npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --script > /tmp/time_dept_migration.sql
- npm run lint
- npm run test -- src/modules/time/__tests__/time.service.test.ts

Verification note:
- Prisma schema formatting succeeded.
- Lint passed with no ESLint warnings/errors.
- Targeted time service tests passed (6/6).

### 2026-04-07 — BOM analyzer persistence + corner-based tolerance extraction improvements
- Added persistent BOM analyzer storage via new `PartBomAnalysis` model/migration keyed by `(orderId, partId)` so latest analyzer output is retained and shareable across sessions/users for each part.
- Updated `POST /api/print-analyzer/analyze` to optionally accept `orderId`/`partId`, persist successful analyses, and run a four-corner zoom title-block tolerance extraction pass with stricter no-hallucination guidance.
- Added fallback warning behavior when general tolerances cannot be confidently read: `Unable to confidently read general tolerances. Please check the paper print.`
- Added `GET /api/orders/[id]/parts/[partId]/bom-analysis` for loading the latest saved analysis.
- Updated Order Detail BOM tab to auto-hydrate from saved analysis and surface save/load timestamp context.
- Updated imperial tap-drill mapping to include decimal inch diameters for letter drill outputs (plus mapped number/fraction drills) and added a focused unit test.

Commands run:
- npx prisma migrate deploy
- npx prisma generate
- npm run test -- src/lib/printAnalyzer/tapDrills.test.ts
- npm run lint

Verification note:
- Prisma migrations applied successfully and Prisma client regenerated.
- Targeted tap-drill unit test passed (1/1).
- Lint passed with no ESLint warnings/errors.


### 2026-04-07 — Account page sign-out control for user switching
- Added a visible `Sign out` button on the account password page so users can log out directly from Account.
- Wired sign-out to NextAuth client sign-out with callback to `/auth/signin`, supporting immediate login as a different user.

Commands run:
- npm run lint

Verification note:
- Lint passed with no ESLint warnings/errors.


### 2026-04-07 — Sign-in nav tab added + About page removed
- Updated global nav links so `About` no longer appears and unauthenticated users now see a dedicated `Sign In` tab in the main navigation (desktop + mobile).
- Preserved the existing top-right auth CTA button behavior (`Sign in` when signed out, `Account` when signed in).
- Removed the `/about` app route by deleting `src/app/about/page.tsx`.

Commands run:
- npm run lint

Verification note:
- Lint passed with no ESLint warnings/errors.


### 2026-04-07 — Explicit department submit flow + manual time adjustment tracking
- Replaced checklist auto-advance behavior in order detail with an explicit department submit workflow so checklist toggles only mark checklist state.
- Added new machinist route `POST /api/orders/[id]/parts/[partId]/submit-department-complete` and Orders service logic to block submission until all checklist items in the current department are complete.
- Added optional added-time capture on department submit (`additionalSeconds`) with required note when time is added.
- Added `PartTimeAdjustment` model + migration and wired order detail loading to include manual added-time entries for part-level display.
- Updated order detail UI checklist to render all active checklist items grouped by department heading.
- Added selected-part total-time presentation combining timer total + manual added time and listing manual adjustment notes.
- Added/updated focused Orders service tests for department submission gating and added-time note validation.

Commands run:
- npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/20260407120000_add_part_time_adjustments/migration.sql
- npx prisma migrate deploy
- npx prisma generate
- npm run lint
- npm run test -- src/modules/orders/__tests__/orders.service.test.ts
- npm run build

Verification note:
- Prisma migration deployed successfully and Prisma client regenerated.
- Lint passed with no ESLint warnings/errors.
- Targeted Orders service tests passed (3/3).
- Build failed in this environment due a pre-existing `sterling-site/vite.config.ts` TypeScript resolution issue for `@vitejs/plugin-react`.



### 2026-04-02 — Part-complete route restoration + order-detail status parity fix
- Added a new authenticated machinist route `POST /api/orders/[id]/parts/[partId]/complete` that calls `completeOrderPart`, restoring a reachable server path for manual part completion.
- Updated order detail timer/actions panel to include `Mark selected part complete`, wired to the new API route with refresh + toast handling.
- Removed the order-detail part-card UI-only checklist status override; part cards now display persisted `part.status`, eliminating premature `COMPLETE` badges before backend state changes.

Commands run:
- npm run lint

Verification note:
- Lint passed with no ESLint errors.


### 2026-03-23 — Standalone premium manufacturing marketing site scaffolded
- Added a new isolated `sterling-site/` subproject with its own `package.json`, Vite config, TypeScript config, and entrypoint so it can be run/deployed independently of the main Next.js app.
- Built a one-page scrolling marketing site for Sterling Tool & Die, C & R Machine and Fabrication, and Preferred Kustom Powder with a sticky nav, smooth section scrolling, responsive layouts, semantic sections, and premium industrial copy.
- Added a motion system combining an animated ambient mesh background, hero parallax movement, and reveal-on-scroll transitions to give the site a live modern feel without introducing extra animation libraries.
- Centralized editable site content in `sterling-site/src/siteContent.ts`, kept media easy to swap, and added `sterling-site/README.md` covering run/build/deploy/integration guidance.
- Installed the subproject's isolated dependencies locally and verified type-check, production build, and a direct-link HTTP smoke response from the Vite dev server.

Commands run:
- cd sterling-site && npm install
- cd sterling-site && npm run build
- cd sterling-site && npm run check
- cd sterling-site && npm run dev -- --host 127.0.0.1 --port 4173
- curl -I --max-time 15 http://127.0.0.1:4173/

Verification note:
- Standalone dependency install completed successfully.
- Production build passed and emitted static assets to `sterling-site/dist`.
- Type-check passed.
- Local Vite dev server responded `200 OK` for the direct-link root path.
- Browser screenshot capture was not possible because the required browser screenshot tool is unavailable in this environment.

### 2026-03-23 — Order workflow status simplification + admin override alignment
- Simplified manager-facing order statuses to the new workflow set: `RECEIVED`, `IN_PROGRESS`, `COMPLETE`, and `CLOSED`.
- Added workflow-status normalization/rollup helpers in Orders service so legacy statuses collapse into the new set for dashboard/search display and future filtering.
- Added order-status auto-sync after part progress signals (checklist completion/toggle, timer start/resume/finish, manual department moves, charge/part mutations, and manual part completion) while preserving `CLOSED` as the terminal admin state.
- Updated department-routing persistence so part status stays aligned with department state (`IN_PROGRESS` when routed into work, `COMPLETE` when the part is done).
- Replaced the old order-status API behavior with an admin-only manual status override flow that requires a reason and records status-history audit text using the signed-in admin identity.
- Added an admin order-status editor to the order detail header with explicit override guidance, and updated dashboard/search/filter surfaces to use the simplified status set.
- Updated seed/mock data to emit the simplified status set and added focused order workflow status helper coverage.
- Applied a small build-compatibility fix in `src/modules/quotes/quotes.repo.ts` by loosening a stale `Prisma.TransactionClient` annotation to `any` so type-check/build can complete in this dependency baseline.

Commands run:
- npm run lint
- npm run test -- src/modules/orders/__tests__/department-routing.test.ts src/modules/orders/__tests__/orders.service.test.ts src/modules/orders/__tests__/orders.status.test.ts
- npm run build
- npx tsc --noEmit

Verification note:
- Lint passed with no ESLint warnings/errors.
- Targeted Orders Vitest coverage passed (10/10 tests).
- Production build passed and standalone assets were copied successfully.
- Browser screenshot capture was not performed because the required browser screenshot tool is unavailable in this environment.

### 2026-03-19 — Order-create Prisma fix + sign-in visibility + LAN auth fallback
- Fixed the reported order-create failure by restoring missing `OrderPart.createdAt` / `updatedAt` fields in Prisma schema and shipping a SQLite-safe migration (`20260319120000_add_order_part_timestamps`); this makes the existing nested `parts.orderBy.createdAt` selection valid again.
- Regenerated Prisma Client, applied the migration locally, and verified `PRAGMA table_info("OrderPart")` now shows both timestamp columns.
- Added shared `src/lib/base-url.ts` and routed auth redirect + sign-out base-URL resolution through it so LAN requests can prefer the incoming request origin when env URLs still point to loopback.
- Made `/about` publicly accessible, added it to the main nav, and preserved explicit sign-in/dashboard CTAs so unauthenticated users now have a visible place to click into auth.
- Hardened `getAppSettings()` from `findUnique()+create()` to `upsert()` after runtime verification exposed a singleton race causing `/about` to 500 on a fresh DB.
- Added README LAN instructions covering `npm run dev -- --hostname 0.0.0.0 --port 3000` and the required `.env` base URL values for IP-based access.

Commands run:
- npm run prisma:generate
- npx prisma migrate deploy
- node - <<'JS' ... PRAGMA table_info("OrderPart") ... JS
- npm run lint
- npm run test -- src/lib/auth-redirect.test.ts src/lib/base-url.test.ts
- npm run dev -- --hostname 0.0.0.0 --port 3000
- curl -I --max-time 20 http://127.0.0.1:3000/about
- curl -I --max-time 20 'http://127.0.0.1:3000/auth/signin?callbackUrl=%2F'
- curl -I --max-time 20 http://127.0.0.1:3000/

Verification note:
- Prisma client generation passed.
- Migration applied successfully after converting the new timestamp migration to SQLite table redefinition.
- Targeted tests passed (7/7).
- Lint passed.
- Runtime smoke checks returned `200` for `/about`, `200` for `/auth/signin?callbackUrl=%2F`, and `307` redirect from `/` to sign-in when unauthenticated.
- Browser screenshot capture was skipped because the required browser screenshot tool was unavailable in this environment.


### 2026-02-26 — Admin IA cleanup + installer with basic/demo seed modes
- Replaced `/admin` redirect behavior with a dedicated Admin Center landing page that groups controls into clear sections (People, Catalog, Quote Ops, Settings) and links directly into each admin area.
- Reworked `NavTabs` into grouped, icon-based rows with a wrapped layout, making admin navigation easier to scan now that the UI styling is cleaner.
- Updated global app nav admin link target from `/admin/users` to `/admin` so users always land on the new control-center overview first.
- Added `prisma/seed-basic.js` as a functionality-only seed profile and split package scripts into `seed:basic` and `seed:demo` (`seed` defaults to demo profile).
- Added `scripts/install.sh` one-script installer supporting `--target local|docker` and `--seed basic|demo`, plus updated README and Docker compose defaults for local portability via named volumes.
- Captured visual verification screenshot of the new admin landing page after authenticated sign-in.

Commands run:
- npm run lint
- npx prisma migrate deploy
- npm run seed:basic
- npm run seed:demo
- npm run set-demo-passwords
- bash scripts/install.sh --help
- npm run dev -- --hostname 0.0.0.0 --port 3000
- Playwright screenshot script against `/auth/signin` and `/admin`

Verification note:
- Lint passed.
- Prisma migrations applied successfully on local SQLite.
- Both seed modes executed successfully.
- Installer CLI help/argument wiring verified.
- Screenshot artifact: `browser:/tmp/codex_browser_invocations/2e98785689018ddb/artifacts/artifacts/admin-center.png`.


### 2026-02-26 — BOM analyzer fix: part attachment retrieval now resolved
- Implemented the runtime fix for BOM attachment retrieval failures.
- Updated public attachment route (`/attachments/[...path]`) to query `PartAttachment` by `storagePath` when quote/order attachment records are not found.
- This aligns serving behavior with how Order Part Notes & Files uploads are persisted (`PartAttachment`), so BOM tab can fetch selected files before analyzer API call.
- Kept existing restricted-label and auth visibility checks intact.
- Added a lessons entry after user correction about tool usage expectations.

Commands run:
- npm run lint

Verification note:
- Lint passed with no ESLint warnings/errors.


### 2026-02-26 — BOM tab image-analysis failure investigation (diagnosis only)
- Investigated the BOM tab runtime error: `Failed to analyze image: Failed to load selected image attachment.`
- Traced client flow in `PartBomTab`: selecting a Notes & Files item causes fetch to `/attachments/${storagePath}`; any non-OK response throws `Failed to load selected image attachment.`
- Traced server attachment route and confirmed lookup gap: it resolves storage paths against `QuoteAttachment` and legacy order-level `Attachment`, but not `PartAttachment`.
- Root cause: part uploads are stored in `PartAttachment`, so retrieval for BOM analysis (and any part-file open link using `/attachments/...`) fails with 404 despite successful upload metadata.
- No code fix applied in this session (user requested diagnosis only).

Commands run:
- rg -n "Failed to load selected image attachment|/attachments/|storagePath" src/app src/lib prisma -g '*.ts*'
- sed -n '1,220p' src/app/orders/[id]/PartBomTab.tsx
- sed -n '1,220p' 'src/app/(public)/attachments/[...path]/route.ts'
- sed -n '180,340p' prisma/schema.prisma

Verification note:
- Static code-path evidence is internally consistent with the reported behavior across existing files and newly uploaded files in BOM tab.


### 2026-02-26 — Part BOM analyzer attachment fix + quote→order conversion audit
- Fixed Part BOM analyzer attachment ingestion when selecting files from Part `Notes & Files`.
- Root cause: analyzer source list included PRINT attachments with explicit non-image MIME values, and selected-file MIME logic used non-image blob MIME values that violate `/api/print-analyzer/analyze` image payload requirements.
- Updated `PartBomTab` to:
  - Exclude explicit non-image MIME attachments from analyzer options.
  - Prefer known image MIME hints (attachment metadata first, then blob MIME) and throw a clear UI error when selected content is not an image.
- Audited quote→order conversion code path (`src/app/api/admin/quotes/[id]/convert/route.ts` + `src/modules/quotes/quotes.repo.ts` transaction): confirmed existing flow still performs order creation, parts creation, attachment copy, checklist/charge carry-over, and quote conversion metadata stamp as designed.

Commands run:
- npm run lint
- npm run dev -- --hostname 0.0.0.0 --port 3000
- Playwright screenshot script against http://127.0.0.1:3000/

Verification note:
- Lint passed.
- Runtime smoke check passed (app booted; redirected to sign-in as expected for unauthenticated root route).
- Screenshot captured: `browser:/tmp/codex_browser_invocations/a282bb14452d16f9/artifacts/artifacts/bom-tab-update.png`.


### 2026-02-26 — Order-detail BOM/file workflow, nav cleanup, and sign-in-first routing
- Updated Order Detail part tabs so `BOM` is directly adjacent to `Notes & Files` and added a dedicated Files & print-drawings guidance block that tells users to tag analyzer source files as `PRINT`.
- Expanded part attachment kinds to include `PRINT`; BOM tab now reads Notes & Files image attachments, prioritizes PRINT-tagged files first, and labels them in the source picker.
- Updated quote creation attachments UI with an explicit analyzer-role checkbox (`Use as print image for BOM analyzer`) that persists as a `[PRINT]` label tag for downstream workflows.
- Removed `Overview` from top navigation without deleting the page.
- Enforced sign-in-first behavior for `/about`: unauthenticated users now redirect to `/auth/signin` with dashboard callback.
- Updated print-analyzer prompts to explicitly extract lower-right title-block decimal tolerance rows (`.X`, `.XX`, `.XXX` with +/- values).

Commands run:
- npm run lint
- npm run test -- src/lib/auth-redirect.test.ts
- npm run dev
- Browser Playwright screenshot scripts against `/auth/signin`, `/`, `/about`, and `/orders/...`

Verification note:
- Lint passed.
- Focused auth redirect tests passed.
- Browser screenshots were captured as requested, but runtime currently returns Next.js 500 error shell on these routes in this environment; artifacts still recorded for evidence.

### 2026-02-25 — New sealed Print Analyzer page + API feature
- Added isolated private route UI at `/private/print-analyzer` with local CSS module only, file upload + preview, analyze action, loading/error handling, and structured result rendering sections (units, general tolerances, holes, radii, tapped holes with recommended tap drill, warnings, raw JSON details).
- Added `POST /api/print-analyzer/analyze` Node route with strict input validation (`data:image/...`), OpenAI Responses API vision call, JSON-only response format instruction, zod contract validation, tap-drill enrichment, and capped raw-model debug payload in 502 schema-failure cases.
- Added feature helpers under `src/lib/printAnalyzer/`: schema contract typing, whitespace/number normalization utilities, and normalized thread/tap-drill mapping attachment.
- Added feature documentation (`docs/PRINT_ANALYZER.md`) and `.env.example` key guidance (`OPENAI_API_KEY`).
- Added Decision Log entry for the new `openai` dependency.

Commands run:
- npm install openai@^6.25.0
- npm run lint
- npm run build
- npm run dev -- --hostname 0.0.0.0 --port 3000
- curl -s -o /tmp/pa_invalid.json -w '%{http_code}' -X POST http://127.0.0.1:3000/api/print-analyzer/analyze -H 'Content-Type: application/json' -d '{"foo":"bar"}'
- curl -s -o /tmp/pa_valid.json -w '%{http_code}' -X POST http://127.0.0.1:3000/api/print-analyzer/analyze -H 'Content-Type: application/json' -d '{"dataUrl":"data:image/png;base64,..."}'
- curl -s -o /tmp/pa_page.html -w '%{http_code}' http://127.0.0.1:3000/private/print-analyzer
- Browser tool Playwright screenshot attempts against http://127.0.0.1:3000/private/print-analyzer

Verification note:
- Lint passed with no ESLint warnings/errors.
- Build passed successfully.
- Manual runtime checks passed for page accessibility and API error handling (400 invalid payload, 500 missing OpenAI key).
- Screenshot capture was attempted but failed due browser-tool Chromium SIGSEGV crash in this environment (no artifact produced).

### 2026-02-25 — Dashboard follow-up fix: restore Fab/Shipping department visibility in touch counts
- Investigated follow-up feedback and confirmed root cause: Dashboard grid `Departments` metric used checklist `departmentId`, but the dashboard order query payload did not include checklist department IDs; it also lacked part `currentDepartmentId`, so Fab/Shipping routing context was not reflected.
- Updated orders repo selections used by Dashboard to include:
  - `checklist.departmentId`
  - `parts.currentDepartmentId`
- Updated dashboard `departmentTouchesByOrder` logic to union department IDs from both checklist entries and parts’ current department IDs.

Commands run:
- npm run lint
- TEST_MODE=true npm run dev -- --hostname 0.0.0.0 --port 3000
- Playwright screenshot attempt against http://127.0.0.1:3000

Verification note:
- Lint passed with no ESLint warnings/errors.
- Browser screenshot attempt failed due environment/runtime issues (`chromium` SIGSEGV in browser tool and local TEST_MODE runtime DB open-file error), so no new artifact captured this session.


### 2026-02-25 — Dashboard cleanup: remove Ready for fab + show department touch count
- Updated `ShopFloorLayouts` on Dashboard to remove the `Ready for fab` layout option and its associated render branch so only Grid digest, By machinist, and Work queue remain.
- Added a new Grid digest tile metric (`Departments`) that shows how many distinct departments each order touches, based on checklist department IDs.
- Captured an updated Dashboard screenshot artifact to verify the control/tile changes.

Commands run:
- npm run lint
- TEST_MODE=true npm run dev -- --hostname 0.0.0.0 --port 3000
- Playwright screenshot capture against http://127.0.0.1:3000

Verification note:
- Lint passed with no ESLint warnings/errors.
- Screenshot artifact captured: `browser:/tmp/codex_browser_invocations/692d07767d918caa/artifacts/artifacts/dashboard-readyfab-removed.png`.


### 2026-02-25 — Timer elapsed display reset + Department queue transparency follow-up
- Implemented a scoped follow-up fix for two reported UI issues:
  - Timer display on order detail now shows active-entry elapsed seconds while running (instead of adding prior accumulated total during active run), preventing the visual “starts around 40s” behavior when beginning a fresh interval.
  - Department Work Queue wrapper background was changed to transparent to match the previous border-removal intent.
- No dependency/package changes or broader refactors were introduced.

Commands run:
- npm run lint
- TEST_MODE=true npm run dev -- --hostname 0.0.0.0 --port 3000
- Playwright screenshot capture against http://127.0.0.1:3000 (firefox engine)

Verification note:
- Lint passed with no ESLint warnings/errors.
- Screenshot artifact captured: `browser:/tmp/codex_browser_invocations/329e7c491ac33201/artifacts/artifacts/dashboard-workqueue-transparent-bg.png`.


### 2026-02-25 — Dashboard follow-up: border cleanup + button relocation
- Updated Dashboard visual hierarchy per feedback:
  - Kept border on the overall `Shop floor layouts` container.
  - Kept borders on work-order tiles.
  - Removed border only from the `Department work queue` wrapper section.
- Removed Dashboard hero quick-action buttons (`New Order`, `Open dashboard`).
- Removed `New Order` from global top nav and moved that action to Admin Quotes controls beside `New quote`.
- Captured an updated Dashboard screenshot artifact for verification.

Commands run:
- npm run lint
- TEST_MODE=true npm run dev -- --hostname 0.0.0.0 --port 3000
- Playwright screenshot capture against http://127.0.0.1:3000 (firefox engine)

Verification note:
- Lint passed with no ESLint warnings/errors.
- Screenshot artifact captured: `browser:/tmp/codex_browser_invocations/1beb2a2aeb55c846/artifacts/artifacts/dashboard-border-button-fix.png`.


### 2026-02-25 — Dashboard nav consolidation + default Work Queue layout
- Consolidated top navigation at `/` to a single `Dashboard` item by removing duplicate `Shop Floor Intelligence` and `Queue` entries.
- Set `ShopFloorLayouts` default layout state to `workQueue` so landing on Dashboard opens directly to the Work Queue layout.
- Aligned homepage hero/action copy to `Dashboard` naming (`Dashboard`, `Open dashboard`, `View dashboard`) to reduce stale label drift.
- Captured updated Dashboard UI screenshot in TEST_MODE for visual verification.

Commands run:
- npm run lint
- TEST_MODE=true npm run dev -- --hostname 0.0.0.0 --port 3000
- Playwright screenshot capture against http://127.0.0.1:3000

Verification note:
- Lint passed with no ESLint warnings/errors.
- Screenshot artifact captured: `browser:/tmp/codex_browser_invocations/5b2f1381157b8568/artifacts/artifacts/dashboard-nav-workqueue.png`.


### 2026-02-24 — Timer start compatibility + resume FK reliability
- Implemented a scoped timer reliability fix for two reported failures:
  - Made `TimeEntryStart.operation` optional with a default (`Part Work`) so `/api/timer/start` no longer rejects payloads that omit operation.
  - Added Prisma FK (`P2003`) handling to `resumeTimeEntry` so pause/resume failures return deterministic service errors instead of uncaught exceptions.
- Updated FK user-facing error message to cover missing linked order/part/user records and include refresh/re-login guidance.
- No broad refactors or dependency changes were made.

Commands run:
- npm run test -- src/modules/time/__tests__/time.service.test.ts
- npm run lint

Verification note:
- Time service tests passed (6/6).
- Lint passed with no ESLint warnings/errors.


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

## 2026-02-24
- Summary: Consolidated intelligence + orders queue behavior, fixed interactive Prisma transaction usage/timeouts, upgraded department work-queue layout/cards, and corrected timer stop/elapsed semantics.
- Scope highlights:
  - Ensured part-event writes in department recompute/complete-and-advance can run on the same transaction client and raised interactive transaction timeout/wait to 20s for SQLite contention resilience.
  - Deprecated `/orders` list route via redirect to `/`; updated intelligence/nav actions to treat home as the canonical queue page.
  - Preserved KPI/header/layout brain and added Work Queue as an additional layout with department tabs and include-completed toggle.
  - Replaced work queue tiles with a reusable customers-style card (`WorkQueueOrderCard`) including order metrics + per-part rows + REWORK surfacing.
  - Changed timer totals to seconds (`totalsSeconds`), made selected-part elapsed persistent across pause/resume, and removed implicit part completion from timer finish.
  - Added checklist gating in `completeOrderPart` returning 409 when active checklist items remain.
- Tests run:
  - `npm run lint`
  - `npm run test`
  - `npm run build`
- Notes:
  - Browser automation login selector path failed in this environment; captured auth-gate screenshot artifact instead.

## 2026-02-24
- Summary: Fixed AppNav duplicate-key warning for root links and improved timer conflict handling by adding active-context links plus out-of-sync 409 handling that no longer shows a false active-timer dialog.
- Tests run:
  - `npm run lint`
  - `npm run test -- src/modules/time/__tests__/time.service.test.ts`
  - `npm run build` *(fails in this environment: Prisma P2002 on appSettings.id while prerendering /403)*
  - Browser screenshot: `browser:/tmp/codex_browser_invocations/0002efd80d6b7b20/artifacts/artifacts/nav-timer-fix-home.png`

## 2026-02-24
- Summary: Fixed test-mode FK failures by DB-backing session user IDs, added shared auth-required sign-in modal interception, updated part status badge completion logic, diversified seed data/stages, and aligned home metric card styling with Customers cards.
- Scope highlights:
  - `getServerAuthSession()` now upserts/uses a real `User` row for TEST MODE (`test@local`) so FK writes (e.g., `TimeEntry.userId`, `OrderChecklist.toggledById`) use valid IDs.
  - Added shared auth-required event + fetch interception and a global sign-in dialog for 401/403 or `AUTH_REQUIRED` payloads.
  - Updated timer start + checklist complete-and-advance endpoints to return structured auth payloads for client interception.
  - Part cards on order detail now show `COMPLETE` when all active checklist items for that part are complete.
  - Expanded seed fixtures with additional customers/orders/parts and lifecycle-stage spread (new, in-progress, completed) plus varied checklist completion states.
  - Applied Customers-style card classes to Shop Floor Intelligence metric cards.
- Tests run:
  - `npm run prisma:push`
  - `npm run seed`
  - `npm run lint`
  - `npm run test`
  - `npm run build` *(fails in this environment with existing Prisma P2002 on AppSettings.id while prerendering /about)*
  - `node -e '...groupBy...'` seed distribution check
  - Browser screenshot: `browser:/tmp/codex_browser_invocations/f0d023415cbf5e1d/artifacts/artifacts/home-metric-cards.png`

## 2026-02-25
- Summary: Integrated the existing Print Analyzer into Order → Part detail as a new BOM tab with native dark-theme card/table styling and no schema/global-style changes.
- Scope highlights:
  - Added `src/app/orders/[id]/PartBomTab.tsx` client component for BOM upload/select image, analyzer request handling (`POST /api/print-analyzer/analyze`), inline loading/errors, and structured result rendering.
  - Added deterministic UI helpers for mm↔inch conversion/formatting, thread pitch parsing (`M..x..` + imperial TPI), and tight-tolerance/re-ream suggestion flags.
  - Wired `bom` into `PART_TABS` and tab panel rendering in order detail while preserving existing Overview/Notes/Checklist/Log behavior.
  - Updated `docs/PRINT_ANALYZER.md` with BOM tab integration note.
- Tests run:
  - `npm run lint`
  - `npm run build` *(fails in current baseline because pre-existing analyzer API route imports `openai` but package is missing in this environment)*
- Verification notes:
  - Browser screenshot captured in dev mode, but environment auth/data constraints prevented navigating to a concrete order part instance with BOM panel visible.

## 2026-02-26
- Summary: Completed a QA-focused workflow audit on quote/admin/backend flows and added route-level regression tests for quote conversion + approval guards.
- Scope highlights:
  - Mapped implemented process transitions for quote create/approval/print-data/conversion, custom field filtering, and department transition APIs using source-of-truth code.
  - Added `vitest` route tests for `/api/admin/quotes/[id]/convert` and `/api/admin/quotes/[id]/approval` covering already-converted conflict, PO-required conversion gate, and custom-field allowlisting.
  - Executed runtime API flow checks in `TEST_MODE` for quote creation/conversion, department assignment/transition (including reason-required guard), and timer lifecycle endpoints.
- Tests/checks run:
  - `npm run test -- src/app/api/admin/quotes/[id]/convert/__tests__/route.test.ts src/app/api/admin/quotes/[id]/approval/__tests__/route.test.ts`
  - `npm run test`
  - `TEST_MODE=true npm run dev -- --hostname 0.0.0.0 --port 3000`
  - Python/curl API flow exercises against local dev server.
- Bugs found (logged for follow-up):
  - Duplicate order numbers possible during quote conversion because order number generation is not transactionally reserved and `Order.orderNumber` lacks uniqueness.
  - In `TEST_MODE`, quote conversion writes to Prisma DB while orders/time APIs read from isolated mock repos, producing inconsistent runtime behavior.
  - In `TEST_MODE`, timer `start` can return success but `active/pause/finish` report no active timer due to user-id mismatch between auth-session (Prisma user id) and mock seeded repo user ids.

## 2026-02-26
- Summary: Implemented follow-up fixes for QA-discovered backend flow defects (quote conversion numbering + TEST_MODE consistency).
- Scope highlights:
  - Moved quote→order `orderNumber` generation into the conversion transaction (`convertQuoteToOrder`) so order IDs are allocated atomically at write time.
  - Added Prisma schema uniqueness guard on `Order.orderNumber`.
  - Updated repo selection logic so TEST_MODE uses Prisma repos by default; mock repos are now opt-in via `TEST_MODE_USE_MOCK_REPOS=true`.
  - Added Vitest setup env file to keep existing unit tests on mock repos.
- Tests/checks run:
  - `npm run test`
  - `TEST_MODE=true npm run dev -- --hostname 0.0.0.0 --port 3000`
  - Runtime API verification script (quote create/convert → order fetch, timer start/active/pause).
- Runtime verification notes:
  - Converted orders are now visible through `/api/orders/{id}` in TEST_MODE dev.
  - Timer `start` now aligns with `active` and `pause` behavior in TEST_MODE dev.
