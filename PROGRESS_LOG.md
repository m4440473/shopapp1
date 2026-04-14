### 2026-04-14 - Quotes now support origin department, per-foot add-ons, and custom quote amounts
- Updated quote workflow contracts and UI so admins can:
  - assign an optional quote origin/default department,
  - use `PER_FOOT` add-on pricing alongside `HOURLY` and `FLAT`,
  - add titled custom quote amounts in review.
- Updated shared pricing helpers and shared item components so rate/unit labeling now consistently reflects:
  - hours for hourly,
  - feet for per-foot,
  - quantity for flat-rate items.
- Updated quote persistence so origin department and custom amounts are stored in quote metadata, while the saved quote `totalCents` now matches the review estimate math including:
  - part-pricing overrides,
  - custom amounts.
- Updated quote detail and quote print views to include custom-amount totals and clearer add-on unit labels.
- Updated quote conversion so:
  - converted order parts start in the quote origin department when one is set,
  - custom quote amounts convert into non-checklist `CUSTOM` order charges using the origin/fallback department,
  - existing add-on/checklist conversion behavior remains intact.

Commands run:
- `npx eslint --ext .ts,.tsx -- "src/app/admin/addons/client.tsx" "src/app/admin/addons/page.tsx" "src/app/admin/quotes/QuoteEditor.tsx" "src/app/admin/quotes/[id]/page.tsx" "src/app/admin/quotes/[id]/print/page.tsx" "src/app/orders/new/page.tsx" "src/components/AvailableItemsLibrary.tsx" "src/components/AssignedItemsPanel.tsx" "src/lib/zod.ts" "src/lib/quote-metadata.ts" "src/modules/pricing/work-item-pricing.ts" "src/modules/pricing/__tests__/work-item-pricing.test.ts" "src/modules/quotes/quotes.schema.ts" "src/modules/quotes/quotes.service.ts" "src/modules/quotes/quotes.repo.ts" "src/modules/quotes/quote-work-items.ts" "src/modules/quotes/__tests__/quote-work-items.test.ts" "src/modules/quotes/__tests__/quote-totals.test.ts" "src/app/api/admin/quotes/[id]/route.ts"`
- `npm run test -- src/modules/pricing/__tests__/work-item-pricing.test.ts src/modules/quotes/__tests__/quote-work-items.test.ts src/modules/quotes/__tests__/quote-totals.test.ts`

Verification note:
- Targeted ESLint passed on all touched files.
- Focused pricing/quote tests passed (`9/9`) after an outside-sandbox rerun because the sandboxed Vitest/esbuild startup hit Windows `spawn EPERM`.

### 2026-04-13 - Department queue now prioritizes active timers, shows timer chips, preserves completed department ownership, and Vendors has pagination
- Updated `src/modules/orders/orders.service.ts` and `src/components/work-queue/WorkQueueOrderCard.tsx` so department work-queue cards now:
  - sort orders with active timers to the top before the existing flagged/due-date ordering,
  - display small green active-timer chips on each order tile showing worker + elapsed time.
- Updated completion routing in `src/modules/orders/orders.service.ts` so completed/shipped parts keep their final department ownership instead of falling back to an unassigned/null department:
  - manual `Mark Shipped` completion now preserves `Shipping`,
  - department-submit completion now preserves the last department when the part reaches `COMPLETE`.
- Updated `src/components/ShopFloorLayouts.tsx` so the existing checkbox label now reads `Show completed items`, matching the completed-item visibility behavior for department feeds.
- Updated the Vendors admin list in:
  - `src/app/admin/vendors/page.tsx`,
  - `src/app/admin/vendors/client.tsx`,
  - `src/app/api/admin/vendors/route.ts`
  so it now uses page-based pagination with `Previous` / `Next` controls and total-count awareness instead of a one-way `Load more` flow.

Commands run:
- `npx eslint --ext .ts,.tsx -- "src/components/ShopFloorLayouts.tsx" "src/components/work-queue/WorkQueueOrderCard.tsx" "src/modules/orders/orders.service.ts" "src/modules/orders/orders.types.ts" "src/app/admin/vendors/client.tsx" "src/app/admin/vendors/page.tsx" "src/app/api/admin/vendors/route.ts"`

Verification note:
- Targeted ESLint passed on all touched files.

### 2026-04-13 - Mark Shipped now uses the same button layout as the timer actions
- Updated `src/app/orders/[id]/page.tsx` so `Mark Shipped` is now a real outline button with the same size/layout treatment as `Start timer` and `Move Dept.` instead of a custom checkbox wrapper.
- Added a small shipped-state icon and kept the same Shipping-only enable/disable behavior.

Commands run:
- `npx eslint --ext .ts,.tsx -- "src/app/orders/[id]/page.tsx"`

Verification note:
- Targeted ESLint passed.

### 2026-04-13 - Shipping completion control renamed and aligned
- Updated `src/app/orders/[id]/page.tsx` so the shipping-only completion control now reads `Mark Shipped` instead of `Complete in Shipping`.
- Tightened the control wrapper so it uses the same centered, button-like alignment as the rest of the timer action row.

Commands run:
- `npx eslint --ext .ts,.tsx -- "src/app/orders/[id]/page.tsx"`

Verification note:
- Targeted ESLint passed.

### 2026-04-13 - Active timer chips now own the stop action
- Updated `src/app/orders/[id]/page.tsx` so each active timer chip now shows a small stop icon at the end of the chip.
- Removed the separate `Stop` button from the main timer action row; stopping a timer from the part controls now happens by clicking the specific active timer chip for that worker.
- This keeps the start action as the single main-row button and makes the stop affordance match the worker-specific timer chips.

Commands run:
- `npx eslint --ext .ts,.tsx -- "src/app/orders/[id]/page.tsx"`

Verification note:
- Targeted ESLint passed.

### 2026-04-13 - Active timer chips now tick live and Read Me First shows acknowledgement roster
- Updated `src/app/orders/[id]/page.tsx` so the active timer chip clock now refreshes from the selected part's `activeTimers` data instead of only from the logged-in user's `activeEntries`.
- This fixes the shared-view case where another worker's timer chip stayed frozen until a full page refresh.
- Added an `Already read by` list to the `Read me first` card that shows which users have acknowledged the current instruction version for the selected part's current department, along with acknowledgement timestamps.

Commands run:
- `npx eslint --ext .ts,.tsx -- "src/app/orders/[id]/page.tsx"`

Verification note:
- Targeted ESLint passed.

### 2026-04-13 - Mission brief now supports selected-worker PIN acknowledgement and structured quote-note bullets
- Updated `src/app/orders/[id]/page.tsx` so the mission-brief / required-reading flow now checks acknowledgement against the selected timer worker before opening the timer PIN dialog.
- When that selected worker has not acknowledged the current part/department instructions yet, the mission-brief popup now:
  - lets the operator choose the worker in the popup,
  - requires that worker's PIN before recording the acknowledgement,
  - carries the selected worker + PIN forward into the existing timer start dialog so the operator does not have to change identities in the browser session first.
- Reworked mission-brief rendering on order detail so `workInstructions` now display as headed bullet sections instead of one flat text block wherever possible.
- Updated quote-to-order instruction seeding in `src/app/orders/new/page.tsx` so newly converted orders now carry all of the original quote note-style fields into `workInstructions` as structured sections:
  - `Quote requirements`,
  - `Quote notes`,
  - `Materials`,
  - `Purchase items`,
  - `Part-specific notes`.
- Updated `src/app/api/orders/[id]/parts/[partId]/acknowledge-instructions/route.ts` so acknowledgement can be recorded for a selected worker after that worker's PIN is verified, instead of always forcing the logged-in browser user as the receipt owner.

Commands run:
- `npx eslint --ext .ts,.tsx -- "src/app/orders/[id]/page.tsx" "src/app/orders/new/page.tsx" "src/app/api/orders/[id]/parts/[partId]/acknowledge-instructions/route.ts"`

Verification note:
- Targeted ESLint passed on all touched files.

### 2026-04-13 - Timer tile now uses department + user selection before PIN start/stop
- Updated `src/app/orders/[id]/page.tsx` so the main timer tile now presents:
  - department selector,
  - user selector,
  - `Start timer`,
  - `Stop`,
  - `Move Dept.`,
  - checkbox-style `Complete in Shipping`.
- Fixed the timer department selector behavior so it no longer snaps back to the part's current department while the user is trying to choose another department.
- Removed `Pause` from the main timer button row; the tile now uses a simpler start/stop flow, while pause remains only in switch-conflict handling.
- Wired the main `Start timer` and `Stop` actions through the existing worker+PIN dialog so the selected worker must enter their PIN before the action executes.
- Restyled `Complete in Shipping` as a checkbox-style control and kept it greyed out unless the selected part's current department is Shipping.

Commands run:
- `npx eslint --ext .ts,.tsx -- "src/app/orders/[id]/page.tsx"`

Verification note:
- Targeted ESLint passed.

### 2026-04-13 - Order-detail timer tile now shows per-part active timer chips with PIN stop access
- Updated `src/app/orders/[id]/page.tsx` so the timer tile now uses the existing `partActivity` payload from `/api/timer/active` to show all active timers on the currently selected part, not just the logged-in viewer's own timer.
- Added compact active-timer chips in the tile displaying worker, department, and live elapsed time for each active timer on that part.
- Clicking a chip now opens the existing worker+PIN kiosk stop dialog prefilled for that timer's worker, which lets any viewer stop the correct timer by entering that worker's PIN.
- Updated the selected-part elapsed summary so it now includes all live active-timer seconds on that part instead of only the current browser user's active timer.

Commands run:
- `npx eslint --ext .ts,.tsx -- "src/app/orders/[id]/page.tsx"`

Verification note:
- Targeted ESLint passed.

### 2026-04-10 - Default material catalog expanded for common metals and plastics
- Expanded the default material seed lists in `prisma/seed-basic.js`, `prisma/seed.js`, `prisma/seed.ts`, and `src/repos/mock/seed.ts` so fresh installs, demo installs, and mock/test flows all start with a broader practical material catalog.
- Added common machine-shop metals and plastics, including:
  - steels/alloy steels/tool steels (`1018 CRS`, `1020 HRS`, `1045`, `12L14`, `4140`, `4130`, `A36 Plate`, `A2`, `D2`, `O1`),
  - aluminum grades (`6061-T6`, `7075-T6`, `2024-T351`, `5052-H32`, `MIC-6`),
  - stainless/brass/copper (`304 SS`, `316 SS`, `17-4 PH`, `Brass 360`, `C110 Copper`),
  - plastics (`Acetal / Delrin`, `Nylon 6/6`, `UHMW`, `HDPE`, `PVC`, `Polycarbonate`, `ABS`, `PTFE / Teflon`, `PEEK`).
- Applied the same list to the current local database with a targeted Prisma upsert so the material dropdowns in this workspace have the new options immediately.
- Existing-data note: the local database already had a legacy `304SS` material row, so both `304SS` and `304 SS` now exist; I left that untouched rather than silently mutating existing data.

Commands run:
- `npm run lint`
- `node -` seed-source presence check across seed files
- `node -` targeted Prisma material upsert + material inventory check

Verification note:
- Lint passed with no ESLint warnings/errors.
- Seed-source verification confirmed the new catalog names are present in all four seed sources.
- Targeted local Prisma upsert completed successfully; current local DB material count is `30`.

### 2026-04-10 - Order-detail part editor now exposes work instructions
- Updated `src/app/orders/[id]/page.tsx` so the admin part-edit form now loads, edits, and saves `workInstructions` in addition to standard part notes.
- This closes the gap where the mission-brief / required-reading text already existed in the backend and order-create flow, but could not be edited from the existing order-detail part editor.
- The order-detail PATCH payload now includes `workInstructions`, reusing the existing backend behavior that bumps `instructionsVersion` when the text changes.

Commands run:
- `npx eslint --ext .ts,.tsx -- "src/app/orders/[id]/page.tsx"`

Verification note:
- Targeted ESLint passed.

### 2026-04-10 - Order-detail kiosk timing follow-up: embedded PIN + part picker on `/orders/[id]`
- Reworked the kiosk-only timer experience on `src/app/orders/[id]/page.tsx` so kiosk-enabled machinists no longer have to leave the order-detail page to start or manage time.
- Replaced the old `Open kiosk` fallback with in-page kiosk controls in the existing timer area:
  - `Start timer` now opens a dialog on the order page,
  - the dialog now requires worker, department, and PIN selection before start,
  - the dialog lets the user choose a part from the current order before starting.
- Added in-page kiosk pause/stop handling on the same timer header, including PIN re-unlock when the kiosk session is missing.
- Reused the existing kiosk unlock/session/start/pause/finish/switch API routes so worker ownership, default-department usage, and active-timer switch confirmation all stay server-enforced.
- Collapsed the extra kiosk/timer helper copy, time breakdown, and last-action readout behind the existing `Show details` affordance so the timer header stays visually quiet by default.
- Follow-up simplification: the order-detail worker picker now treats all active users as eligible for this PIN flow instead of filtering by `kioskEnabled`, while still requiring that selected user's PIN.

Commands run:
- `npx eslint --ext .ts,.tsx -- "src/app/orders/[id]/page.tsx"`

Verification note:
- Targeted ESLint passed.

### 2026-04-10 - Shared kiosk timing + read-only order detail for floor users
- Added kiosk-ready user timing fields and admin management support:
  - `User.kioskEnabled`,
  - `User.kioskPinHash`,
  - `User.primaryDepartmentId`.
- Added `src/lib/kiosk-session.ts` and dedicated kiosk API routes under `src/app/api/kiosk/**` for:
  - PIN unlock,
  - kiosk session fetch,
  - kiosk lock/reset,
  - department part search,
  - worker-scoped timer start/pause/finish.
- Added `/kiosk` as a dedicated timing-only shared-station page:
  - PIN unlock,
  - current worker + active timer status,
  - primary-department default with override,
  - searchable department-ready part list,
  - explicit pause/stop/switch flow.
- Changed timer behavior to one active timer total per worker instead of one active timer per worker per department.
- Added reporting-oriented timer summaries in `src/modules/time/time.service.ts` for:
  - totals by part + department,
  - totals by part + user,
  - totals by department + user,
  - active timer by user.
- Kept `/orders/[id]` readable for floor workers but now hides timer controls for kiosk-enabled machinists and points them to `/kiosk` for timing.
- Hardened user-repo sanitization so kiosk PIN hashes are no longer leaked through sanitized user payloads.

Commands run:
- `npx prisma migrate dev --name kiosk_user_timing_v1`
- `npx eslint --ext .ts,.tsx -- "src/app/kiosk/page.tsx" "src/app/api/kiosk/unlock/route.ts" "src/app/api/kiosk/session/route.ts" "src/app/api/kiosk/lock/route.ts" "src/app/api/kiosk/parts/route.ts" "src/app/api/kiosk/timer/route.ts" "src/app/api/orders/[id]/route.ts" "src/app/api/timer/start/route.ts" "src/app/orders/[id]/page.tsx" "src/components/AppNav.tsx" "src/modules/kiosk/kiosk.service.ts" "src/modules/kiosk/kiosk.schema.ts" "src/modules/time/time.service.ts" "src/modules/users/users.repo.ts" "src/repos/users.ts" "src/repos/mock/users.ts" "src/repos/mock/seed.ts" "src/modules/time/__tests__/time.service.test.ts" "src/modules/kiosk/__tests__/kiosk.service.test.ts"`
- `npm run test -- src/modules/time/__tests__/time.service.test.ts src/modules/kiosk/__tests__/kiosk.service.test.ts`

Verification note:
- Prisma migration applied successfully and created `prisma/migrations/20260410174437_kiosk_user_timing_v1/migration.sql`.
- Targeted ESLint passed.
- Focused kiosk/time tests passed (`11/11`) after an outside-sandbox rerun because sandboxed Vitest/esbuild hit Windows `spawn EPERM`.
- Prisma generate inside the migration hit a Windows file-lock `EPERM` while renaming the Prisma query engine DLL, but the migration completed and the focused checks passed afterward.

### 2026-04-10 - Order-detail layout shift for part-heavy orders
- Reworked `src/app/orders/[id]/page.tsx` so the left rail is now dedicated to parts only instead of splitting space with the timer/work dock.
- Added a dedicated scroll area for the part list so long orders stay navigable without the timer controls consuming that column.
- Moved the timer department picker, timer start/pause/stop actions, submit action, complete-in-shipping action, and timer summary into the top of the right-side detail card.
- Removed the admin order-status override UI and related client-side state from this page so the right side stays focused on the selected part.

Commands run:
- `npx eslint --ext .ts,.tsx -- "src/app/orders/[id]/page.tsx"`

Verification note:
- Targeted ESLint passed.

### 2026-04-10 - Mission-brief acknowledge fix + quote conversion instruction seeding
- Fixed the order-detail mission-brief modal on `src/app/orders/[id]/page.tsx` so empty instruction sets no longer trigger the broken acknowledgement path:
  - department acknowledgement checks now short-circuit when a part has no `workInstructions`,
  - the modal's primary action now safely continues/closes when there is nothing to acknowledge,
  - manual acknowledgement no longer crashes on the success path when the dialog was opened without a pending gated action.
- Updated quote-to-order prefill in `src/app/orders/new/page.tsx` so converted orders now seed part-level `workInstructions` from:
  - quote-level `Requirements / process notes`,
  - each part's quote `Part notes`.
- Added a small conversion-mode review note clarifying where the mission-brief text comes from during quote conversion.

Commands run:
- `npx eslint --ext .ts,.tsx -- "src/app/orders/[id]/page.tsx" "src/app/orders/new/page.tsx"`

Verification note:
- Targeted ESLint passed on both touched UI files.

### 2026-04-10 - Order-detail UX polish follow-up
- Tightened the mission-brief and worker-roster presentation in `src/app/orders/[id]/page.tsx`.
- Mission brief now shows clearer acknowledgement copy plus quick chips for part, department, and instruction version.
- Overview instructions panel now uses more explicit state labels (`Read and logged`, `Needs acknowledgement`, `Optional reference`).
- Worker panel now reads more like a real part roster and explains the coordinator-vs-worker split more clearly.

Commands run:
- `npx eslint --ext .ts,.tsx src/app/orders/[id]/page.tsx`

Verification note:
- Targeted ESLint passed.

### 2026-04-10 - Repeat-order UX polish follow-up
- Tightened the repeat-order launch screen in `src/app/orders/new/page.tsx`.
- Added a clearer top-of-page repeat-launch summary that shows what is editable versus frozen.
- Surfaced quick counts for parts, order-level template files, and part-level template files.
- Removed the duplicate template-mode work-instructions field so the part editor only shows one instruction box.

Commands run:
- `npx eslint --ext .ts,.tsx src/app/orders/new/page.tsx`

Verification note:
- Targeted ESLint passed.

### 2026-04-10 - Repeat Orders + Operator Accountability v1 completed
- Finished the full v1 slice across schema, backend, routes, and UI.
- Repeat-order work now supports:
  - saving a frozen template from an existing order,
  - loading template-backed order creation at `/orders/new?templateId=...`,
  - creating a brand-new order from the template without copying execution history.
- Accountability work now supports:
  - part-level worker assignments,
  - part work instructions with per-user/per-department acknowledgement receipts,
  - acknowledgement gating on timer start/resume, checklist completion, and department submit,
  - checklist actor vs performer attribution,
  - richer part activity and log context.
- Order detail UI now includes:
  - worker assignment panel,
  - mission-brief acknowledgement modal,
  - submit reconfirmation dialog,
  - performer picker on checklist actions,
  - clearer part-event rendering.
- Order create UI now respects repeat-template mode and keeps frozen routing/files read-only while still allowing PO, due date, quantity, notes, and work-instruction overrides.

Commands run:
- `npx prisma validate`
- `npx prisma migrate dev --name repeat_orders_operator_accountability_v1`
- `npx eslint --ext .ts,.tsx src/app/orders/new/page.tsx src/app/orders/[id]/page.tsx src/modules/repeat-orders src/app/api/repeat-order-templates src/modules/orders/orders.service.ts src/modules/time/time.service.ts src/app/api/timer/start/route.ts src/app/api/timer/resume/route.ts src/app/api/timer/active/route.ts src/app/api/orders/[id]/parts/[partId]/checklist/[itemId]/complete-and-advance/route.ts`
- `npm run test -- src/modules/repeat-orders/__tests__/repeat-orders.service.test.ts src/modules/orders/__tests__/orders.service.test.ts src/modules/time/__tests__/time.service.test.ts`

Verification note:
- Focused ESLint passed on the touched repeat-order and accountability paths.
- Focused tests passed: repeat orders `4/4`, orders `11/11`, time `7/7` (`22/22` total).
- Vitest needed an outside-sandbox rerun after the in-sandbox Windows `spawn EPERM` failure.
- Repo-wide type-check still has unrelated baseline issues outside this scope; I did not treat them as regressions from this work.

### 2026-04-10 - Repeat orders + operator accountability UI
- Added order-detail UI for:
  - part-worker assignment panel using the existing assignment endpoints,
  - mission-brief must-read modal/read gate using the part instruction acknowledgement endpoint,
  - second-step submit reconfirmation dialog for department submit,
  - checklist performer selection dialog with the current user preselected,
  - richer part log rendering so actor vs performer context is clearer.
- Kept the order-detail work scoped to the UI layer and reused the backend contract that is already in the tree.
- Updated `tasks/todo.md`, `docs/AGENT_CONTEXT.md`, and this continuity trail so the next agent inherits the current state.

Commands run:
- `npx eslint "src/app/orders/[id]/page.tsx"`
- `npx eslint "src/app/orders/new/page.tsx"`
- `npx tsc --noEmit --pretty false`

Verification note:
- The targeted ESLint runs passed.
- Full repo type-check still reports unrelated pre-existing errors outside this slice, so I did not treat it as a regression from the UI changes.

### 2026-04-10 - Accountability backend only: assignments, acknowledgements, actor/perfomer logs, shared part activity
- Scoped the in-flight Repeat Orders + Operator Accountability work down to the accountability backend only and left repeat-order/UI files untouched.
- Orders backend:
  - finished part worker assignment CRUD service behavior already wired through the existing /api/orders/[id]/parts/[partId]/assignments routes,
  - finished part instruction acknowledgement status/receipt behavior and reuseable INSTRUCTION_ACK_REQUIRED gating,
  - enriched checklist events/history so actor vs performer are stored distinctly in both persistence and part-event metadata,
  - added order-detail read-model shaping for partActivity per part (ctiveTimers, 	imeByUser, 	otalSeconds).
- Timer/backend routes:
  - /api/timer/start now blocks start until the current user has acknowledged the active part instructions for the target department,
  - /api/timer/resume applies the same acknowledgement gate before resuming a part-linked timer,
  - /api/timer/active now returns shared partActivity summaries for requested part IDs.
- Mock repos/seeds were updated to cover:
  - checklist performer attribution,
  - part assignments,
  - instruction receipts,
  - shared part-time activity across multiple users.
- Added focused backend coverage for:
  - acknowledgement-gated checklist toggles,
  - acknowledgement-gated department submit,
  - actor-vs-performer checklist logging,
  - part worker + shared activity read models,
  - time-service shared part activity summaries.

Commands run:
- 
pm run test -- src/modules/orders/__tests__/orders.service.test.ts
- 
pm run test -- src/modules/time/__tests__/time.service.test.ts
- 
pm run lint

Verification note:
- Orders backend tests passed (11/11).
- Time backend tests passed (7/7) after an outside-sandbox rerun because sandboxed Vitest/esbuild hit Windows spawn EPERM.
- Lint passed with no ESLint warnings/errors.
### 2026-04-08 — Unraid Docker app template refresh
- Updated `unraid/my-shopapp1.xml` to better match the current ShopApp1 container setup:
  - normalized app name to `ShopApp1`,
  - added project/support/template URLs,
  - refreshed overview text,
  - added optional advanced `OPENAI_API_KEY` env variable for the Print Analyzer feature.
- Rewrote `unraid/README.md` so the Unraid workflow now matches the current Docker image/load/template/install/seed process.

Commands run:
- `git diff -- unraid/my-shopapp1.xml unraid/README.md`

Verification note:
- Reviewed only deployment-template/docs diffs; no app-code/runtime paths changed, so no lint/test run was required for this scope.

### 2026-04-08 — Dashboard department visibility follow-up: current owner shown on tiles and part view
- Fixed department work-queue ownership logic so the display now follows `OrderPart.currentDepartmentId` instead of requiring open checklist rows in the selected department.
- Fixed `ShopFloorLayouts` initial-department refresh behavior so toggling `Include completed` now refetches correctly for the initially selected department instead of reusing stale server snapshot data.
- Updated dashboard cards:
  - Grid digest cards now show `Current department` and `Parts` in addition to existing customer/machinist/due/priority/checklist context.
  - Work queue cards now show the selected department badge, latest activity, and per-part current department labels.
- Updated order detail UI so current department is visible:
  - in the selected-part Overview tab,
  - in each part row in the left-side part list.
- Added focused Orders service coverage proving the department feed includes a part based on current department ownership even without checklist rows in that department.

Commands run:
- `npm run test -- src/modules/orders/__tests__/orders.service.test.ts`
- `npm run lint`

Verification note:
- Targeted Orders service tests passed (6/6).
- Lint passed with no ESLint warnings/errors.

### 2026-04-08 — Order-detail department UX follow-up: in-app move dialog + restored department dropdowns
- Replaced the raw browser `window.prompt` manual department-move flow on `/orders/[id]` with an in-app dialog using the site modal pattern, a destination department dropdown, and the existing required move-note field.
- Fixed missing timer/manual-move department options by sending the ordered active department list from `getOrderDetails()` and using that canonical list on the page instead of inferring departments from checklist rows.
- Added first-active-department fallback for parts missing `currentDepartmentId` in both order-detail read-model shaping and the current-department backfill path, which makes Machining the default first department in the current ordering.
- Guarded the backfill path from assigning fallback departments to parts that are already complete.
- Added focused Orders service coverage for the default-first-department behavior.

Commands run:
- `npm run test -- src/modules/orders/__tests__/orders.service.test.ts`
- `npm run lint`

Verification note:
- Targeted Orders service tests passed (5/5) after rerunning outside sandbox because Vitest/esbuild hit sandbox `spawn EPERM`.
- Lint passed with no ESLint warnings/errors.

### 2026-04-08 — Hotfix: quote print totals now match editor/detail pricing math
- Fixed `src/app/admin/quotes/[id]/print/page.tsx` so the print totals no longer double-count per-part pricing and the same part's raw add-on/labor subtotal.
- Reused the shared pricing-summary replacement helper so quote editor, quote detail, and quote print now apply the same totals rule.

Commands run:
- npm run lint

Verification note:
- Lint passed with no ESLint warnings/errors.

### 2026-04-08 — Hotfix: view-quote totals card now matches quote editor pricing math
- Fixed `src/app/admin/quotes/[id]/page.tsx` so the Totals card no longer double-counts per-part pricing and the same part's raw add-on/labor subtotal.
- Reused the shared pricing-summary replacement helper to keep quote editor and quote detail totals aligned.
- Preserved legacy quote-level add-on selections in the `Add-ons and labor` bucket.

Commands run:
- npm run lint

Verification note:
- Lint passed with no ESLint warnings/errors.

### 2026-04-08 — Follow-up: Quote part-pricing input now auto-fills from assigned work subtotal
- Updated `src/app/admin/quotes/QuoteEditor.tsx` so each part-pricing input auto-populates from that part's current assigned add-ons/labor subtotal.
- Auto-fill continues to track assignment changes until the user manually edits the field, after which the typed value is preserved.
- This removes the need to retype the raw subtotal before choosing whether it represents a lot total or per-unit price.

Commands run:
- npm run lint

Verification note:
- Lint passed with no ESLint warnings/errors.

### 2026-04-08 — Hotfix: Quote review summary no longer double-counts part pricing
- Fixed quote review summary math in `src/app/admin/quotes/QuoteEditor.tsx` so a non-zero per-part pricing entry replaces that part's raw add-on/labor subtotal instead of stacking both.
- Added `calculatePartPricingSummaryTotalsCents` in `src/modules/pricing/work-item-pricing.ts` to keep the bucket-replacement rule explicit and reusable.
- Added focused pricing-helper test coverage for the replacement behavior.

Commands run:
- npm run test -- src/modules/pricing/__tests__/work-item-pricing.test.ts
- npm run lint

Verification note:
- Targeted work-item pricing tests passed.
- Lint passed with no ESLint warnings/errors.

### 2026-04-08 — Hotfix: QuoteEditor `activePart` initialization crash
- Fixed admin quote creation/edit runtime crash `Cannot access 'activePart' before initialization` in `src/app/admin/quotes/QuoteEditor.tsx`.
- Root cause: a `useEffect` pruned selected assignment keys using `activePart` before the memoized `activePart` binding was initialized later in the component body.
- Reworked the effect to derive the current part from `parts` + `activePartKey` locally, preserving selection-pruning behavior without triggering the temporal dead zone.

Commands run:
- npm run lint

Verification note:
- Lint passed with no ESLint warnings/errors.

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

### 2026-04-10 - Repeat-order backend: hardened template snapshot/create-order contracts and added focused service coverage
- Audited the existing repeat-order backend domain under `src/modules/repeat-orders` and kept the implementation scoped there rather than spreading more logic into order-detail UI paths.
- Hardened template snapshot/create-order behavior:
  - template snapshot no longer carries the source order PO into template defaults,
  - template-based order creation now rejects templates with no parts,
  - duplicate or unknown `templatePartId` overrides now fail fast with `400`,
  - provided order numbers must match the same business-prefix rule as normal order creation.
- Kept repeat-order instantiation reusing the normal post-create order lifecycle helpers already present in Orders service:
  - `generateNextOrderNumber`,
  - `syncChecklistForOrder`,
  - `initializeCurrentDepartmentForOrder`,
  - `syncOrderWorkflowStatus`,
  - `ensureOrderFilesInCanonicalStorage`.
- Added focused repeat-order service tests covering template snapshot behavior, invalid override handling, invalid order-number handling, and successful template-based order instantiation.

Commands run:
- `npx eslint src/modules/repeat-orders/repeat-orders.service.ts src/modules/repeat-orders/repeat-orders.repo.ts src/modules/repeat-orders/repeat-orders.schema.ts src/modules/repeat-orders/repeat-orders.types.ts src/modules/repeat-orders/__tests__/repeat-orders.service.test.ts src/app/api/repeat-order-templates/route.ts src/app/api/repeat-order-templates/from-order/[orderId]/route.ts src/app/api/repeat-order-templates/[id]/route.ts src/app/api/repeat-order-templates/[id]/create-order/route.ts` 
- `npm run test -- src/modules/repeat-orders/__tests__/repeat-orders.service.test.ts`

Verification note:
- ESLint passed on the touched repeat-order/API files with no reported issues.
- Focused repeat-order service tests passed (4/4) after rerunning outside sandbox because Vitest/esbuild hit the usual Windows `spawn EPERM` in sandbox.


### 2026-04-10 — Vendors follow-up: added searchable contact/materials fields and rolled back the partial import
- Extended the `Vendor` schema with first-class `contact` and `materials` fields so supplier contact/material data is searchable without burying it in `notes`.
- Updated Vendors validation, CRUD forms, search, and importer mapping so:
  - `Contact` can import into `contact`,
  - `Material` can import into `materials`,
  - Vendors search now matches `contact` and `materials` in addition to `name`, `url`, `phone`, and `notes`.
- Applied Prisma migration `20260410103000_add_vendor_contact_materials`.
- Rolled back the recent partial spreadsheet import by deleting 37 unreferenced vendor rows, preserving the baseline seeded records (`Grainger`, `McMaster-Carr`) and any linked vendor data.
- Verified the real workbook preview now suggests:
  - `Company -> name`
  - `Web page -> url`
  - `Phone -> phone`
  - `Contact -> contact`
  - `Material -> materials`

Commands run:
- `npx prisma migrate dev`
- `npx prisma generate`
- vendor-reference audit via `node -`
- rollback delete script via `node -`
- `npm run lint`
- `npm run test -- src/modules/vendors/__tests__/vendor-import.test.ts`
- `node -` (real workbook preview parse + post-rollback vendor check)

Verification note:
- Lint passed with no ESLint warnings/errors.
- Focused Vendors importer test passed (1/1) outside sandbox.
- Prisma migration applied successfully; `npx prisma generate` still reported a Windows file-lock rename `EPERM`, but the generated client is usable and successfully queried the new `contact`/`materials` fields afterward.
- Post-rollback vendor check confirmed only `Grainger` and `McMaster-Carr` remain.

### 2026-04-10 — Vendors import workflow: preview-and-map spreadsheet importer added
- Added an admin-only Vendors spreadsheet import flow on `/admin/vendors` that supports:
  - spreadsheet upload (`.xls`, `.xlsx`, `.csv`),
  - sheet selection,
  - configurable header row,
  - preview of raw rows and parsed rows,
  - column mapping into the current Vendor schema (`name`, `url`, `phone`, `notes`),
  - duplicate handling (`skip` or `update`) by vendor name.
- Added `POST /api/admin/vendors/import` for both preview and import actions using a stateless reparse flow.
- Added `src/modules/vendors/vendor-import.ts` to centralize workbook parsing, header detection, mapping suggestions, and row shaping.
- Added the `xlsx` dependency so the app can read the provided legacy `Suppliers.xls` workbook reliably.
- Verified the real workbook parse path against `C:\Users\user\Downloads\Suppliers.xls`:
  - selected sheet defaulted to `Steel Suppliers`,
  - detected columns were `Company`, `Phone`, `Contact`, `Web page`, and `Material`,
  - suggested mapping resolved to `Company -> name`, `Web page -> url`, `Phone -> phone`, `Contact -> notes`.

Commands run:
- `npm install xlsx`
- `npm run lint`
- `npm run test -- src/modules/vendors/__tests__/vendor-import.test.ts`
- `node -` (real workbook preview parse against `C:\Users\user\Downloads\Suppliers.xls`)

Verification note:
- Lint passed with no ESLint warnings/errors.
- Focused Vendors importer test passed (1/1) after rerunning outside sandbox because Vitest/esbuild hit sandbox `spawn EPERM`.
- Real workbook preview parse succeeded and produced the expected supplier-style column mapping suggestions for the uploaded `.xls`.

### 2026-04-10 — BOM analyzer oversized-image fix: large image uploads no longer stack-overflow
- Fixed `src/app/api/print-analyzer/analyze/route.ts` so large image uploads no longer fail with `Maximum call stack size exceeded`.
- Root cause and fixes:
  - replaced the route's regex-based `data:` URL parser with a delimiter-based parser after isolating the stack overflow to `decodeDataUrl()` on a multi-megabyte base64 string,
  - removed the server-side image data-URL roundtrip so normalized analyzer inputs stay as raw `Buffer`s after request parsing,
  - switched OpenAI vision calls from inline base64 `image_url` payloads to uploaded OpenAI files (`purpose: vision` + Responses `input_image.file_id`) with best-effort cleanup after each request.
- Added a prevention rule in `tasks/lessons.md` covering large base64 route payload parsing.

Commands run:
- `npm run lint`
- local oversized-image POST to `http://127.0.0.1:3000/api/print-analyzer/analyze`

Verification note:
- Lint passed with no ESLint warnings/errors.
- A locally generated `~5.9 MB` JPEG that previously returned `502` with `Maximum call stack size exceeded` now returns `200` with structured analyzer JSON in about 29.7s.

### 2026-04-10 — Local dev recovery: restarted stale port-3000 Next server after broken `.next` runtime state
- Investigated the admin quote print runtime error shown on the live local app and confirmed the current code path was healthy on a fresh dev compile.
- Verified divergence between servers:
  - fresh `3001` dev server served `/admin/quotes/cmnsw7c34000tq7rcbjgn7aeq/print` successfully,
  - existing `3000` dev server returned `500` from a broken `.next/server/...` `ENOENT` state.
- Stopped the stale `3000` Next process, restarted the workspace dev server on `3000`, and re-verified the same authenticated quote print route now returns `200`.

Commands run:
- local auth + route probes against `http://127.0.0.1:3001` and `http://127.0.0.1:3000`
- `Stop-Process -Id 41880 -Force`
- restarted local dev server on port `3000`

Verification note:
- After restart, authenticated request to `http://127.0.0.1:3000/admin/quotes/cmnsw7c34000tq7rcbjgn7aeq/print` returned `200` instead of the prior `500` runtime failure.

### 2026-04-10 — Auth redirect hotfix: credential sign-in now stays on current LAN/IP origin
- Fixed `src/app/(public)/auth/signin/page.tsx` so credential sign-in no longer relies on NextAuth's final redirect origin selection when login succeeds.
- Switched the sign-in submit flow to `redirect: false` and manually navigated to the normalized relative callback path after a successful response.
- This keeps post-login navigation on the active browser origin, which avoids the localhost bounce when the auth/base URL config still points at loopback.

Commands run:
- `npm run lint`

Verification note:
- Lint passed with no ESLint warnings/errors.

### 2026-04-09 — Order-detail submit dialog follow-up: confirm button now tracks selected destination
- Fixed `src/app/orders/[id]/page.tsx` so the dialog confirm button label now derives from the actual selected destination department instead of the stale `nextDepartmentOption` helper.
- This removes the mismatch where the dropdown could say `Shipping` while the button still said `Submit to Fab`.
- Added a prevention rule to `tasks/lessons.md` covering live-selection labels in dialogs/forms.

Commands run:
- `npm run lint`

Verification note:
- Lint passed with no ESLint warnings/errors.

### 2026-04-09 — Order-detail submit flow cleanup: dialog owns destination selection
- Removed the redundant submit-destination dropdown from the `/orders/[id]` work dock so operators now use a single `Submit To` button to open the move dialog.
- Kept destination selection inside the dialog only, where the current department is shown first and the destination list now excludes the current department.
- Preserved the existing required move-note/manual-submit workflow while simplifying the operator path.

Commands run:
- `npm run lint`

Verification note:
- Lint passed with no ESLint warnings/errors.

### 2026-04-09 — Dashboard follow-up: current department card no longer says `Unassigned` for active fallback-owned work
- Fixed `src/components/ShopFloorLayouts.tsx` so dashboard/grid-digest current-department labels now use the same first-department fallback as the order-detail workflow for non-complete orders.
- This removes the contradiction where a part could be treated as Machining in move/timer flows but still render as `Unassigned` on the summary card.
- Completed/closed orders still skip the fallback so we do not invent an active department after completion.

Commands run:
- `npm run lint`

Verification note:
- Lint passed with no ESLint warnings/errors.

### 2026-04-09 — Order-detail follow-up: active timer deep-link + compact submit destination control
- Updated `/orders/[id]` work dock so the `Other timer live` status now opens the exact active timer context instead of leaving operators guessing:
  - active timer summaries now include order/part context and deep links,
  - order detail now honors `?part=` so the link opens directly on the active part when available.
- Reworked the manual department-submit controls to avoid long button overflow:
  - replaced `Submit to <Department>` dock copy with a compact `Submit To` button,
  - added a paired destination dropdown listing valid departments,
  - kept the existing note-required move dialog as the final confirmation step.

Commands run:
- `npm run lint`

Verification note:
- Lint passed with no ESLint warnings/errors.

### 2026-04-09 — Order-detail follow-up: persisted Machining default + manual-only department presentation + compact timer dock
- Fixed order part ownership initialization so newly created/converted order parts now persist the first active department immediately instead of sitting with null `currentDepartmentId`.
- Fixed order-detail read-model behavior so a part with missing department ownership no longer appears to auto-advance to the next department when the last checklist item in the current department is checked; missing ownership now falls back only to the first active department.
- Updated `/orders/[id]` left rail to reduce timer footprint:
  - narrowed the left rail,
  - shortened timer/action labels,
  - defaulted the manual move action toward the next ordered department,
  - moved detailed time notes/history behind an explicit `Show details` toggle so the parts list keeps more vertical space.
- Added focused Orders service regression coverage proving:
  - new parts initialize to Machining/first department,
  - a null-owned part does not visually jump to the next department after checklist completion.

Commands run:
- `npm run test -- src/modules/orders/__tests__/orders.service.test.ts`
- `npm run lint`

Verification note:
- Targeted Orders service tests passed (7/7).
- Lint passed with no ESLint warnings/errors.

### 2026-04-08 — Final phase complete: structured quote template block editor + print mapping
- Extended document template layout normalization from legacy `sections[]` into structured `blocks[]` model (`id`, `type`, `label`, `visible`, `order`, `variant`, `options`) with backward-compatible fallback.
- Upgraded `/admin/templates` builder to block-based editing with controls for show/hide, label override, variant preset, and quote pricing block options (`showUnitPrice`, `showQuantity`, `showLineTotal`, `showPricingMode`).
- Wired `/admin/quotes/[id]/print` to structured block render planning so saved template block visibility/options directly control quote output rendering.
- Preserved legacy templates by normalizing existing `sections[]` records into generated blocks at read time.
- Added focused tests for normalization and quote print block mapping.

Commands run:
- npm run test -- src/lib/__tests__/document-template-layout.test.ts src/lib/__tests__/quote-print-layout.test.ts
- npm run lint

Verification note:
- Targeted tests passed (4/4).
- Lint passed with no ESLint warnings/errors.

### 2026-04-08 — Phase 3 complete: quote-detail Quick Convert dialog (skip /orders/new wizard)
- Added admin quote-detail quick-convert UX with required fields (`dueDate`, `priority`, `assignedMachinistId`) and optional overrides (`PO number`, `vendorId`, material/model flags).
- Added direct quick-convert trigger on `/admin/quotes/[id]` and routed success straight to `/orders/{id}`.
- Kept existing manual `/orders/new` flow intact; detail-page workflow controls now keep approval/conversion status while quick-convert owns conversion action.
- Reused existing `POST /api/admin/quotes/[id]/convert` route; no duplicate backend conversion endpoint introduced.
- Added focused tests:
  - `src/components/Admin/__tests__/QuoteQuickConvertDialog.test.ts` (payload validation behavior)
  - `src/app/api/admin/quotes/[id]/convert/__tests__/route.test.ts` (invalid dueDate edge)
- Hardened conversion-route already-converted message fallback (`orderNumber` -> `orderId`) for clearer idempotency error output.

Commands run:
- npm run test -- src/components/Admin/__tests__/QuoteQuickConvertDialog.test.ts src/app/api/admin/quotes/[id]/convert/__tests__/route.test.ts
- npm run lint

Verification note:
- Targeted quick-convert/convert-route tests passed (6/6 total assertions/tests).
- Lint passed with no ESLint warnings/errors.

### 2026-04-08 — Phase 2 complete: explicit Unit/Qty/Line quote pricing presentation alignment
- Updated Quote Creator per-part pricing basis rows to explicit pricing presentation fields:
  - Entered price,
  - Unit price,
  - Qty,
  - Line total,
  - Pricing mode label.
- Updated quote review/read-model surfaces to the same presentation contract:
  - `/admin/quotes/[id]` part cards now show Unit price, Qty, Line total, and Pricing mode.
  - Email pricing summary now outputs `Unit × Qty = Line Total` with mode annotation.
  - `/admin/quotes/[id]/print` part pricing table now uses `Unit price`, `Qty`, `Line total` columns and mode line per part.
- Preserved canonical math contract (`PER_UNIT` vs `LOT_TOTAL`) and storage contract (`priceCents` + `pricingMode` persisted unchanged) by deriving display values from helper math.
- Added pricing helper and tests:
  - `calculatePartUnitPrice` in `src/modules/pricing/part-pricing.ts`
  - expanded `src/modules/pricing/__tests__/part-pricing.test.ts` (6/6 passing)

Commands run:
- npm run test -- src/modules/pricing/__tests__/part-pricing.test.ts
- npm run lint

Verification note:
- Targeted pricing tests passed (6/6).
- Lint passed with no ESLint warnings/errors.

### 2026-04-08 — Phase 1 complete: Quote Creator bulk assignment actions + reusable presets
- Implemented quote build-step productivity controls for multi-part quotes:
  - select assignment rows and apply selected items to **all parts** with merge/no-duplicate behavior,
  - copy selected items from active part to chosen target part(s) with merge/no-duplicate behavior.
- Added Quote Creator preset workflow:
  - save preset from selected items,
  - apply preset to selected part or all parts,
  - delete preset,
  - local persistence via `localStorage` (`quote-addon-presets-v1`).
- Added pure helper module + focused tests:
  - `src/modules/quotes/quote-addon-bulk.ts`
  - `src/modules/quotes/__tests__/quote-addon-bulk.test.ts` (3/3 passing)
- Added state safety guards in Quote Editor for assignment selection/copy target synchronization.

Commands run:
- npm run test -- src/modules/quotes/__tests__/quote-addon-bulk.test.ts
- npm run lint

Verification note:
- Targeted quote bulk helper tests passed (3/3).
- Lint passed with no ESLint warnings/errors.

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
### 2026-04-08 — Quote template editor: expanded detail controls for print blocks
- Extended quote template block metadata in `src/lib/quote-print-layout.ts` so scope, addons/labor, and notes/requirements blocks can carry their own option sets in addition to pricing blocks.
- Updated `src/app/admin/templates/TemplatesClient.tsx` to expose new block-level controls for:
  - part detail visibility on scope/line-item blocks,
  - addon/labor visibility including `Show prices`,
  - notes/requirements section toggles.
- Updated `src/app/admin/quotes/[id]/print/page.tsx` so quote print rendering now honors those new template options.
- Added focused option-mapping coverage in `src/lib/__tests__/quote-print-layout.test.ts`.

Commands run:
- npm run test -- src/lib/__tests__/quote-print-layout.test.ts
- npm run lint

Verification note:
- Targeted quote-print-layout tests passed.
- Lint passed with no ESLint warnings/errors.
### 2026-04-08 — Quote template editor: expanded detail controls for print blocks
- Extended quote template block metadata in `src/lib/quote-print-layout.ts` so scope, addons/labor, and notes/requirements blocks can carry their own option sets in addition to pricing blocks.
- Updated `src/app/admin/templates/TemplatesClient.tsx` to expose new block-level controls for:
  - part detail visibility on scope/line-item blocks,
  - addon/labor visibility including `Show prices`,
  - notes/requirements section toggles.
- Updated `src/app/admin/quotes/[id]/print/page.tsx` so quote print rendering now honors those new template options.
- Added focused option-mapping coverage in `src/lib/__tests__/quote-print-layout.test.ts`.

Commands run:
- npm run test -- src/lib/__tests__/quote-print-layout.test.ts
- npm run lint

Verification note:
- Targeted quote-print-layout tests passed.
- Lint passed with no ESLint warnings/errors.
### 2026-04-08 — Hotfix: `/orders/[id]` nullish-coalescing compile error
- Fixed `src/app/orders/[id]/page.tsx` compile failure caused by mixing `??` with `||` inside the manual department-move prompt string interpolation.
- Replaced the inline expression with a dedicated `currentDepartmentLabel` value so the order detail page compiles cleanly again.

Commands run:
- npm run lint

Verification note:
- Lint passed with no ESLint warnings/errors.
### 2026-04-10 — BOM analyzer PDF runtime loader follow-up
- Fixed the PDF analyzer route's runtime module loading so PDF uploads work inside the live Next server bundle instead of failing on module-resolution errors.
- Replaced the earlier `createRequire` / filesystem import approaches with runtime dynamic imports for both `pdfjs-dist` and `@napi-rs/canvas` in `src/app/api/print-analyzer/analyze/route.ts`.
- Reclaimed port `3000` from the stale local Next process and restarted the updated workspace there so local testing matches the expected app URL.

Commands run:
- `npm run lint`
- `node -` (live PDF smoke test against `http://127.0.0.1:3000/api/print-analyzer/analyze`)

Verification note:
- Lint passed with no ESLint warnings/errors.
- Live PDF analyzer request on port `3000` returned `200` with structured JSON instead of the prior module-resolution failure.

### 2026-04-09 — BOM analyzer PDF upload support
- Added PDF support to the BOM analyzer upload surfaces:
  - `/orders/[id]` BOM tab now accepts `application/pdf` in the file picker,
  - stored `PRINT` attachments with `application/pdf` now appear in the BOM analyzer attachment picker,
  - `/private/print-analyzer` now accepts PDF uploads too.
- Reworked `POST /api/print-analyzer/analyze` so it now accepts `data:application/pdf` payloads, rasterizes page 1 to PNG with `pdfjs-dist` + `@napi-rs/canvas`, and then runs the existing image-based OpenAI vision flow unchanged after that conversion step.
- Added Decision Log entry documenting the new PDF-rendering dependency choice and updated `docs/PRINT_ANALYZER.md` to describe first-page PDF behavior.

Commands run:
- `npm install pdfjs-dist @napi-rs/canvas`
- `npm run lint`
- `npm run build`
- `node -` (runtime PDF rasterization sanity check against stored PDF `storage/sterling-tool-and-die/s-k-industrial/std-1007/tdc-british-standard-pipe-threads-1-d367a7f6-608a-47c9-8cea-274c3f180503.pdf`)

Verification note:
- Lint passed with no ESLint warnings/errors.
- Runtime PDF rasterization check succeeded: `pdf-render-ok:303905:1224x1584`.
- `npm run build` still fails in this environment because of the existing `next/font` Roboto fetch / `127.0.0.1:9` connection issue, but the PDF-renderer native-module webpack parse error is resolved.


