## Session Handoff - 2026-04-10 (Order-detail UX polish)

Goal (1 sentence): Apply a small clarity pass to the order-detail accountability UI so the mission brief and part-worker roster are easier to scan on the floor.

### What changed
- Updated `src/app/orders/[id]/page.tsx`
  - Refined the mission-brief modal copy to better explain when acknowledgement is required and that the receipt is logged.
  - Added quick chips for part, department, and instruction version in the brief modal.
  - Updated the overview instructions card to use clearer acknowledgement-state wording.
  - Added a small roster explainer to the worker panel and improved the empty-state wording.

### Files touched
- `src/app/orders/[id]/page.tsx`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npx eslint --ext .ts,.tsx src/app/orders/[id]/page.tsx`

### Verification evidence
- Targeted ESLint passed.

## Session Handoff - 2026-04-10 (Repeat-order UX polish)

Goal (1 sentence): Apply a small clarity pass to the repeat-order launch screen so template mode is easier to understand on first use.

### What changed
- Updated `src/app/orders/new/page.tsx`
  - Added a repeat-launch summary banner explaining which fields are editable and which parts of the template are frozen.
  - Added quick counts for parts, order files, and part files at the top of template mode.
  - Removed a duplicate template-mode work-instructions textarea from the selected-part editor.

### Files touched
- `src/app/orders/new/page.tsx`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npx eslint --ext .ts,.tsx src/app/orders/new/page.tsx`

### Verification evidence
- Targeted ESLint passed.

## Session Handoff - 2026-04-10 (Repeat Orders + Operator Accountability v1 final integration)

Goal (1 sentence): Finish the end-to-end Repeat Orders + Operator Accountability v1 slice across schema, backend, routes, order detail UI, and template-based order creation UI.

### What changed
- Prisma/data model
  - Added repeat-order template models plus part/charge/attachment children.
  - Added `OrderPartAssignment`, `PartInstructionReceipt`, `OrderPart.workInstructions`, `OrderPart.instructionsVersion`, and `OrderChecklist.performedById`.
- Repeat-order backend/API
  - Added `src/modules/repeat-orders/**` service/repo/schema/types.
  - Added `/api/repeat-order-templates`, `/from-order/[orderId]`, `/[id]`, and `/[id]/create-order`.
  - Template creation snapshots manufacturing definition only; execution history is excluded.
- Accountability backend/API
  - Added part-worker assignment behavior, acknowledgement receipt/status helpers, checklist performer attribution, shared part activity summaries, and deterministic acknowledgement gating for timer start/resume, checklist toggle, and department submit.
  - Timer/checklist routes now surface `INSTRUCTION_ACK_REQUIRED` consistently.
- Order detail UI
  - Added worker assignment panel, mission-brief acknowledgement modal, second-step submit confirmation, checklist performer picker, and clearer actor-vs-performer log rendering in `src/app/orders/[id]/page.tsx`.
- Order create repeat-order UI
  - `src/app/orders/new/page.tsx` now supports template mode via `templateId`, prefills from repeat templates, submits through the repeat-template create-order route, disables mutable routing/file controls for frozen template launches, and exposes part work-instruction editing.

### Files touched
- `prisma/schema.prisma`
- `prisma/migrations/20260410153846_repeat_orders_operator_accountability_v1/migration.sql`
- `src/modules/orders/orders.repo.ts`
- `src/modules/orders/orders.schema.ts`
- `src/modules/orders/orders.service.ts`
- `src/modules/time/time.service.ts`
- `src/modules/repeat-orders/repeat-orders.repo.ts`
- `src/modules/repeat-orders/repeat-orders.schema.ts`
- `src/modules/repeat-orders/repeat-orders.service.ts`
- `src/modules/repeat-orders/repeat-orders.types.ts`
- `src/modules/repeat-orders/__tests__/repeat-orders.service.test.ts`
- `src/modules/orders/__tests__/orders.service.test.ts`
- `src/modules/time/__tests__/time.service.test.ts`
- `src/app/api/repeat-order-templates/route.ts`
- `src/app/api/repeat-order-templates/from-order/[orderId]/route.ts`
- `src/app/api/repeat-order-templates/[id]/route.ts`
- `src/app/api/repeat-order-templates/[id]/create-order/route.ts`
- `src/app/api/timer/start/route.ts`
- `src/app/api/timer/resume/route.ts`
- `src/app/api/timer/active/route.ts`
- `src/app/api/orders/[id]/parts/[partId]/checklist/[itemId]/complete-and-advance/route.ts`
- `src/app/orders/[id]/page.tsx`
- `src/app/orders/new/page.tsx`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npx prisma validate`
- `npx prisma migrate dev --name repeat_orders_operator_accountability_v1`
- `npx prisma generate`
- `npx eslint --ext .ts,.tsx src/app/orders/new/page.tsx src/app/orders/[id]/page.tsx src/modules/repeat-orders src/app/api/repeat-order-templates src/modules/orders/orders.service.ts src/modules/time/time.service.ts src/app/api/timer/start/route.ts src/app/api/timer/resume/route.ts src/app/api/timer/active/route.ts src/app/api/orders/[id]/parts/[partId]/checklist/[itemId]/complete-and-advance/route.ts`
- `npm run test -- src/modules/repeat-orders/__tests__/repeat-orders.service.test.ts src/modules/orders/__tests__/orders.service.test.ts src/modules/time/__tests__/time.service.test.ts`

### Verification evidence
- Prisma validate passed.
- Migration applied successfully for `repeat_orders_operator_accountability_v1`.
- Focused ESLint passed on the touched repeat-order and accountability files.
- Focused tests passed: repeat orders `4/4`, orders `11/11`, time `7/7` (`22/22` total).
- `npx prisma generate` hit a Windows file-lock `EPERM`, but the generated client contained the new types/models and the subsequent lint/tests passed.
- Focused Vitest execution required an outside-sandbox rerun after in-sandbox Windows `spawn EPERM`.

### Follow-up assumptions / caveats
- Repo-wide type-check still has unrelated baseline errors outside this feature slice.
- Repeat-order UI intentionally treats template routing/files as frozen in v1; bossman can override order-level fields and part notes/instructions, but not rebuild the template routing from the create screen.
- `Order.assignedMachinistId` remains coordinator-only; actual floor execution is part-level through `OrderPartAssignment`.

## Session Handoff - 2026-04-10 (Repeat orders + operator accountability UI)

Goal (1 sentence): Finish the order-detail UI slice for Repeat Orders + Operator Accountability v1: part-worker assignment panel, must-read instruction gate, submit reconfirmation, checklist performer selection, and clearer part log phrasing.

### What changed
- Updated `src/app/orders/[id]/page.tsx`
  - Added a part-worker assignment panel that uses the existing `/api/orders/[id]/parts/[partId]/assignments` GET/POST/DELETE routes.
  - Added a must-read mission-brief modal/read gate using `/api/orders/[id]/parts/[partId]/acknowledge-instructions`.
  - Added a second-step submit reconfirmation dialog for the existing department-submit flow.
  - Added a checklist performer-selection dialog with the current session user preselected and persisted through `performedById`.
  - Updated part log rendering to surface actor vs performer context more clearly.
  - Kept the changes inside the order-detail page and reused the backend contracts already in the tree.
- Updated continuity docs:
  - `tasks/todo.md`
  - `PROGRESS_LOG.md`
  - `docs/AGENT_CONTEXT.md` was already updated earlier in the session for the repeat-order/accountability decision log entry.

### Files touched
- `src/app/orders/[id]/page.tsx`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npx eslint "src/app/orders/[id]/page.tsx"`
- `npx eslint "src/app/orders/new/page.tsx"`
- `npx tsc --noEmit --pretty false`

### Verification evidence
- Targeted ESLint passed on both edited order UI pages.
- Full repo type-check still reports unrelated pre-existing errors outside this UI slice:
  - `src/app/admin/quotes/[id]/page.tsx`
  - `src/app/api/admin/vendors/import/route.ts`
  - `src/app/api/print-analyzer/analyze/route.ts`
  - `src/lib/quote-part-pricing.ts`
  - `src/repos/index.ts`
  - `src/repos/mock/orders.ts`
  - `sterling-site/vite.config.ts`
- I treated those as baseline issues rather than regressions from this work.

### UI contract assumptions
- Checklist performer selection should stay client-side and continue sending `performedById` through the existing checklist routes.
- The instruction gate is per user + part + department version, so the UI should continue to re-open the brief only when the receipt is missing.
- Submit reconfirmation remains a client-side affordance only; the backend already logs the submit event and enforces the receipt check.

## Session Handoff - 2026-04-10 (Accountability backend only)

Goal (1 sentence): Finish the accountability backend slice only: part-worker assignments, instruction acknowledgements, checklist performer attribution, shared part activity read models, and backend gating without touching the UI.

### What changed
- Updated src/modules/orders/orders.service.ts
  - Added reusable checklist audit-message/event metadata shaping so actor vs performer are stored distinctly.
  - Added order-detail partActivity read-model shaping per part using shared time-entry summaries.
  - Finished part worker assignment service behavior and instruction acknowledgement/status helpers.
  - Enforced instruction acknowledgement gating for checklist toggles and department submit.
  - Extended last-checklist complete-and-advance flow to accept/store performedById and log the checklist action separately from department movement.
  - Tightened submit-department transaction usage so time adjustments and department changes use the same transaction client.
- Updated timer backend routes:
  - src/app/api/timer/start/route.ts now blocks timer start on missing instruction acknowledgement.
  - src/app/api/timer/resume/route.ts now applies the same gate before resuming a part-linked timer.
  - src/app/api/timer/active/route.ts now returns shared partActivity for requested part IDs.
- Updated src/app/api/orders/[id]/parts/[partId]/checklist/[itemId]/complete-and-advance/route.ts
  - Accepts optional performedById so the confirmed last-item completion path matches the normal checklist attribution contract.
- Updated src/modules/time/time.service.ts
  - Added getTimeEntryDetails() for safe route-level resume gating.
  - Added getPartActivitySummary() for cross-user active-timer and accumulated-time read models.
- Updated mock repos/seeds:
  - src/repos/mock/seed.ts
  - src/repos/mock/orders.ts
  - src/repos/mock/time.ts
  - Added seeded helper user, ack-gated part/checklist, part assignments, instruction receipts, and richer time-entry fixtures so focused backend tests cover the new contracts.
- Updated focused backend tests:
  - src/modules/orders/__tests__/orders.service.test.ts
  - src/modules/time/__tests__/time.service.test.ts

### Files touched
- src/modules/orders/orders.service.ts
- src/modules/time/time.service.ts
- src/app/api/timer/start/route.ts
- src/app/api/timer/resume/route.ts
- src/app/api/timer/active/route.ts
- src/app/api/orders/[id]/parts/[partId]/checklist/[itemId]/complete-and-advance/route.ts
- src/repos/mock/seed.ts
- src/repos/mock/orders.ts
- src/repos/mock/time.ts
- src/modules/orders/__tests__/orders.service.test.ts
- src/modules/time/__tests__/time.service.test.ts
- 	asks/todo.md
- PROGRESS_LOG.md
- docs/AGENT_HANDOFF.md

### Commands run
- 
pm run test -- src/modules/orders/__tests__/orders.service.test.ts
- 
pm run test -- src/modules/time/__tests__/time.service.test.ts
- 
pm run lint

### Verification evidence
- Focused Orders service tests passed (11/11).
- Focused Time service tests passed (7/7).
- 
pm run test -- src/modules/time/__tests__/time.service.test.ts required an outside-sandbox rerun because sandboxed Vitest/esbuild hit Windows spawn EPERM at startup.
- Lint passed with no ESLint warnings/errors.

### UI/backend integration assumptions
- Checklist mutation routes now support optional performedById; UI should send it whenever the operator marks work completed for someone else.
- /api/timer/start and /api/timer/resume now return the existing 409 error envelope with error.code = INSTRUCTION_ACK_REQUIRED when acknowledgement is missing; UI should intercept that and open the must-read modal instead of treating it as a generic conflict.
- /api/timer/active?orderId=...&partIds=... now returns additive partActivity data keyed by part ID; UI can consume it without breaking older fields.
- Order detail payloads now include part.partActivity plus part.assignments and part.instructionReceipts; UI can render shared-worker/time context directly from the existing order GET route.
- Department submit already writes a distinct DEPARTMENT_SUBMIT_CONFIRMED part event on every submit call; the UI still needs to own the fresh confirmation dialog before making that POST.
## Session Handoff - 2026-04-10 (Repeat-order backend only)

Goal (1 sentence): Finish the repeat-order template backend slice only, keeping the work scoped to template snapshot/list/fetch/create-order behavior plus minimal contract hardening.

### What changed
- Updated `src/modules/repeat-orders/repeat-orders.service.ts`
  - Repeat-order template snapshot no longer stores the source order PO as template notes.
  - Template-based order creation now rejects templates with no parts.
  - Duplicate or unknown `templatePartId` override rows now fail fast with `400` instead of being silently ignored/overwritten.
  - Provided order numbers now obey the same business-prefix validation used by normal order creation.
  - Successful template-based order creation still reuses the existing order post-create lifecycle helpers for checklist sync, current-department initialization, workflow sync, and canonical attachment copying.
- Added `src/modules/repeat-orders/__tests__/repeat-orders.service.test.ts`
  - Covers snapshot behavior, unknown template-part override rejection, invalid order-number rejection, and successful order creation from a template.
- Updated continuity docs and Decision Log for the repeat-order backend contract.

### Files touched
- `src/modules/repeat-orders/repeat-orders.service.ts`
- `src/modules/repeat-orders/__tests__/repeat-orders.service.test.ts`
- `docs/AGENT_CONTEXT.md`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npx eslint src/modules/repeat-orders/repeat-orders.service.ts src/modules/repeat-orders/repeat-orders.repo.ts src/modules/repeat-orders/repeat-orders.schema.ts src/modules/repeat-orders/repeat-orders.types.ts src/modules/repeat-orders/__tests__/repeat-orders.service.test.ts src/app/api/repeat-order-templates/route.ts src/app/api/repeat-order-templates/from-order/[orderId]/route.ts src/app/api/repeat-order-templates/[id]/route.ts src/app/api/repeat-order-templates/[id]/create-order/route.ts`
- `npm run test -- src/modules/repeat-orders/__tests__/repeat-orders.service.test.ts`

### Verification evidence
- ESLint passed on the touched repeat-order/API files with no reported issues.
- Focused repeat-order service tests passed (4/4).
- The test run required an outside-sandbox rerun because sandboxed Vitest/esbuild hit Windows `spawn EPERM`.

### Follow-up contract assumptions for UI/backend integration
- UI should treat template-level `notes` as explicit reusable defaults only; the backend no longer derives them from the source order PO.
- UI must send only known template part IDs in `parts[].templatePartId` when posting `/api/repeat-order-templates/[id]/create-order`.
- If UI supplies `orderNumber`, it must already match the business prefix format (for example `STD-1234` for `STD` templates).
- Attachment rows can continue to reference template storage paths at create time; the backend still runs canonical post-create file copying for the new order.

## Session Handoff — 2026-04-10 (Vendors contact/materials follow-up + rollback)

Goal (1 sentence): Make vendor contact/material data searchable as first-class fields and clear the partial spreadsheet import so the next import lands cleanly.

### What changed
- Updated `prisma/schema.prisma`
  - Added `Vendor.contact` and `Vendor.materials`.
- Added `prisma/migrations/20260410103000_add_vendor_contact_materials/migration.sql`
  - Applies the new Vendor columns.
- Updated `src/lib/zod.ts`
  - Added `contact` and `materials` to Vendor validation.
- Updated `src/app/api/admin/vendors/route.ts`
  - Vendors search now matches `contact` and `materials`.
- Updated `src/modules/vendors/vendor-import.ts`
  - Import preview now suggests `Contact` and `Material` columns.
  - Import row mapping now writes to `contact` and `materials` instead of stuffing those fields into `notes`.
- Updated `src/app/api/admin/vendors/import/route.ts`
  - Import endpoint now accepts `contactColumn` and `materialsColumn`.
  - Duplicate-update path now updates `contact` and `materials`.
- Updated `src/app/admin/vendors/client.tsx`
  - Added `contact` and `materials` to manual vendor CRUD.
  - Added importer mapping controls for `Contact` and `Materials`.
  - Expanded import result preview to show imported contact/material values.
- Operational cleanup
  - Audited vendor references before rollback and confirmed only `Grainger` was linked (via one `QuoteVendorItem`).
  - Deleted 37 unreferenced imported vendor rows, leaving the baseline seeded rows (`Grainger`, `McMaster-Carr`) in place.
- Updated continuity docs and added a Decision Log entry in `docs/AGENT_CONTEXT.md`.

### Files touched
- `prisma/schema.prisma`
- `prisma/migrations/20260410103000_add_vendor_contact_materials/migration.sql`
- `src/lib/zod.ts`
- `src/app/api/admin/vendors/route.ts`
- `src/modules/vendors/vendor-import.ts`
- `src/app/api/admin/vendors/import/route.ts`
- `src/app/admin/vendors/client.tsx`
- `docs/AGENT_CONTEXT.md`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npx prisma migrate dev`
- `npx prisma generate`
- vendor-reference audit via `node -`
- rollback delete script via `node -`
- `npm run lint`
- `npm run test -- src/modules/vendors/__tests__/vendor-import.test.ts`
- `node -` (real workbook preview parse + vendor post-rollback check)

### Verification evidence
- Lint passed with no ESLint warnings/errors.
- Focused Vendors importer test passed (1/1) outside sandbox.
- Prisma migration `20260410103000_add_vendor_contact_materials` applied successfully.
- `npx prisma generate` still hit a Windows file-lock rename `EPERM`, but the Prisma Client is usable and successfully queried `contact`/`materials` after the migration.
- Real workbook preview parse now suggests:
  - `Company -> name`
  - `Web page -> url`
  - `Phone -> phone`
  - `Contact -> contact`
  - `Material -> materials`
- Post-rollback vendor check confirmed only:
  - `Grainger`
  - `McMaster-Carr`

### Next steps
- [ ] User verify on `/admin/vendors` that search now feels right for `materials` and `contact`.
- [ ] Re-import the supplier workbook using the new `Contact`/`Materials` mappings.
- [ ] Optional follow-up: if filtering by material needs to be more than free-text search, add a dedicated material filter UI on the Vendors page.

## Session Handoff — 2026-04-10 (Vendors preview-and-map importer)

Goal (1 sentence): Add a safe Vendors import workflow that can preview and map spreadsheet columns before writing supplier data into the app's current Vendor schema.

### What changed
- Added `src/modules/vendors/vendor-import.ts`
  - Parses `.xls`, `.xlsx`, and `.csv` workbooks via `xlsx`.
  - Detects a likely header row, normalizes columns, suggests mappings, and shapes mapped Vendor rows for import.
- Added `src/app/api/admin/vendors/import/route.ts`
  - New admin-only import endpoint with two stateless actions:
    - `preview`: parse workbook, choose sheet/header row, return columns and preview rows,
    - `import`: reparse workbook with the chosen mapping and create/update vendors.
  - Supports duplicate handling by vendor name (`skip` or `update`).
- Updated `src/app/admin/vendors/client.tsx`
  - Added spreadsheet upload, sheet selection, header-row selection, raw preview, parsed preview, column mapping UI, duplicate-mode selection, and import-results summary.
  - Preserved the existing manual Vendors CRUD flow below the new importer.
- Added `src/modules/vendors/__tests__/vendor-import.test.ts`
  - Covers header-row detection.
- Updated continuity docs and added a Decision Log entry in `docs/AGENT_CONTEXT.md`.
- Installed dependency
  - `xlsx`

### Files touched
- `package.json`
- `package-lock.json`
- `src/app/admin/vendors/client.tsx`
- `src/app/api/admin/vendors/import/route.ts`
- `src/modules/vendors/vendor-import.ts`
- `src/modules/vendors/__tests__/vendor-import.test.ts`
- `docs/AGENT_CONTEXT.md`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npm install xlsx`
- `npm run lint`
- `npm run test -- src/modules/vendors/__tests__/vendor-import.test.ts`
- `node -` (real workbook preview parse against `C:\Users\user\Downloads\Suppliers.xls`)

### Verification evidence
- Lint passed with no ESLint warnings/errors.
- Focused Vendors importer test passed (1/1) after rerunning outside sandbox because Vitest/esbuild hit sandbox `spawn EPERM`.
- Real preview parse of `C:\Users\user\Downloads\Suppliers.xls` succeeded with:
  - selected sheet `Steel Suppliers`,
  - header row `1`,
  - columns `Company`, `Phone`, `Contact`, `Web page`, `Material`,
  - suggested mapping `Company -> name`, `Web page -> url`, `Phone -> phone`, `Contact -> notes`.

### Next steps
- [ ] User verify on `/admin/vendors` that the preview/import UI feels right with the real workbook and the chosen mappings.
- [ ] Optional follow-up: if the shop needs category/contact/email/fax/address as first-class fields instead of folded notes, expand the `Vendor` schema before a full production import.

## Session Handoff — 2026-04-10 (BOM analyzer oversized-image stack-overflow fix)

Goal (1 sentence): Make large image uploads stop crashing the BOM analyzer route and complete successfully through the existing analysis flow.

### What changed
- Updated `src/app/api/print-analyzer/analyze/route.ts`
  - Replaced the regex-based `data:` URL parser with a delimiter-based parser after isolating the stack overflow to `decodeDataUrl()` for multi-megabyte base64 payloads.
  - Removed the route's server-side image data-URL roundtrip so normalized uploads stay as raw `Buffer`s after request parsing.
  - Switched OpenAI vision requests from inline base64 `image_url` payloads to uploaded OpenAI files using `purpose: vision` and Responses `input_image.file_id`.
  - Added best-effort cleanup of the temporary OpenAI files after each analyzer request.
- Updated `tasks/lessons.md`
  - Added a prevention rule covering regex parsing of large base64 `data:` URLs in route handlers.

### Files touched
- `src/app/api/print-analyzer/analyze/route.ts`
- `tasks/todo.md`
- `tasks/lessons.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npm run lint`
- local oversized-image POST to `http://127.0.0.1:3000/api/print-analyzer/analyze`

### Verification evidence
- Lint passed with no ESLint warnings/errors.
- A locally generated `~5.9 MB` JPEG that previously returned `502` with `Maximum call stack size exceeded` now returns `200` with structured analyzer JSON in about `29.7s`.

### Next steps
- [ ] User verify in the BOM tab or `/private/print-analyzer` that the previously failing real-world image now analyzes successfully.

## Session Handoff — 2026-04-10 (Repair stale local dev server on port 3000)

Goal (1 sentence): Recover the broken local Next dev server on port `3000` so admin quote print works again without the webpack/runtime crash.

### What changed
- Operational recovery only; no source files changed for the quote print page itself.
- Confirmed the current quote print code path was healthy on a fresh dev server:
  - `/admin/quotes/cmnsw7c34000tq7rcbjgn7aeq/print` returned `200` on a fresh server at `3001`.
- Confirmed the existing `3000` server had a broken local build state:
  - same route returned `500`,
  - failure text referenced a missing `.next/server/...` file (`ENOENT`), consistent with a stale/corrupted dev build.
- Stopped the stale Next process on `3000` and restarted the workspace dev server on `3000`.

### Files touched
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- local auth + quote print probes against `http://127.0.0.1:3001` and `http://127.0.0.1:3000`
- `Stop-Process -Id 41880 -Force`
- restarted local dev server on port `3000`

### Verification evidence
- After restart, authenticated request to `http://127.0.0.1:3000/admin/quotes/cmnsw7c34000tq7rcbjgn7aeq/print` returned `200`.

### Next steps
- [ ] User verify the browser tab on the live `3000` app no longer shows the quote print webpack/runtime error.

## Session Handoff — 2026-04-10 (LAN/IP-safe post-sign-in redirect)

Goal (1 sentence): Keep successful credential sign-ins on the browser's active LAN/IP origin instead of bouncing back to localhost.

### What changed
- Updated `src/app/(public)/auth/signin/page.tsx`
  - Changed the credential sign-in submit flow from `redirect: true` to `redirect: false`.
  - On success, the page now manually navigates to the normalized relative `callbackUrl` with `window.location.assign(callbackUrl)`.
  - Preserved existing callback sanitization so only safe in-app relative destinations are used.

### Files touched
- `src/app/(public)/auth/signin/page.tsx`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npm run lint`

### Verification evidence
- Lint passed with no ESLint warnings/errors.

### Next steps
- [ ] User verify that signing in from the LAN/IP-hosted app now returns to the same IP-based origin instead of `localhost`.

## Session Handoff — 2026-04-09 (Order-detail submit dialog label correction)

Goal (1 sentence): Make the move-dialog confirm button always reflect the destination department the operator actually selected.

### What changed
- Updated `src/app/orders/[id]/page.tsx`
  - Replaced the dialog confirm-button label source so it now reads from `moveDepartmentDialog.destinationDepartmentId`.
  - The button copy now updates live with the dialog selection (`Submit to Shipping`, etc.) instead of staying tied to the default next-department helper.
- Updated `tasks/lessons.md`
  - Added a prevention rule covering stale action labels in selection-driven dialogs/forms.

### Files touched
- `src/app/orders/[id]/page.tsx`
- `tasks/lessons.md`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npm run lint`

### Verification evidence
- Lint passed with no ESLint warnings/errors.

### Next steps
- [ ] User verify on `/orders/[id]` that changing the dialog destination immediately updates the confirm button label to the same department.

## Session Handoff — 2026-04-09 (Order-detail submit dialog cleanup)

Goal (1 sentence): Remove the redundant submit destination control from the order-detail dock so `Submit To` opens a single dialog that clearly shows the current department and lets the operator choose the destination there.

### What changed
- Updated `src/app/orders/[id]/page.tsx`
  - Removed the dock-level submit destination dropdown and its extra local state.
  - `Submit To` now opens the move dialog directly.
  - The dialog now shows the current department in a dedicated summary block at the top.
  - The dialog destination list now contains only valid non-current departments, so operators are not asked to pick the same department twice.

### Files touched
- `src/app/orders/[id]/page.tsx`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npm run lint`

### Verification evidence
- Lint passed with no ESLint warnings/errors.

### Next steps
- [ ] User verify on `/orders/[id]` that `Submit To` now feels cleaner: one button in the dock, current department shown at top of the dialog, destination chosen only inside the dialog.

## Session Handoff — 2026-04-09 (Dashboard current-department label consistency)

Goal (1 sentence): Make dashboard/order summary cards stop calling active work `Unassigned` when the order-detail workflow already treats that part as belonging to the first department.

### What changed
- Updated `src/components/ShopFloorLayouts.tsx`
  - `currentDepartmentLabelsByOrder` now falls back to the first ordered department name for non-complete orders when a part still has null `currentDepartmentId`.
  - Completed/closed orders still skip that fallback so finished work does not get an invented active department label.

### Files touched
- `src/components/ShopFloorLayouts.tsx`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npm run lint`

### Verification evidence
- Lint passed with no ESLint warnings/errors.

### Next steps
- [ ] User verify that the dashboard/order summary card now shows `Machining` (or the current first department) instead of `Unassigned` for new/received work.

## Session Handoff — 2026-04-09 (Order-detail timer context link + compact submit control)

Goal (1 sentence): Make the order-detail work dock tell operators exactly where another live timer is running and replace the overflowing `Submit to <Department>` label with a compact, reliable submit-destination control.

### What changed
- Updated `src/app/api/timer/active/route.ts`
  - Enriched `activeEntries` with order/part context and an `href` for each active timer entry.
  - Deep links now point to `/orders/{id}?part={partId}` when the timer belongs to a specific part.
- Updated `src/app/orders/[id]/page.tsx`
  - Added `useSearchParams()` handling so the page can preselect a part from `?part=...`.
  - Replaced the passive `Other timer live` badge with a clickable control that opens the active timer context.
  - Added a compact `Submit To` destination dropdown in the dock and kept the existing note-required move dialog as the actual submit confirmation path.

### Files touched
- `src/app/api/timer/active/route.ts`
- `src/app/orders/[id]/page.tsx`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npm run lint`

### Verification evidence
- Lint passed with no ESLint warnings/errors.

### Next steps
- [ ] User verify on `/orders/[id]` that clicking `Other timer live` lands on the right order/part and feels obvious enough on the floor.
- [ ] User verify the new `Submit To` dropdown/button layout feels better with longer department names and still matches the manual move workflow.

## Session Handoff — 2026-04-08 (Unraid Docker app template refresh)

Goal (1 sentence): Refresh the existing Unraid Docker app template and guide so Unraid install settings match the current ShopApp1 container requirements.

### What changed
- Updated `unraid/my-shopapp1.xml`
  - Renamed the container label to `ShopApp1`.
  - Added `Support`, `Project`, and `TemplateURL` metadata.
  - Refreshed the overview text to reflect current app scope and storage expectations.
  - Added optional advanced `OPENAI_API_KEY` variable for the Print Analyzer / BOM AI feature.
- Rewrote `unraid/README.md`
  - Documented offline image build/load steps.
  - Documented Unraid template install/import path.
  - Listed required env values and recommended defaults.
  - Clarified persistent path mappings and first-run seed commands.

### Files touched
- `unraid/my-shopapp1.xml`
- `unraid/README.md`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `git diff -- unraid/my-shopapp1.xml unraid/README.md`

### Verification evidence
- Reviewed the Unraid template/docs diff to confirm the template now reflects current env variables, storage paths, and optional OpenAI configuration.
- No app-code/runtime files changed, so no lint/test run was required for this docs/template-only scope.

### Next steps
- [ ] If desired, commit/push the Unraid template refresh once the user is happy with the field names/defaults.
- [ ] Optional follow-up: publish `shopapp1:latest` to a registry and update the template repository field away from offline/local image workflow.

## Session Handoff — 2026-04-08 (Dashboard department visibility follow-up)

Goal (1 sentence): Make current department ownership obvious across dashboard tiles and order detail, and fix dashboard display logic so department work queue reflects actual department ownership.

### What changed
- Updated `src/modules/orders/orders.repo.ts`
  - Department feed query now treats `currentDepartmentId` as the ownership signal for work-queue visibility.
  - Non-completed filtering now uses part status rather than requiring open checklist rows in the selected department.
  - Dashboard overview part selections now include `partNumber` for richer client display.
- Updated `src/repos/mock/orders.ts`
  - Kept mock department-feed behavior aligned with the new `currentDepartmentId` ownership rule.
- Updated `src/components/ShopFloorLayouts.tsx`
  - Fixed initial-department refresh behavior so `Include completed` refetches correctly even for the initially selected department.
  - Grid digest cards now show:
    - parts count,
    - checklist progress,
    - current department ownership,
    - departments touched.
- Updated `src/components/work-queue/WorkQueueOrderCard.tsx`
  - Added selected department badge, latest activity, and per-part current department labels.
- Updated `src/app/orders/[id]/page.tsx`
  - Added current department to selected-part Overview.
  - Added current department to each part tile in the left-side part list.
- Added focused test coverage in `src/modules/orders/__tests__/orders.service.test.ts`
  - Confirms Machining department feed includes a part because Machining currently owns it, even without Machining checklist rows.
- Updated continuity docs and added Decision Log entry in `docs/AGENT_CONTEXT.md`.

### Files touched
- `src/modules/orders/orders.repo.ts`
- `src/modules/orders/orders.service.ts`
- `src/modules/orders/orders.types.ts`
- `src/repos/mock/orders.ts`
- `src/components/ShopFloorLayouts.tsx`
- `src/components/work-queue/WorkQueueOrderCard.tsx`
- `src/app/orders/[id]/page.tsx`
- `src/modules/orders/__tests__/orders.service.test.ts`
- `docs/AGENT_CONTEXT.md`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npm run test -- src/modules/orders/__tests__/orders.service.test.ts`
- `npm run lint`

### Verification evidence
- Targeted Orders service tests passed (6/6).
- Lint passed with no ESLint warnings/errors.

### Next steps
- [ ] User verify on Dashboard that Work queue now shows the Machining-owned order/part and that the added card details feel right.
- [ ] Optional follow-up: add a `Current department` column to the `By machinist` table if department ownership should also be visible in that layout.

## Session Handoff — 2026-04-08 (Order-detail department UX follow-up)

Goal (1 sentence): Replace the raw department-ID prompt with an in-app move dialog, restore department dropdown options on order detail, and default unassigned parts to the first active department.

### What changed
- Updated `src/app/orders/[id]/page.tsx`
  - Replaced the manual department `window.prompt` flow with a site-native `Dialog`.
  - Manual move now uses a destination department dropdown plus the required move note inline.
  - Timer department choices now come from the ordered active department list returned by the server, excluding Shipping.
  - Selected timer department now auto-defaults to the part’s current department when available, otherwise to the first timer-eligible department.
- Updated `src/modules/orders/orders.service.ts`
  - `getOrderDetails()` now returns `departments` alongside the order payload.
  - Order detail read model now falls back to the first active department when a part has no explicit/current routed department yet.
  - `initializeCurrentDepartmentForParts()` now uses the first active department as fallback when checklist routing yields no department.
- Updated `src/modules/orders/orders.repo.ts`
  - Included part `status` in the missing-current-department query so backfill can skip already completed parts.
- Added focused test coverage in `src/modules/orders/__tests__/orders.service.test.ts`
  - Verifies unassigned parts fall back to the first active department (`Machining` in current ordering).
- Updated continuity docs and added a Decision Log entry in `docs/AGENT_CONTEXT.md`.

### Files touched
- `src/app/orders/[id]/page.tsx`
- `src/modules/orders/orders.service.ts`
- `src/modules/orders/orders.repo.ts`
- `src/modules/orders/__tests__/orders.service.test.ts`
- `docs/AGENT_CONTEXT.md`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npm run test -- src/modules/orders/__tests__/orders.service.test.ts`
- `npm run lint`

### Verification evidence
- Targeted Orders service tests passed (5/5).
- Initial test attempt failed inside sandbox with Vitest/esbuild `spawn EPERM`; rerun outside sandbox passed.
- Lint passed with no ESLint warnings/errors.

### Next steps
- [ ] User verify on `/orders/[id]` that the timer department dropdown now shows departments immediately and defaults to Machining/current department as expected.
- [ ] User verify the new move dialog feels right and that the required note copy/fields match shop-floor expectations.

## Session Handoff — 2026-04-08 (Quote print totals parity hotfix)

Goal (1 sentence): Make the quote print view use the same non-double-counted part-pricing totals rule as quote editor and quote detail.

### What changed
- Updated `src/app/admin/quotes/[id]/print/page.tsx`
  - Replaced stacked total math with the shared pricing-summary replacement rule.
  - Parts with non-zero part-pricing entries now contribute to `Part pricing` instead of also remaining inside the raw part add-on/labor subtotal.

### Files touched
- `src/app/admin/quotes/[id]/print/page.tsx`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npm run lint`

### Verification evidence
- Lint passed with no ESLint warnings/errors.

### Next steps
- [ ] User verify in `/admin/quotes/[id]/print` that totals now match both quote editor and quote detail.

---

## Session Handoff — 2026-04-08 (View quote totals parity hotfix)

Goal (1 sentence): Make the admin quote detail Totals card use the same non-double-counted part-pricing math as the quote editor.

### What changed
- Updated `src/app/admin/quotes/[id]/page.tsx`
  - Replaced stacked total math with the shared pricing-summary replacement rule already used in `QuoteEditor`.
  - Parts with non-zero part-pricing entries now contribute to `Part pricing (basis-adjusted)` instead of also remaining in `Add-ons and labor`.
  - Legacy quote-level add-on selections still remain in `Add-ons and labor`.

### Files touched
- `src/app/admin/quotes/[id]/page.tsx`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npm run lint`

### Verification evidence
- Lint passed with no ESLint warnings/errors.

### Next steps
- [ ] User verify on `/admin/quotes/[id]` that the Totals card now shows the same values as the quote editor for the same quote.

---

## Session Handoff — 2026-04-08 (Quote part-pricing autofill follow-up)

Goal (1 sentence): Auto-fill the part-pricing input from the part's assigned work subtotal so users only need to choose lot-total vs per-unit unless they want to override the amount.

### What changed
- Updated `src/app/admin/quotes/QuoteEditor.tsx`
  - Extended local `partPricing` state with an `isManual` flag.
  - Part-pricing rows now auto-populate from the current assigned add-ons/labor subtotal for each part.
  - Auto-fill keeps tracking assignment changes until the input is manually edited, at which point the entered value is preserved.

### Files touched
- `src/app/admin/quotes/QuoteEditor.tsx`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npm run lint`

### Verification evidence
- Lint passed with no ESLint warnings/errors.

### Next steps
- [ ] User verify in UI that the part-pricing input now starts with the assigned subtotal (for example `$245.00`) before toggling `LOT_TOTAL` vs `PER_UNIT`.

---

## Session Handoff — 2026-04-08 (Quote summary double-count hotfix)

Goal (1 sentence): Fix quote-review total math so basis-adjusted part pricing does not stack on top of the same part's raw add-on/labor subtotal.

### What changed
- Updated `src/app/admin/quotes/QuoteEditor.tsx`
  - Reworked summary total calculation to split per-part raw work-item subtotals from per-part pricing overrides.
  - When a part has a non-zero entered part-pricing value, that part now contributes only to `Part pricing (basis-adjusted)` and no longer remains in `Add-ons and labor`.
- Updated `src/modules/pricing/work-item-pricing.ts`
  - Added `calculatePartPricingSummaryTotalsCents` helper to keep the bucket-replacement rule explicit.
- Added focused tests in `src/modules/pricing/__tests__/work-item-pricing.test.ts`
  - Covers the case where a basis-adjusted part-pricing total should replace, not stack with, the raw subtotal.

### Files touched
- `src/app/admin/quotes/QuoteEditor.tsx`
- `src/modules/pricing/work-item-pricing.ts`
- `src/modules/pricing/__tests__/work-item-pricing.test.ts`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npm run test -- src/modules/pricing/__tests__/work-item-pricing.test.ts`
- `npm run lint`

### Verification evidence
- Targeted work-item pricing tests passed.
- Lint passed with no ESLint warnings/errors.

### Next steps
- [ ] User verify in UI that entering `245` with `PER_UNIT` on quantity `3` now yields `Add-ons and labor = $0.00`, `Part pricing = $735.00`, and `Total estimate = $735.00` for that single-part scenario.

---

## Session Handoff — 2026-04-08 (QuoteEditor activePart hotfix)

Goal (1 sentence): Fix the admin quote editor runtime crash caused by referencing `activePart` before its initialization.

### What changed
- Updated `src/app/admin/quotes/QuoteEditor.tsx`
  - Reworked the selected-assignment pruning effect to derive the current active part from `parts` and `activePartKey` inside the hook instead of closing over `activePart` before that memoized binding is declared.
  - Preserved existing behavior: selected assignment keys are still trimmed to only those that exist on the current active part.

### Files touched
- `src/app/admin/quotes/QuoteEditor.tsx`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npm run lint`

### Verification evidence
- Lint passed with no ESLint warnings/errors.

### Next steps
- [ ] User verify in UI that `/admin/quotes/new` and quote edit flows no longer throw the `activePart` initialization error when the editor mounts.

---

## Session Handoff — 2026-04-08 (Structured Quote Document Editor v1)

Goal (1 sentence): Deliver a structured, template-driven quote document editor so admins can configure block visibility/labels/styles/options and have quote print/save output follow those settings.

### What changed
- Extended layout schema handling:
  - `src/lib/document-template-layout.ts`
  - Added structured `blocks[]` support (`id`, `type`, `label`, `visible`, `order`, `variant`, `options`) while preserving legacy `sections[]` parsing fallback.
- Added quote print render-planning helper:
  - `src/lib/quote-print-layout.ts`
  - Maps normalized template blocks to quote render block types and pricing options.
- Updated admin template editor UI:
  - `src/app/admin/templates/TemplatesClient.tsx`
  - Canvas now edits blocks (not only section labels) and supports:
    - show/hide,
    - label overrides,
    - variant preset (`standard`/`compact`),
    - pricing block toggles (`showUnitPrice`, `showQuantity`, `showLineTotal`, `showPricingMode`).
  - Save payload now writes both `sections` (legacy compatibility) and `blocks` (structured model).
- Updated quote print output rendering:
  - `src/app/admin/quotes/[id]/print/page.tsx`
  - Rendering now consumes normalized structured blocks; pricing section table columns/mode row visibility respond to template options.

### Tests
- Added `src/lib/__tests__/document-template-layout.test.ts` (legacy normalization + structured ordering behavior).
- Added `src/lib/__tests__/quote-print-layout.test.ts` (render-block mapping + visibility/options behavior).

### Files touched
- `src/lib/document-template-layout.ts`
- `src/lib/quote-print-layout.ts`
- `src/lib/__tests__/document-template-layout.test.ts`
- `src/lib/__tests__/quote-print-layout.test.ts`
- `src/app/admin/templates/TemplatesClient.tsx`
- `src/app/admin/quotes/[id]/print/page.tsx`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npm run test -- src/lib/__tests__/document-template-layout.test.ts src/lib/__tests__/quote-print-layout.test.ts`
- `npm run lint`

### Verification evidence
- Targeted tests passed (2 files, 4 tests).
- Lint passed with no ESLint warnings/errors.

### Next steps (post-MVP polish)
- Optional: add compact-variant visual style deltas beyond table font sizing for richer preset differences.
- Optional: add UI integration tests for template builder interactions (drag/reorder + option toggles -> payload assertions).

---

## Session Handoff — 2026-04-08 (Phase 3 quick convert)

Goal (1 sentence): Implement admin quote-detail “Quick Convert” that captures only essential overrides and converts directly to order detail without sending users through `/orders/new` wizard steps.

### What changed
- Added quick convert dialog component:
  - `src/components/Admin/QuoteQuickConvertDialog.tsx`
  - Required fields: due date, priority (default NORMAL), assigned machinist.
  - Optional fields: PO number, vendor ID, material-needed, material-ordered, model-included.
  - Client-side validation + inline failure messaging.
  - Submits overrides to existing conversion API and redirects to `/orders/{orderId}` on success.
- Updated quote detail page trigger:
  - Added `Quick Convert` action on `/admin/quotes/[id]`.
  - Kept workflow approval/conversion status controls, but disabled legacy detail-page wizard-convert button (`showConvertAction={false}`) so quick path is the primary conversion UX there.
- Conversion route resilience:
  - Updated already-converted idempotency message fallback to use `orderId` when `orderNumber` is missing.

### Tests
- Added `src/components/Admin/__tests__/QuoteQuickConvertDialog.test.ts` covering quick-convert submit payload validation behavior.
- Extended `src/app/api/admin/quotes/[id]/convert/__tests__/route.test.ts` with invalid `dueDate` edge handling check.

### Files touched
- `src/components/Admin/QuoteQuickConvertDialog.tsx`
- `src/components/Admin/__tests__/QuoteQuickConvertDialog.test.ts`
- `src/app/admin/quotes/[id]/page.tsx`
- `src/app/admin/quotes/QuoteWorkflowControls.tsx`
- `src/app/api/admin/quotes/[id]/convert/route.ts`
- `src/app/api/admin/quotes/[id]/convert/__tests__/route.test.ts`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npm run test -- src/components/Admin/__tests__/QuoteQuickConvertDialog.test.ts src/app/api/admin/quotes/[id]/convert/__tests__/route.test.ts`
- `npm run lint`

### Verification evidence
- Targeted tests passed (2 files, 6 tests total).
- Lint passed with no ESLint warnings/errors.

### Next agent prompt
"Validate quick-convert UX on `/admin/quotes/[id]` with seeded data (approval present + customer set), and add one focused interaction-level component test (mock fetch success/error) for dialog submit/disable behavior if project test harness is expanded for client component rendering. Keep scope to testing/UX polish only; do not alter conversion business rules."

---

## Session Handoff — 2026-04-08 (Quote pricing presentation Phase 2)

Goal (1 sentence): Implement Phase 2 quote pricing presentation alignment so Quote Creator + review/print surfaces show explicit Unit Price, Qty, and Line Total rows per part while preserving existing `PER_UNIT`/`LOT_TOTAL` math contract and payload persistence behavior.

### What changed
- Quote Creator (`src/app/admin/quotes/QuoteEditor.tsx`)
  - Updated per-part pricing rows to explicit review fields: Entered price, Unit price, Qty, Line total.
  - Kept mode toggle behavior and surfaced mode text inline for clarity.
- Quote detail review (`src/app/admin/quotes/[id]/page.tsx`)
  - Added per-part Unit price / Qty / Line total / Pricing mode display in part cards.
  - Updated email pricing summary generation to `Unit × Qty = Line Total (mode)` formatting.
- Quote print view (`src/app/admin/quotes/[id]/print/page.tsx`)
  - Updated Part pricing table columns to Unit price, Qty, Line total and mode display.
  - Updated part pricing section summary row to Part pricing total.
- Pricing helper/tests
  - Added `calculatePartUnitPrice` in `src/modules/pricing/part-pricing.ts`.
  - Expanded `src/modules/pricing/__tests__/part-pricing.test.ts` to cover display-unit derivation invariants.

### Files touched
- `src/modules/pricing/part-pricing.ts`
- `src/modules/pricing/__tests__/part-pricing.test.ts`
- `src/app/admin/quotes/QuoteEditor.tsx`
- `src/app/admin/quotes/[id]/page.tsx`
- `src/app/admin/quotes/[id]/print/page.tsx`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npm run test -- src/modules/pricing/__tests__/part-pricing.test.ts`
- `npm run lint`

### Verification evidence
- Targeted pricing unit tests passed (6/6).
- Lint passed with no ESLint warnings/errors.

### Scope/contract notes
- No payload schema changes introduced.
- Persisted quote `partPricing` data contract (`priceCents` + `pricingMode`) remains unchanged.
- Display unit-price derivation is read-model only and intentionally mode-aware (`LOT_TOTAL` derives display unit by lot/qty; `PER_UNIT` uses entered value directly).

### Next steps
- [ ] Optional: add a focused UI test for Quote Detail/Print part-pricing row rendering if snapshot/UI harness is introduced.
- [ ] Begin next approved quote workflow phase after owner validation of Phase 2 presentation expectations.

---

Date: 2026-04-08
Agent: GPT-5.3-Codex
Goal (1 sentence): Deliver Phase 1 Quote Creator productivity upgrades: selected-item bulk apply/copy across parts plus reusable presets.

## What I changed
- Added new Quote bulk-helper module `src/modules/quotes/quote-addon-bulk.ts`:
  - `dedupePresetItems` for addon-id uniqueness,
  - `buildPresetFromSelections` for selected-row extraction,
  - `mergeSelectionsWithoutDuplicates` for target-merge behavior.
- Added focused helper tests `src/modules/quotes/__tests__/quote-addon-bulk.test.ts` (3 tests).
- Updated `src/app/admin/quotes/QuoteEditor.tsx` build-step UX:
  - assignment row checkbox selection controls,
  - `Select all` / `Clear` selection actions,
  - `Apply selected to all parts` action (merge/no duplicates),
  - copy-target selector + `Copy selected items` action,
  - preset save/apply/delete controls,
  - local preset persistence (`quote-addon-presets-v1`).
- Added state hygiene guards:
  - clear assignment selection on active part switch,
  - prune stale selected keys after assignment edits,
  - reset copy target to `ALL` if selected part disappears.

## Files touched
- `src/app/admin/quotes/QuoteEditor.tsx`
- `src/modules/quotes/quote-addon-bulk.ts`
- `src/modules/quotes/__tests__/quote-addon-bulk.test.ts`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

## Commands run
- `npm run test -- src/modules/quotes/__tests__/quote-addon-bulk.test.ts`
- `npm run lint`

## Verification Evidence
- Targeted quote bulk helper tests passed (3/3).
- Lint passed with no ESLint warnings/errors.

## Next-step guidance for next agent (Phase 2 prompt)
**Prompt to next agent:**
"Implement Phase 2 for Quote rework: update Quote Creator and Review pricing presentation to show explicit Unit Price, Qty, and Line Total rows per part; preserve existing `PER_UNIT`/`LOT_TOTAL` math contract and ensure print/save outputs remain template-driven/customizable. Keep scope to quote pricing display + payload/read-model consistency only, add focused tests, run lint, and update continuity docs."

## Notes / caveats
- Presets currently persist per-browser via localStorage; they are not server-shared yet.
- Bulk merge dedupe key is `addonId` only (intended by current requirement).
- Selected-item copy/apply preserves selected item units/notes from source part.

---

Date: 2026-04-08
Agent: GPT-5.3-Codex
Goal (1 sentence): Rework department movement to manual-only transitions, keep timers department-bound, and require Shipping for manual part completion.

## What I changed
- Removed checklist-driven automatic department transition side effects from `toggleChecklistItem`; checklist check/uncheck no longer changes `currentDepartmentId`.
- Updated Order Detail page manual flow:
  - Replaced auto-advance submit behavior with destination+note prompt.
  - New flow calls `POST /api/orders/[id]/parts/assign-department` with required move note.
  - Removed reopen/backward reason prompt coupling from checklist checkbox toggles.
- Added shipping-only manual completion enforcement in `completeOrderPart`:
  - rejects completion unless part is currently in Shipping,
  - keeps existing all-checklist-items-complete guard.
- Tightened server validations for manual transitions to require `reasonText` (note) in:
  - `assign-department` API route + service,
  - `transition` API route + service.
- Added targeted Orders service test for Shipping completion gate.

## Files touched
- `src/modules/orders/orders.service.ts`
- `src/app/orders/[id]/page.tsx`
- `src/app/api/orders/[id]/parts/assign-department/route.ts`
- `src/app/api/orders/[id]/parts/transition/route.ts`
- `src/modules/orders/__tests__/orders.service.test.ts`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

## Commands run
- `npm run test -- src/modules/orders/__tests__/orders.service.test.ts`
- `npm run lint`

## Verification Evidence
- Targeted Orders service test file passed (4 tests).
- Lint passed with no ESLint warnings/errors.

## Next steps
- [ ] Optional UX follow-up: replace prompt-based destination entry with a modal/select control to avoid manual department-ID typing.
- [ ] Confirm production data has active Shipping department in all businesses to avoid completion dead-ends.

---

Date: 2026-04-08
Agent: GPT-5.3-Codex
Goal (1 sentence): Fix the `/orders/new` runtime crash caused by a missing `formatCurrency` helper reference.

## What I changed
- Restored a local `formatCurrency(cents)` helper in `src/app/orders/new/page.tsx` so all review-step `renderMeta` and totals usages resolve at runtime.
- Kept fix limited to the missing symbol with no additional functional changes.

## Files touched
- `src/app/orders/new/page.tsx`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

## Commands run
- `npm run lint`

## Verification Evidence
- `npm run lint` passed (`✔ No ESLint warnings or errors`).

## Next steps
- [ ] User verify in UI that `/orders/new` review step no longer throws `ReferenceError`.

---

Date: 2026-04-08
Agent: GPT-5.3-Codex
Goal (1 sentence): Make quote view and print invoice totals carry over the same basis-adjusted pricing amount shown during quote review.

## What I changed
- Updated `src/app/admin/quotes/[id]/page.tsx` to:
  - compute `partPricingTotal` using `calculatePartLotTotal` per part quantity + pricing mode,
  - include a `Part pricing (basis-adjusted)` row,
  - compute/display `Total estimate` from recalculated aggregate (`base + vendor + add-ons + part pricing`).
- Updated `src/app/admin/quotes/[id]/print/page.tsx` to:
  - compute `partPricingTotal` with the same helper,
  - include part pricing in totals summary,
  - include part pricing in print grand total.
- Updated continuity artifact `tasks/todo.md` with plan + verification completion for this scoped fix.

## Files touched
- `src/app/admin/quotes/[id]/page.tsx`
- `src/app/admin/quotes/[id]/print/page.tsx`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

## Commands run
- `npm run lint`

## Verification Evidence
- `npm run lint` passed (`✔ No ESLint warnings or errors`).

## Next steps
- [ ] User verification in UI: confirm quote review total now matches both quote detail and print invoice totals for PER_UNIT and LOT_TOTAL rows.

---

Date: 2026-04-08
Agent: GPT-5.3-Codex
Goal (1 sentence): Stabilize the prior quote/order pricing-basis PR by reconciling unresolved inline feedback and fixing persistence/projection correctness drift.

## What I changed
- Added a fresh Phase-0 unresolved-comment reconciliation checklist and full gap audit/verification matrix in `tasks/todo.md` before implementation.
- Fixed quote payload integrity in `QuoteEditor`:
  - `partPricing.priceCents` now persists the entered value directly.
  - `pricingMode` persists unchanged (`PER_UNIT` or `LOT_TOTAL`).
  - Lot-total math remains runtime-derived from canonical helper.
- Switched quote edit preload to use `getPartPricingEntries` identity-aware mapping (part number/name first, index fallback) to prevent row/value drift when part ordering differs.
- Hardened `getPartPricingEntries` for backward compatibility:
  - defaults missing legacy `pricingMode` to `LOT_TOTAL`
  - uses addon totals only as fallback when no stored entry can be matched.
- Added targeted tests for:
  - pricing-mode toggle determinism
  - quote metadata stringify/parse round-trip preservation
  - projection matching by part identity + legacy mode fallback

## Files touched
- `src/app/admin/quotes/QuoteEditor.tsx`
- `src/lib/quote-part-pricing.ts`
- `src/modules/pricing/__tests__/part-pricing.test.ts`
- `src/lib/__tests__/quote-part-pricing.test.ts`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

## Commands run
- `gh pr view 153 --comments` *(fails: `gh` CLI unavailable in environment)*
- `npm run lint`
- `npm run test`

## Verification Evidence
- `npm run lint` passed (no ESLint warnings/errors).
- `npm run test` passed (15 files / 46 tests).

## Next steps
- [ ] If direct GitHub PR comment retrieval is required in future sessions, install/configure `gh` or provide exported review threads in-repo.
- [ ] Optional: add UI-level integration tests around QuoteEditor row-level pricing-mode interactions.

---

Date: 2026-04-07
Agent: GPT-5.3-Codex
Goal (1 sentence): Close the review-comment gate first, then restore admin quote discoverability and add per-part pricing basis controls across quote and order review flows.

## What I changed
- Added a mandatory review-comment gate artifact at the top of `tasks/todo.md`:
  - mapped each unresolved PR ask to comment IDs (`PR-REV-001` .. `PR-REV-007`), target files, resolution strategy, and disposition.
- Restored admin quote discoverability:
  - Added `View Quotes` link in Admin `Quote & Order Ops` nav tab group.
  - Added `View Quotes` card link in Admin Center `Quote & Order Ops` section.
- Implemented quote per-part pricing basis controls:
  - Added `pricingMode` enum support to quote schema (`PER_UNIT` | `LOT_TOTAL`).
  - Added shared pricing helper `calculatePartLotTotal` in `src/modules/pricing/part-pricing.ts`.
  - Added per-part review rows in Quote Editor with entered price + `PER_UNIT` toggle + live lot totals.
  - Persisted pricing basis to quote metadata `partPricing` entries and reloads in edit flow.
  - Updated quote summary totals to include a separate `Part pricing (basis-adjusted)` line item.
- Implemented order-review equivalent controls (`/orders/new`):
  - Added per-part entered price + mode toggle rows with immediate summary updates.
  - Added explicit note that order-side pricing basis is review-transient and not persisted.
- Updated quote metadata and projection helpers to carry `pricingMode` values.
- Added focused unit tests for new mode math behavior.
- Added Decision Log entry codifying pricing model choice (coexist line item, quote persisted, order transient).

## Files touched
- `src/components/Admin/NavTabs.tsx`
- `src/app/admin/page.tsx`
- `src/modules/quotes/quotes.schema.ts`
- `src/lib/quote-metadata.ts`
- `src/lib/quote-part-pricing.ts`
- `src/modules/quotes/quotes.repo.ts`
- `src/app/api/admin/quotes/[id]/route.ts`
- `src/app/admin/quotes/QuoteEditor.tsx`
- `src/app/orders/new/page.tsx`
- `src/modules/pricing/part-pricing.ts`
- `src/modules/pricing/__tests__/part-pricing.test.ts`
- `docs/AGENT_CONTEXT.md`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

## Commands run
- `npm run lint`
- `npm run test -- src/modules/pricing/__tests__/part-pricing.test.ts`
- `npm run test -- src/modules/pricing/__tests__/work-item-pricing.test.ts`

## Verification Evidence
- Lint passed with no ESLint warnings/errors.
- Targeted pricing tests passed:
  - `part-pricing.test.ts` (2/2)
  - `work-item-pricing.test.ts` (3/3)

## Next steps
- [ ] Add quote editor interaction tests that cover mode toggling in UI and payload serialization for `partPricing`.
- [ ] If order-side persistence is desired, add an explicit Orders-domain schema/metadata contract before implementing storage.

---

Date: 2026-04-07
Agent: GPT-5.3-Codex
Goal (1 sentence): Close quote/order pricing mismatch by introducing a shared work-item pricing contract and adding the missing order review-step totals.

## What I changed
- Added new shared pricing helper module:
  - `src/modules/pricing/work-item-pricing.ts`
  - Canonical semantic projection (`PRICED_WORK` vs `CHECKLIST_ONLY`), assignment total calculation, and subtotal rollup helper.
- Added unit tests:
  - `src/modules/pricing/__tests__/work-item-pricing.test.ts`
  - Covers checklist-only semantics, priced assignment totals, and subtotal exclusion of checklist-only items.
- Updated quote builder:
  - `src/app/admin/quotes/QuoteEditor.tsx`
  - Switched add-on fetch to `/api/orders/addons` (role-aware)
  - Reused shared pricing helper for subtotal and assignment meta rendering.
- Updated order builder:
  - `src/app/orders/new/page.tsx`
  - Reused shared pricing helper for assignment meta rendering.
  - Added Review step “Estimate summary” card with add-ons/labor subtotal + total estimate.

## Files touched
- `src/modules/pricing/work-item-pricing.ts`
- `src/modules/pricing/__tests__/work-item-pricing.test.ts`
- `src/app/admin/quotes/QuoteEditor.tsx`
- `src/app/orders/new/page.tsx`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

## Commands run
- `npm run test -- src/modules/pricing/__tests__/work-item-pricing.test.ts`
- `npm run lint`

## Verification Evidence
- Targeted pricing test suite passed (3/3).
- Lint passed with no ESLint warnings/errors.

## Diff/Review Notes
- Scope intentionally limited to pricing parity and display/projection consistency in quote/order builders.
- No new dependencies added.

## Next steps
- [ ] Consider applying the same shared pricing helper on API-side validation paths so client/server projections remain fully aligned.
- [ ] Add role-visibility contract tests to ensure rate visibility and pricing semantics stay consistent for admin vs non-admin sessions.

---

Date: 2026-04-07
Agent: GPT-5.3-Codex
Goal (1 sentence): Restore admin-visible add-on/labor pricing context in quote/order creation flows and repair the quote-conversion route type guard regression breaking build checks.

## What I changed
- Updated `QuoteEditor` available-item mapping to include `rateCents` for add-on cards rendered by `AvailableItemsLibrary`.
- Updated `/orders/new` assigned add-on/labor panel to render per-line pricing metadata (`rate x units = total`) and checklist-only no-charge indicator.
- Updated quote prefill hydration in `/orders/new` to merge add-on snapshots from quote selections so pricing/details remain visible even when selected add-ons are inactive and absent from active add-on API fetch.
- Updated quote conversion route error handling to use `error?.code === 'P2002'` guard instead of `Prisma.PrismaClientKnownRequestError` type access.

## Files touched
- `src/app/admin/quotes/QuoteEditor.tsx`
- `src/app/orders/new/page.tsx`
- `src/app/api/admin/quotes/[id]/convert/route.ts`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

## Commands run
- `npm run -s lint`
- `npm run -s build`

## Verification Evidence
- Lint passed with no ESLint warnings/errors.
- Build failed at pre-existing `src/repos/index.ts` mock repo type-surface mismatch (`updateOrderAttachmentStoragePath` and `updatePartAttachmentStoragePath` missing in mock).

## Next steps
- [ ] Resolve `src/repos/index.ts` mock Orders repo type shape mismatch so `npm run build` can pass fully in this branch.
- [ ] Add focused UI regression coverage for quote/order assigned add-on pricing display behavior.

---

Date: 2026-04-07
Agent: GPT-5.3-Codex
Goal (1 sentence): Fix quote→order conversion checklist unique-constraint failures, surface actionable conversion/create errors in UI/API, and restore admin pricing visibility in add-on assignment cards.

## What I changed
- Updated `syncChecklistForOrder` in Orders repo to dedupe checklist creations using checklist uniqueness semantics (`partId + addonId`) so conversion-preseeded checklist rows do not collide with sync-generated rows.
- Added conversion-route error handling in `POST /api/admin/quotes/[id]/convert`:
  - Prisma `P2002` now returns a deterministic 409 JSON error message.
  - Unexpected errors now return JSON with a readable message.
- Updated order/quote creation UI (`/orders/new`) error handling:
  - Added shared response-message extraction helper for failed create/convert responses.
  - Failure messages are rendered with destructive styling for clearer operator feedback.
- Restored admin pricing visibility for add-on assignment library:
  - `/api/orders/addons` now passes admin context to service.
  - `listAddonsForOrders` supports admin-only pricing inclusion.
  - `AvailableItemsLibrary` now shows formatted rates when `rateCents` is present.
- Updated convert-route test coverage mocks to include `ensureOrderFilesInCanonicalStorage` and assert it is invoked.

## Files touched
- `src/modules/orders/orders.repo.ts`
- `src/modules/orders/orders.service.ts`
- `src/app/api/orders/addons/route.ts`
- `src/components/AvailableItemsLibrary.tsx`
- `src/app/orders/new/page.tsx`
- `src/app/api/admin/quotes/[id]/convert/route.ts`
- `src/app/api/admin/quotes/[id]/convert/__tests__/route.test.ts`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

## Commands run
- `npm run lint`
- `npm run test -- src/app/api/admin/quotes/[id]/convert/__tests__/route.test.ts`

## Verification Evidence
- Lint passed with no ESLint warnings/errors.
- Targeted conversion route tests passed (3/3).

## Next steps
- [ ] Add focused unit coverage for `syncChecklistForOrder` to lock in part+addon dedupe behavior around conversion-preseeded rows.
- [ ] Optionally add dedicated inline alert component on `/orders/new` for error/success semantic consistency.

---

Date: 2026-04-07
Agent: GPT-5.3-Codex
Goal (1 sentence): Replace the quick hotfix with a durable Orders module boundary by moving client-safe constants/helpers out of `orders.service.ts` and enforcing `server-only` on the service.

## What I changed
- Added `src/modules/orders/orders.constants.ts` with client-safe order status constants and normalization helpers.
- Added `src/modules/orders/orders.shared.ts` with client-safe dashboard/filter helpers (`decorateOrder`, `formatStatusLabel`, `orderMatchesFilters`, `DEFAULT_ORDER_FILTERS`).
- Added `import 'server-only';` to `src/modules/orders/orders.service.ts` and re-exported shared/constants APIs for server-side callers.
- Moved `DepartmentFeedOrder` / `DepartmentFeedPart` types into `src/modules/orders/orders.types.ts`.
- Updated client import boundaries:
  - `RecentOrdersTable` now imports labels from `orders.constants`.
  - `ShopFloorLayouts` now imports helpers from `orders.shared` and types from `orders.types`.
  - `WorkQueueOrderCard` now imports types from `orders.types`.

## Files touched
- `src/modules/orders/orders.constants.ts`
- `src/modules/orders/orders.shared.ts`
- `src/modules/orders/orders.types.ts`
- `src/modules/orders/orders.service.ts`
- `src/components/RecentOrdersTable.tsx`
- `src/components/ShopFloorLayouts.tsx`
- `src/components/work-queue/WorkQueueOrderCard.tsx`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

## Commands run
- `npm run lint`
- `npm run build`

## Verification Evidence
- Lint passed with no ESLint warnings/errors.
- Build failed at a pre-existing type mismatch in `src/repos/index.ts` unrelated to this boundary move.

## Next steps
- [ ] Resolve the existing `src/repos/index.ts` mock orders repo type-surface mismatch so `npm run build` can pass in this branch.

---

Date: 2026-04-07
Agent: GPT-5.3-Codex
Goal (1 sentence): Fix the `node:crypto` client-bundle crash by removing a server-only Orders service import from a client dashboard component.

## What I changed
- Updated `src/components/RecentOrdersTable.tsx` (client component) to stop importing `ORDER_STATUS_LABELS` from `src/modules/orders/orders.service.ts`.
- Added a local `ORDER_STATUS_LABELS` map in the component so UI labels remain stable while avoiding server-side transitive imports (`src/lib/storage.ts` -> `node:crypto`).

## Files touched
- `src/components/RecentOrdersTable.tsx`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

## Commands run
- `npm run lint`

## Verification Evidence
- Lint passed with no ESLint warnings/errors.

## Next steps
- [ ] Optional hardening: move shared order-status labels to a lightweight `orders.constants.ts` file that is safe for both server/client imports to prevent future boundary regressions.

---

Date: 2026-04-07
Agent: GPT-5.3-Codex
Goal (1 sentence): Implement admin Quote & Order Ops IA updates, broad admin order editability, admin-only Full Order Files visibility, and canonical order-number file storage continuity through creation/conversion.

## What I changed
- Updated admin navigation and Admin Center IA:
  - Renamed section label to `Quote & Order Ops`.
  - Exposed only `Create Order` and `Create Quote` actions in that section.
  - Moved `Templates` link under `Business Settings` card context.
- Extended order detail page with admin edit mode:
  - Added broad order-header field editing (customer, dates, priority, vendor, PO, assignee, material/model flags).
  - Added selected-part editing controls plus admin add/delete part actions.
- Added admin-only `Full Order Files` tab in order detail:
  - Aggregates order-level + part-level attachments with source badges and open links.
- Added Orders-domain canonical storage helper `ensureOrderFilesInCanonicalStorage(orderId)`:
  - Copies non-canonical order-owned files into `business/customer/orderNumber/` paths.
  - Updates `Attachment` and `PartAttachment` `storagePath` records after copy.
- Wired canonicalization flow after direct order creation and after quote→order conversion.
- Updated continuity artifacts (`tasks/todo.md`, `PROGRESS_LOG.md`, `docs/AGENT_CONTEXT.md`, `docs/AGENT_HANDOFF.md`).

## Files touched
- `src/components/Admin/NavTabs.tsx`
- `src/app/admin/page.tsx`
- `src/app/orders/[id]/page.tsx`
- `src/modules/orders/orders.repo.ts`
- `src/repos/orders.ts`
- `src/modules/orders/orders.service.ts`
- `src/app/api/admin/quotes/[id]/convert/route.ts`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_CONTEXT.md`
- `docs/AGENT_HANDOFF.md`

## Commands run
- `npm run lint`

## Verification Evidence
- Lint passed with no ESLint warnings/errors.

## Next steps
- [ ] Add focused automated coverage for canonical storage normalization helper behavior (path already canonical vs non-canonical copy/update).
- [ ] Optionally add explicit UX affordance to edit order-level attachments directly from Full Order Files tab.

---

Date: 2026-04-07
Agent: GPT-5.3-Codex
Goal (1 sentence): Shift timer tracking to a department-bound model with required department selection on start, per-department active constraints, and department-based history totals in order detail.

## What I changed
- Added `TimeEntry.departmentId` relation in Prisma schema and created migration `20260407143000_add_time_entry_department`.
- Updated time repo/service layers:
  - timer start requires `departmentId`
  - one active timer allowed per `(userId, departmentId)`
  - concurrent active timers across different departments are allowed
  - resume preserves department and blocks resume when a same-department timer is already active.
- Updated timer APIs:
  - `POST /api/timer/start` and `POST /api/time/start` now validate department selection and reject Shipping timer starts.
  - `GET /api/timer/active` now returns `activeEntries` (all active timers for current user).
  - `POST /api/timer/pause` and `POST /api/timer/finish` accept optional `entryId` to target a specific active timer.
  - `POST /api/timer/resume` no longer blocks resume just because another unrelated department timer is active.
- Updated order detail UI:
  - added required department dropdown in timer controls (fresh selection required each start).
  - start payload includes `departmentId`.
  - pause/stop target the selected active timer entry instead of assuming a single global active timer.
  - added selected-part department history section with summary totals and detailed recent rows per department.
- Included order `timeEntries` (with department/user context) in order details repo payload to support history rendering.
- Updated mock seed/time repo and time service tests for department-aware timer behavior.

## Files touched
- `prisma/schema.prisma`
- `prisma/migrations/20260407143000_add_time_entry_department/migration.sql`
- `src/modules/time/time.types.ts`
- `src/modules/time/time.schema.ts`
- `src/modules/time/time.repo.ts`
- `src/modules/time/time.service.ts`
- `src/modules/time/__tests__/time.service.test.ts`
- `src/repos/time.ts`
- `src/repos/mock/seed.ts`
- `src/repos/mock/time.ts`
- `src/modules/orders/orders.repo.ts`
- `src/app/api/time/start/route.ts`
- `src/app/api/timer/start/route.ts`
- `src/app/api/timer/active/route.ts`
- `src/app/api/timer/pause/route.ts`
- `src/app/api/timer/finish/route.ts`
- `src/app/api/timer/resume/route.ts`
- `src/app/orders/[id]/page.tsx`
- `docs/AGENT_CONTEXT.md`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

## Commands run
- `npx prisma format`
- `npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --script > /tmp/time_dept_migration.sql`
- `npm run lint`
- `npm run test -- src/modules/time/__tests__/time.service.test.ts`

## Verification Evidence
- Prisma schema formatted successfully.
- Lint passed with no ESLint warnings/errors.
- Targeted time service tests passed (6/6).

## Next steps
- [ ] Consider adding department-aware resume targeting (current selected-part resume behavior was simplified to explicit start flow).
- [ ] Consider adding explicit order-detail “all active timers by department” list when multiple timers are running concurrently.

---

Date: 2026-04-07
Agent: GPT-5.3-Codex
Goal (1 sentence): Persist BOM analyzer output for each order part and improve tolerance extraction/readout behavior (including corner zooms and drill decimal display).

## What I changed
- Added new Prisma model + migration: `PartBomAnalysis` (unique by `orderId` + `partId`) to persist the latest analyzer result JSON for each part.
- Updated `POST /api/print-analyzer/analyze`:
  - accepts optional `orderId`, `partId`, and `sourceLabel`
  - persists successful analysis output when valid part context is provided
  - runs title-block tolerance extraction across all four corners (`top-left`, `top-right`, `bottom-left`, `bottom-right`) with stricter anti-hallucination prompt instructions
  - ensures fallback warning is present when tolerances are not confidently detected: `Unable to confidently read general tolerances. Please check the paper print.`
- Added `GET /api/orders/[id]/parts/[partId]/bom-analysis` to return latest saved analysis for BOM tab hydration.
- Updated `PartBomTab` to auto-load persisted analysis on mount and show a saved-analysis timestamp indicator; analyze requests now include order/part context so output is persisted.
- Replaced empty-state general tolerance message in BOM tab with paper-print instruction wording instead of `No general tolerances detected.`
- Updated tap-drill enrichment mapping to include decimal-inch diameter values for letter drills (plus mapped number/fraction drills) and added focused unit coverage.

## Files touched
- `prisma/schema.prisma`
- `prisma/migrations/20260407143000_add_part_bom_analysis/migration.sql`
- `src/app/api/print-analyzer/analyze/route.ts`
- `src/app/api/orders/[id]/parts/[partId]/bom-analysis/route.ts`
- `src/app/orders/[id]/PartBomTab.tsx`
- `src/lib/printAnalyzer/tapDrills.ts`
- `src/lib/printAnalyzer/tapDrills.test.ts`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

## Commands run
- `npx prisma migrate deploy`
- `npx prisma generate`
- `npm run test -- src/lib/printAnalyzer/tapDrills.test.ts`
- `npm run lint`

## Verification Evidence
- Migrations applied successfully in local SQLite dev database.
- Prisma client regenerated successfully.
- Targeted test passed (1/1).
- Lint passed with no ESLint warnings/errors.

## Next steps
- [ ] Consider adding a compact “source image” descriptor in BOM tab using stored `sourceLabel` for better auditability.
- [ ] Consider adding an explicit UI badge when fallback paper-print warning came from unreadable title-block scans.

---

Date: 2026-04-07
Agent: GPT-5.3-Codex
Goal (1 sentence): Add a direct logout control on the account page so users can sign out and switch accounts quickly.

## What I changed
- Updated `src/app/account/password/client.tsx` to add a `Sign out` button alongside the password save action.
- Wired the new sign-out action to `signOut({ callbackUrl: '/auth/signin' })` so users are returned to sign-in immediately after logout.
- Added local `signingOut` state so the sign-out button shows in-progress text and temporarily disables relevant actions.
- Updated continuity artifacts for this follow-up session (`tasks/todo.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`).

## Files touched
- src/app/account/password/client.tsx
- tasks/todo.md
- PROGRESS_LOG.md
- docs/AGENT_HANDOFF.md

## Commands run
- npm run lint

## Verification Evidence
- Lint passed with no ESLint warnings/errors.

## Next steps
- [ ] Optional UX follow-up: add a short helper line above the sign-out button clarifying that signing out is the path for switching users on shared machines.

---

Date: 2026-04-07
Agent: GPT-5.3-Codex
Goal (1 sentence): Add a dedicated Sign In tab in the navigation and remove the About page from the app.

## What I changed
- Updated `src/components/AppNav.tsx`:
  - Removed the About nav link.
  - Added a `Sign In` nav link for unauthenticated users (desktop + mobile nav lists).
  - Kept existing account/sign-in CTA button behavior unchanged.
- Deleted `src/app/about/page.tsx` to remove the `/about` page route.
- Updated continuity artifacts for this session (`tasks/todo.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`).

## Files touched
- src/components/AppNav.tsx
- src/app/about/page.tsx (deleted)
- tasks/todo.md
- PROGRESS_LOG.md
- docs/AGENT_HANDOFF.md

## Commands run
- npm run lint

## Verification Evidence
- Lint passed with no ESLint warnings/errors.

## Next steps
- [ ] If desired, add a public marketing/info page at a new route (for example `/welcome`) that is intentionally linked from nav; currently no informational page link remains in the app nav.

---

Date: 2026-04-07
Agent: GPT-5.3-Codex
Goal (1 sentence): Replace unreliable checklist auto-advance with explicit department completion submission, while adding manual time-adjustment notes into part totals visibility.

## What I changed
- Added schema + migration for `PartTimeAdjustment` with links to Order/Part/User and note/seconds fields.
- Extended Orders repo + mock repo to persist/load part time adjustments and include them in order detail payloads.
- Added new authenticated machinist API route:
  - `POST /api/orders/[id]/parts/[partId]/submit-department-complete`
- Added new Orders service flow `submitDepartmentComplete(...)`:
  - Validates current department checklist completeness before submission.
  - Rejects submit if current department has open checklist items.
  - Supports optional `additionalSeconds` with required note for manual time adds.
  - Moves part to next department or marks part complete when no remaining department work exists.
  - Logs part events and syncs order workflow status.
- Removed checklist checkbox-triggered auto-advance path from order detail page; checklist toggles now only toggle checklist state.
- Updated order detail checklist tab to group items by department label heading.
- Added total-time section on order detail selected part showing:
  - combined total (timer + manual)
  - timer subtotal
  - manual subtotal
  - manual adjustment note history
- Added focused Orders service tests covering:
  - completion gate with open checklist
  - department submit gate
  - required note validation when extra time is added

## Files touched
- `prisma/schema.prisma`
- `prisma/migrations/20260407120000_add_part_time_adjustments/migration.sql`
- `src/modules/orders/orders.repo.ts`
- `src/modules/orders/orders.service.ts`
- `src/repos/orders.ts`
- `src/repos/mock/seed.ts`
- `src/repos/mock/orders.ts`
- `src/app/api/orders/[id]/parts/[partId]/submit-department-complete/route.ts`
- `src/app/orders/[id]/page.tsx`
- `src/modules/orders/__tests__/orders.service.test.ts`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

## Commands run
- `npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/20260407120000_add_part_time_adjustments/migration.sql`
- `npx prisma migrate deploy`
- `npx prisma generate`
- `npm run lint`
- `npm run test -- src/modules/orders/__tests__/orders.service.test.ts`
- `npm run build`

## Verification Evidence
- Migration deploy succeeded and Prisma client regenerated.
- Lint passed with zero ESLint warnings/errors.
- Targeted Orders service tests passed (3/3).
- Build failed due an existing environment/tooling issue in `sterling-site/vite.config.ts` module resolution for `@vitejs/plugin-react` (not introduced by this task).

## Diff/Review Notes
- Scope limited to requested behavior changes for checklist/department submission/time notes in order detail workflow.
- No new dependencies were added.

## Next steps
- [ ] Consider replacing prompt-based added-time input with a modal form for better UX/accessibility.
- [ ] Optionally deprecate now-unused preview/complete-and-advance checklist endpoints once owner confirms no other callers.

---

# AGENT_HANDOFF — 2026-04-02 (part-complete route + status parity)

Goal (1 sentence): Fix outdated completion path drift by restoring a live part-complete API route and align order-detail part status display with persisted backend state.

Scope (what changed):
- Added new route `src/app/api/orders/[id]/parts/[partId]/complete/route.ts` with existing auth patterns (`authRequiredResponse`, `forbiddenResponse`, `canAccessMachinist`) and service call to `completeOrderPart`.
- Updated `src/app/orders/[id]/page.tsx` to add a `Mark selected part complete` action in the active-work button stack.
- Updated order-detail part card status rendering to use persisted `part.status` rather than checklist-derived UI override.

Files touched:
- src/app/api/orders/[id]/parts/[partId]/complete/route.ts
- src/app/orders/[id]/page.tsx
- tasks/todo.md
- PROGRESS_LOG.md
- docs/AGENT_HANDOFF.md

Commands run:
- npm run lint

Verification results:
- Lint passed with no ESLint errors.

Open follow-ups / next steps:
- Consider adding route-level tests for `POST /api/orders/[id]/parts/[partId]/complete` (success + checklist-incomplete 409 + auth/role guards).
- Consider showing checklist completion summary alongside persisted status to keep useful context without overriding canonical status.

---


# AGENT_HANDOFF — 2026-03-23 (standalone premium manufacturing marketing site)

Goal (1 sentence): Create a fully isolated one-page premium manufacturing marketing website in its own repo subfolder so it can be previewed and deployed by direct URL without coupling to the main shop app.

Scope (what changed):
- Added a dedicated `sterling-site/` Vite + React + TypeScript subproject with its own package manifest, TS configs, Vite config, HTML entrypoint, and lockfile.
- Built a responsive one-page site covering hero, brand identity, capabilities, why-us, trust, materials, equipment, gallery, and CTA/contact sections.
- Implemented sticky top navigation with smooth anchor scrolling and active-section highlighting.
- Added motion treatment via animated ambient mesh background, parallax hero visual movement, and intersection-observer reveal transitions without bringing in extra animation dependencies.
- Centralized editable site data/media references in `sterling-site/src/siteContent.ts` and documented run/build/deploy/media swap guidance in `sterling-site/README.md`.
- Kept the project isolated from the main app: no shared components, styles, auth, DB wiring, APIs, or shared runtime config.

Files touched:
- sterling-site/package.json
- sterling-site/package-lock.json
- sterling-site/tsconfig.json
- sterling-site/tsconfig.app.json
- sterling-site/tsconfig.node.json
- sterling-site/vite.config.ts
- sterling-site/index.html
- sterling-site/README.md
- sterling-site/src/main.tsx
- sterling-site/src/App.tsx
- sterling-site/src/siteContent.ts
- sterling-site/src/styles.css
- docs/AGENT_CONTEXT.md
- docs/AGENT_TASK_BOARD.md
- PROGRESS_LOG.md
- docs/AGENT_HANDOFF.md
- tasks/todo.md

Commands run:
- cd sterling-site && npm install
- cd sterling-site && npm run build
- cd sterling-site && npm run check
- cd sterling-site && npm run dev -- --host 127.0.0.1 --port 4173
- curl -I --max-time 15 http://127.0.0.1:4173/

Verification results:
- Standalone dependency installation succeeded.
- Production build passed and emitted the static site to `sterling-site/dist`.
- Type-check passed.
- Direct-link dev-server smoke check returned `200 OK`.
- Browser screenshot capture was not possible because the required browser screenshot tool is unavailable in this environment.

Open follow-ups / next steps:
- Replace placeholder quote/contact details with real production contact endpoints before public launch.
- Swap the stock gallery/hero media with real shop photography when available.
- When ready, add a single direct URL link from the main app or deploy `sterling-site/` as a separate project/subdomain without sharing runtime code.

---


# AGENT_HANDOFF — 2026-03-23 (order workflow status simplification + admin override)

Goal (1 sentence): Convert order status into a simple manager-facing workflow rollup (`RECEIVED` / `IN_PROGRESS` / `COMPLETE` / `CLOSED`) that auto-syncs from part activity while remaining admin-editable with audit reasons.

Scope (what changed):
- Added simplified order workflow status helpers in `src/modules/orders/orders.service.ts` to normalize legacy statuses and derive the manager-facing rollup from part completion/activity.
- Added order status auto-sync after part progress actions (checklist toggle/complete, timer start/resume/finish, manual department assignment/transition, part add/remove, charge mutations, and manual part completion).
- Kept `OrderPart.status` aligned with routing state (`IN_PROGRESS` when a part still has a department, `COMPLETE` when the part is done).
- Simplified order query/filter status vocabulary in `src/modules/orders/orders.schema.ts` and dashboard/search UI surfaces to `RECEIVED`, `IN_PROGRESS`, `COMPLETE`, and `CLOSED`.
- Replaced `/api/orders/[id]/status` behavior with an admin-only status override path that requires a reason and writes status-history audit text using the signed-in admin identity.
- Added an admin status editor to the order detail header so admins can update order status directly in the UI.
- Updated seed/mock fixtures to emit the simplified statuses and added focused workflow-status helper tests.
- Included a small build-compatibility fix in `src/modules/quotes/quotes.repo.ts` by loosening a stale `Prisma.TransactionClient` annotation to `any`.

Files touched:
- prisma/seed.ts
- src/app/api/orders/[id]/status/route.ts
- src/app/api/timer/finish/route.ts
- src/app/api/timer/resume/route.ts
- src/app/api/timer/start/route.ts
- src/app/customers/[id]/page.tsx
- src/app/machinists/[id]/page.tsx
- src/app/orders/[id]/page.tsx
- src/app/search/page.tsx
- src/components/ShopFloorLayouts.tsx
- src/modules/orders/__tests__/orders.status.test.ts
- src/modules/orders/orders.repo.ts
- src/modules/orders/orders.schema.ts
- src/modules/orders/orders.service.ts
- src/modules/quotes/quotes.repo.ts
- src/repos/mock/orders.ts
- src/repos/mock/seed.ts
- src/repos/orders.ts
- docs/AGENT_CONTEXT.md
- PROGRESS_LOG.md
- docs/AGENT_HANDOFF.md
- tasks/todo.md

Commands run:
- npm run lint
- npm run test -- src/modules/orders/__tests__/department-routing.test.ts src/modules/orders/__tests__/orders.service.test.ts src/modules/orders/__tests__/orders.status.test.ts
- npm run build
- npx tsc --noEmit

Verification results:
- Lint passed with zero ESLint warnings/errors.
- Targeted Orders Vitest coverage passed (10/10 tests).
- Production build passed and standalone assets were copied successfully.
- Browser screenshot capture was not possible because the required browser screenshot tool is unavailable in this environment.

Open follow-ups / next steps:
- Consider a one-time/backfill admin action to rewrite already-persisted legacy order statuses in existing databases so historical records fully match the simplified set without waiting for fresh workflow activity.
- If desired, extend dashboard/search result cards with richer rollup metadata such as `parts complete / total` and flagged rework counts now that order status is simplified.

---

# AGENT_HANDOFF — 2026-03-19 (order-create Prisma fix + sign-in visibility + LAN auth fallback)

Goal (1 sentence): Fix the reported order-create Prisma validation error, expose a clear sign-in entry point, and make auth redirects safer for local-network IP access.

Scope (what changed):
- Added `createdAt` / `updatedAt` to `OrderPart` in Prisma schema and shipped/apply-tested a SQLite-safe migration that rebuilds the table with those timestamp columns.
- Added shared `src/lib/base-url.ts` and used it in auth redirect + sign-out base URL resolution so LAN requests can override loopback env origins.
- Made `/about` public, added it to main nav, and kept explicit sign-in/dashboard CTAs for unauthenticated users.
- Switched `getAppSettings()` to `upsert()` to avoid singleton-create races exposed by runtime verification.
- Updated README LAN startup/env instructions and refreshed continuity artifacts.

Files touched:
- prisma/schema.prisma
- prisma/migrations/20260319120000_add_order_part_timestamps/migration.sql
- src/lib/base-url.ts
- src/lib/base-url.test.ts
- src/lib/auth.ts
- src/app/(public)/auth/signout/route.ts
- src/components/AppNav.tsx
- src/app/about/page.tsx
- src/lib/app-settings.ts
- README.md
- docs/AGENT_CONTEXT.md
- tasks/todo.md
- tasks/lessons.md
- PROGRESS_LOG.md
- docs/AGENT_HANDOFF.md

Commands run:
- npm run prisma:generate
- npx prisma migrate resolve --rolled-back 20260319120000_add_order_part_timestamps
- npx prisma migrate deploy
- node - <<'JS' ... PRAGMA table_info("OrderPart") ... JS
- npm run lint
- npm run test -- src/lib/auth-redirect.test.ts src/lib/base-url.test.ts
- npm run dev -- --hostname 0.0.0.0 --port 3000
- curl -I --max-time 20 http://127.0.0.1:3000/about
- curl -I --max-time 20 'http://127.0.0.1:3000/auth/signin?callbackUrl=%2F'
- curl -I --max-time 20 http://127.0.0.1:3000/

Verification results:
- Prisma Client regenerated successfully.
- Migration applied successfully after converting the initial failing SQLite `ALTER TABLE` attempt into a table-redefinition migration.
- `PRAGMA table_info("OrderPart")` confirms `createdAt` and `updatedAt` now exist.
- Lint passed.
- Targeted tests passed (7/7).
- Runtime smoke checks passed for public about/sign-in pages and unauthenticated root redirect.
- Browser screenshot capture was not possible because the required browser screenshot tool was unavailable in this environment.

Open follow-ups / next steps:
- Ask the operator to re-run `npx prisma migrate deploy` (or the installer) before testing order creation on their machine so the new `OrderPart` timestamp columns exist locally.
- If LAN auth still redirects incorrectly on a specific device, confirm the browser is opening the same origin that is configured in `.env` and check for stale cookies from a previous `localhost` session.

---

Date: 2026-02-26
Agent: GPT-5.2-Codex
Goal (1 sentence): Clean up admin information architecture and ship a one-script installer with selectable basic/demo seed profiles for local and Docker installs.

## What I changed
- Replaced `src/app/admin/page.tsx` redirect behavior with a full Admin Center overview page containing grouped cards and direct links to all admin sections.
- Reworked `src/components/Admin/NavTabs.tsx` into grouped, icon-backed navigation rows (Overview/People/Catalog/Quote Ops) for improved scanability.
- Updated `src/components/AppNav.tsx` so the global Admin link points to `/admin` and active-state checks treat `/admin` as the section root.
- Added `prisma/seed-basic.js` for foundational functionality-only seed data and split package scripts into `seed:basic` and `seed:demo` modes.
- Added `scripts/install.sh` one-step installer (`--target local|docker`, `--seed basic|demo`, `--start`) and updated `README.md` installation/seed docs.
- Updated `docker-compose.yml` to use named volumes for portable local Docker setup.
- Updated continuity artifacts (`tasks/todo.md`, `PROGRESS_LOG.md`, `tasks/lessons.md`, `docs/AGENT_HANDOFF.md`).

## Files touched
- src/app/admin/page.tsx
- src/components/Admin/NavTabs.tsx
- src/components/AppNav.tsx
- prisma/seed-basic.js
- scripts/install.sh
- package.json
- README.md
- docker-compose.yml
- tasks/todo.md
- tasks/lessons.md
- PROGRESS_LOG.md
- docs/AGENT_HANDOFF.md

## Commands run
- npm run lint
- npx prisma migrate deploy
- npm run seed:basic
- npm run seed:demo
- npm run set-demo-passwords
- bash scripts/install.sh --help
- npm run dev -- --hostname 0.0.0.0 --port 3000
- Playwright screenshot script (signin + admin page capture)

## Verification Evidence
- Lint passed without ESLint errors.
- Local SQLite migrations applied successfully.
- `seed:basic` and `seed:demo` both completed successfully.
- Installer help output confirmed target/seed options are wired.
- Screenshot artifact captured: `browser:/tmp/codex_browser_invocations/2e98785689018ddb/artifacts/artifacts/admin-center.png`.

## Next steps
- [ ] Consider adding a non-interactive installer smoke test in CI that runs `scripts/install.sh --target local --seed basic` in TEST_MODE.
- [ ] Optional: extend demo seed docs with explicit sample order/quote counts so operators know expected baseline content.

---

Date: 2026-02-26
Agent: GPT-5.2-Codex
Goal (1 sentence): Fix BOM tab image-analysis failures by allowing `/attachments/<storagePath>` to resolve part-level file records.

## What I changed
- Updated `src/app/(public)/attachments/[...path]/route.ts` to include a `prisma.partAttachment.findFirst({ where: { storagePath } })` fallback when quote and order attachment lookups miss.
- Kept existing restricted-label visibility gate and file path safety checks unchanged.
- Updated continuity artifacts (`tasks/todo.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`) and logged a tooling-prevention lesson in `tasks/lessons.md` per user correction.

## Files touched
- src/app/(public)/attachments/[...path]/route.ts
- tasks/todo.md
- PROGRESS_LOG.md
- docs/AGENT_HANDOFF.md
- tasks/lessons.md

## Commands run
- npm run lint

## Verification Evidence
- `npm run lint` passed.
- Route now recognizes `PartAttachment` storage paths, addressing the exact 404 gap identified in the prior diagnosis.

## Next steps
- [ ] Verify end-to-end in an authenticated runtime: upload part file in Notes & Files, then analyze it from BOM tab.
- [ ] If needed, add route-level regression coverage for attachment record source precedence.

---

Date: 2026-02-26
Agent: GPT-5.2-Codex
Goal (1 sentence): Diagnose BOM tab image analysis failures (`Failed to load selected image attachment`) and report root cause without implementing a fix.

## What I changed
- Performed diagnosis-only trace across BOM client logic, attachment-serving route, and Prisma models.
- Confirmed the failing edge is attachment retrieval, not analyzer parsing:
  - BOM client fetches selected part file via `/attachments/${storagePath}`.
  - Public attachment route only resolves `QuoteAttachment` and legacy `Attachment` rows.
  - Part uploads are persisted as `PartAttachment`, which the route does not currently query.
- Updated continuity artifacts (`tasks/todo.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`) with evidence and next-step recommendation.

## Files touched
- tasks/todo.md
- PROGRESS_LOG.md
- docs/AGENT_HANDOFF.md

## Commands run
- rg -n "Failed to load selected image attachment|/attachments/|storagePath" src/app src/lib prisma -g '*.ts*'
- sed -n '1,220p' src/app/orders/[id]/PartBomTab.tsx
- sed -n '1,220p' 'src/app/(public)/attachments/[...path]/route.ts'
- sed -n '180,340p' prisma/schema.prisma

## Verification Evidence
- Client-side throw path, route lookup constraints, and schema ownership collectively prove the failure mechanism without code changes.
- Behavior matches report: both pre-existing and newly uploaded part files fail in BOM tab because the retrieval route cannot resolve `PartAttachment` rows.

## Next steps
- [ ] Implement a targeted retrieval fix in `src/app/(public)/attachments/[...path]/route.ts` so part-file requests can resolve `PartAttachment` by `storagePath` (while keeping existing auth/restricted-label checks).
- [ ] Re-test BOM tab analyze flow with (a) existing part attachment and (b) newly uploaded part attachment.

---

# AGENT_HANDOFF — 2026-02-26 (Part BOM analyzer attachment fix + conversion audit)

Goal (1 sentence): Fix Part BOM analyzer failures for Files/Notes attachments and validate quote→order conversion flow health.

Scope (what changed):
- Updated Part BOM attachment option filtering to skip explicit non-image MIME attachments.
- Updated selected attachment MIME resolution to enforce image payloads before calling `/api/print-analyzer/analyze`.
- Audited quote→order conversion path for structural issues without changing conversion transaction logic in this session.

Files touched:
- src/app/orders/[id]/PartBomTab.tsx
- tasks/todo.md
- PROGRESS_LOG.md
- docs/AGENT_HANDOFF.md

Commands run:
- npm run lint
- npm run dev -- --hostname 0.0.0.0 --port 3000
- Playwright screenshot capture script (browser tool) against `http://127.0.0.1:3000/`

Verification results:
- `npm run lint` passed.
- Dev server started successfully; unauthenticated root redirected to sign-in as expected.
- Screenshot artifact captured: `browser:/tmp/codex_browser_invocations/a282bb14452d16f9/artifacts/artifacts/bom-tab-update.png`.

Open follow-ups / next steps:
- Validate analyzer behavior on a real order part in a seeded/authenticated environment to capture a BOM-tab-specific screenshot.
- If quote→order concerns persist, capture a reproducible failing quote ID and expected-vs-actual conversion outcome so we can target a narrow server-side fix.

---

## Session — 2026-02-26 (order-detail BOM/file workflow + nav/auth updates)

Goal (1 sentence): Move BOM next to Notes & Files, tie analyzer sourcing to print-designated attachments, hide Overview from nav, and ensure sign-in-first routing behavior.

What changed:
- Updated `src/app/orders/[id]/page.tsx`:
  - Reordered part tabs to `overview -> notes -> bom -> checklist -> log`.
  - Added new part attachment kind option `PRINT`.
  - Renamed files heading to `Files & print drawings` and added explicit print-image guidance block for analyzer source designation.
- Updated `src/modules/orders/orders.schema.ts` to allow `PRINT` in `PART_ATTACHMENT_KINDS` validation.
- Updated `src/app/orders/[id]/PartBomTab.tsx`:
  - Uses Notes & Files attachments tagged as `PRINT`/`IMAGE` (or image MIME types).
  - Sorts source options so PRINT-tagged attachments appear first.
  - Clarified UI labels to indicate Notes & Files-backed print image sources.
- Updated `src/app/admin/quotes/QuoteEditor.tsx`:
  - Added per-attachment analyzer role checkbox to mark uploads as print images.
  - Persists print intent by applying `[PRINT]` label prefix in payload serialization.
  - Updated attachments description copy to explain analyzer prioritization.
- Updated `src/components/AppNav.tsx` to remove the Overview nav item while keeping route availability.
- Updated `src/app/about/page.tsx` to redirect unauthenticated users to sign-in (`callbackUrl=/`) for sign-in-first behavior.
- Updated `src/app/api/print-analyzer/analyze/route.ts` prompts to explicitly target lower-right title-block decimal tolerance legend extraction (`.X/.XX/.XXX` with +/- values).
- Updated continuity docs: `tasks/todo.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`.

Files touched:
- src/app/orders/[id]/page.tsx
- src/app/orders/[id]/PartBomTab.tsx
- src/modules/orders/orders.schema.ts
- src/app/admin/quotes/QuoteEditor.tsx
- src/components/AppNav.tsx
- src/app/about/page.tsx
- src/app/api/print-analyzer/analyze/route.ts
- tasks/todo.md
- PROGRESS_LOG.md
- docs/AGENT_HANDOFF.md

Commands run:
- `npm run lint`
- `npm run test -- src/lib/auth-redirect.test.ts`
- `npm run dev`
- Playwright screenshot scripts against `http://127.0.0.1:3000/auth/signin`, `/`, `/about`, and `/orders/...`

Verification results:
- Lint passed with no ESLint errors.
- Focused auth redirect tests passed (4/4).
- Screenshot artifacts captured, but this runtime currently serves a Next.js 500 error shell on tested routes (artifacts retained for evidence).

Next steps:
- [ ] Investigate and resolve current runtime 500 error shell (`/__next_error__`) to enable full visual QA capture of BOM/Notes tabs after sign-in.
- [ ] Optional: during quote→order conversion, map `[PRINT]` quote attachment labels into order/part attachment kind metadata if full end-to-end propagation is desired.

---

Date: 2026-02-26
Agent: GPT-5.2-Codex
Goal (1 sentence): Fix BOM tab image-analysis failures by allowing `/attachments/<storagePath>` to resolve part-level file records.

## What I changed
- Updated `src/app/(public)/attachments/[...path]/route.ts` to include a `prisma.partAttachment.findFirst({ where: { storagePath } })` fallback when quote and order attachment lookups miss.
- Kept existing restricted-label visibility gate and file path safety checks unchanged.
- Updated continuity artifacts (`tasks/todo.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`) and logged a tooling-prevention lesson in `tasks/lessons.md` per user correction.

## Files touched
- src/app/(public)/attachments/[...path]/route.ts
- tasks/todo.md
- PROGRESS_LOG.md
- docs/AGENT_HANDOFF.md
- tasks/lessons.md

## Commands run
- npm run lint

## Verification Evidence
- `npm run lint` passed.
- Route now recognizes `PartAttachment` storage paths, addressing the exact 404 gap identified in the prior diagnosis.

## Next steps
- [ ] Verify end-to-end in an authenticated runtime: upload part file in Notes & Files, then analyze it from BOM tab.
- [ ] If needed, add route-level regression coverage for attachment record source precedence.

---

Date: 2026-02-25
Agent: GPT-5.2-Codex
Goal (1 sentence): Build a sealed, non-linked Print Analyzer page + API that extracts structured drawing data via server-side OpenAI vision and shows results in an isolated UI.

## What I changed
- Added new isolated route UI at `src/app/private/print-analyzer/page.tsx` with `PrintAnalyzer.module.css` (scoped styles only, no global style edits).
- Added new Node runtime API route `src/app/api/print-analyzer/analyze/route.ts` with:
  - POST body validation for `{ dataUrl: "data:image/..." }`
  - OpenAI Responses API vision call (`gpt-4.1-mini`) with JSON-only format instruction
  - zod validation via `printAnalyzerResultSchema`
  - tap-drill enrichment via local helper
  - schema-failure 502 response including capped raw model output text
- Added print-analyzer helper files:
  - `src/lib/printAnalyzer/schema.ts`
  - `src/lib/printAnalyzer/normalize.ts`
  - `src/lib/printAnalyzer/tapDrills.ts`
- Added documentation `docs/PRINT_ANALYZER.md`.
- Updated `.env.example` with `OPENAI_API_KEY`.
- Added dependency `openai` and recorded decision in `docs/AGENT_CONTEXT.md` Decision Log.
- Updated continuity/planning artifact `tasks/todo.md` for this session.

## Files touched
- package.json
- package-lock.json
- .env.example
- docs/AGENT_CONTEXT.md
- docs/PRINT_ANALYZER.md
- tasks/todo.md
- PROGRESS_LOG.md
- docs/AGENT_HANDOFF.md
- src/app/private/print-analyzer/page.tsx
- src/app/private/print-analyzer/PrintAnalyzer.module.css
- src/app/api/print-analyzer/analyze/route.ts
- src/lib/printAnalyzer/schema.ts
- src/lib/printAnalyzer/normalize.ts
- src/lib/printAnalyzer/tapDrills.ts

## Commands run
- npm install openai@^6.25.0
- npm run lint
- npm run build
- npm run dev -- --hostname 0.0.0.0 --port 3000
- curl -s -o /tmp/pa_invalid.json -w '%{http_code}' -X POST http://127.0.0.1:3000/api/print-analyzer/analyze -H 'Content-Type: application/json' -d '{"foo":"bar"}'
- curl -s -o /tmp/pa_valid.json -w '%{http_code}' -X POST http://127.0.0.1:3000/api/print-analyzer/analyze -H 'Content-Type: application/json' -d '{"dataUrl":"data:image/png;base64,..."}'
- curl -s -o /tmp/pa_page.html -w '%{http_code}' http://127.0.0.1:3000/private/print-analyzer
- Playwright screenshot attempts (browser tool) for /private/print-analyzer

## Verification Evidence
- `npm run lint` passed.
- `npm run build` passed.
- API invalid-body contract check returned 400 with expected error JSON.
- API sample data-url check returned 500 with expected missing-key message in this environment.
- Route GET returned 200 at `/private/print-analyzer`.
- Screenshot capture attempt failed due Chromium SIGSEGV in browser tool runtime.

## Next steps
- [ ] Re-run screenshot capture in a stable browser-tool runtime to attach visual proof artifact.
- [ ] Validate full end-to-end analysis path in an environment with `OPENAI_API_KEY` set.

---

Date: 2026-02-25
Agent: GPT-5.2-Codex
Goal (1 sentence): Fix dashboard department-touch counting so Fab/Shipping department context is represented again.

## What I changed
- Updated `src/modules/orders/orders.repo.ts` dashboard/list query selections:
  - Added `parts.currentDepartmentId` to order list/dashboard payloads.
  - Added `checklist.departmentId` to order list/dashboard payloads.
- Updated `src/modules/orders/orders.types.ts` to include optional `currentDepartmentId` on parts and `departmentId` on checklist items.
- Updated `src/components/ShopFloorLayouts.tsx` `departmentTouchesByOrder` to count distinct department IDs from both checklist items and parts.
- Updated continuity artifacts for this session: `tasks/todo.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, `docs/AGENT_TASK_BOARD.md`.

## Files touched
- src/modules/orders/orders.repo.ts
- src/modules/orders/orders.types.ts
- src/components/ShopFloorLayouts.tsx
- tasks/todo.md
- PROGRESS_LOG.md
- docs/AGENT_HANDOFF.md
- docs/AGENT_TASK_BOARD.md

## Commands run
- npm run lint
- TEST_MODE=true npm run dev -- --hostname 0.0.0.0 --port 3000
- Playwright screenshot script against http://127.0.0.1:3000 (attempted)

## Verification Evidence
- Lint passed with no ESLint warnings/errors.
- Screenshot capture attempt failed due browser/runtime environment issues:
  - browser tool chromium launch SIGSEGV
  - TEST_MODE runtime hit Prisma DB open-file error

## Next steps
- [ ] Optional: add a focused unit-level assertion around dashboard order payload shape so future changes don’t drop department identifiers used by UI metrics.

---

Date: 2026-02-25
Agent: GPT-5.2-Codex
Goal (1 sentence): Remove the Dashboard Ready-for-fab option and add department-touch counts to Grid digest tiles.

## What I changed
- Updated `src/components/ShopFloorLayouts.tsx`:
  - Removed the `Ready for fab` layout toggle and removed the associated handoff layout render section.
  - Added `departmentTouchesByOrder` memoized computation using checklist `departmentId` values.
  - Added a `Departments` field in Grid digest cards showing `<count> touched` per order.
- Updated continuity artifacts for this session: `tasks/todo.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, `docs/AGENT_TASK_BOARD.md`.

## Files touched
- src/components/ShopFloorLayouts.tsx
- tasks/todo.md
- PROGRESS_LOG.md
- docs/AGENT_HANDOFF.md
- docs/AGENT_TASK_BOARD.md

## Commands run
- npm run lint
- TEST_MODE=true npm run dev -- --hostname 0.0.0.0 --port 3000
- Playwright screenshot script against http://127.0.0.1:3000

## Verification Evidence
- Lint passed with no ESLint warnings/errors.
- Dashboard screenshot artifact captured showing `Grid digest`, `By machinist`, and `Work queue` controls plus the new `Departments` row in digest cards.

## Next steps
- [ ] Optional: if desired, broaden department-touch counting to include order-level department charges in addition to checklist-linked departments.

---

## Session — 2026-02-25 (timer elapsed reset + department wrapper transparency)

Goal (1 sentence): Fix timer elapsed UI so active runs start at zero visual elapsed and remove Department Work Queue wrapper background fill.

What changed:
- Updated `src/app/orders/[id]/page.tsx` elapsed computation:
  - `selectedPartElapsedSeconds` now uses active-entry elapsed only while the timer is running on the selected part.
  - Paused/non-active selected parts still show stored cumulative seconds.
- Updated `src/components/ShopFloorLayouts.tsx`:
  - Department Work Queue wrapper container now uses `bg-transparent`.

Files touched:
- src/app/orders/[id]/page.tsx
- src/components/ShopFloorLayouts.tsx
- tasks/todo.md
- tasks/lessons.md
- PROGRESS_LOG.md
- docs/AGENT_HANDOFF.md

Commands run:
- `npm run lint`
- `TEST_MODE=true npm run dev -- --hostname 0.0.0.0 --port 3000`
- Playwright screenshot capture script against `http://127.0.0.1:3000`

Verification results:
- Lint passed (no ESLint warnings/errors).
- Runtime screenshot captured for dashboard/work queue transparency check:
  - `browser:/tmp/codex_browser_invocations/329e7c491ac33201/artifacts/artifacts/dashboard-workqueue-transparent-bg.png`

Open follow-ups:
- [ ] Optional: add a focused UI/integration check for timer elapsed rendering semantics (active interval vs stored cumulative total).

---

Date: 2026-02-24
Agent: GPT-5.2-Codex
Goal (1 sentence): Fix timer start validation drift and resume foreign-key crash behavior with minimal server-side changes.

## What I changed
- Updated `src/modules/time/time.schema.ts`:
  - `TimeEntryStart.operation` is now optional with default `Part Work`.
  - This preserves compatibility for clients that send only `orderId` + `partId`.
- Updated `src/modules/time/time.service.ts`:
  - Added `try/catch` around `createTimeEntry` in `resumeTimeEntry`.
  - Reused FK error mapping (`P2003`) for resume, returning deterministic conflict responses.
  - Refined FK error message text to include missing linked order/part/user record scenarios.
- Updated continuity artifacts: `tasks/todo.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, `docs/AGENT_TASK_BOARD.md`.

## Files touched
- src/modules/time/time.schema.ts
- src/modules/time/time.service.ts
- tasks/todo.md
- PROGRESS_LOG.md
- docs/AGENT_HANDOFF.md
- docs/AGENT_TASK_BOARD.md

## Commands run
- npm run test -- src/modules/time/__tests__/time.service.test.ts
- npm run lint

## Verification Evidence
- Time service tests passed (6/6).
- Lint passed with no ESLint warnings/errors.

## Next steps
- [ ] Optional: add route-level/API integration tests that assert `/api/timer/start` accepts payloads without `operation`.
- [ ] Optional: emit structured telemetry when FK mapping is triggered to speed production root-cause triage.

---

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

## Session Handoff — 2026-02-24 (AppNav key + timer conflict UX fix)

## Goal
Resolve reported UI/runtime bugs: duplicate React key warning in navigation and repeated “active timer” conflict without actionable context.

## Scope completed
- Updated `AppNav` map keys to use a composite (`href` + `label`) to prevent duplicate-key collisions when multiple links share `/`.
- Updated `/api/timer/start` conflict handling:
  - includes `activeOrderHref` in switch-confirmation payloads;
  - returns explicit `requiredAction: refresh` when 409 occurs but no active entry can be resolved.
- Updated `/api/timer/resume` conflict handling to include `activeOrderHref`.
- Updated order detail timer UI:
  - conflict state now stores `activeOrderHref`;
  - conflict dialog includes link to open active timer context;
  - start/resume handlers treat non-switch 409 responses as sync errors (no misleading conflict modal).

## Files touched
- `src/components/AppNav.tsx`
- `src/app/api/timer/start/route.ts`
- `src/app/api/timer/resume/route.ts`
- `src/app/orders/[id]/page.tsx`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

## Commands run
- `npm run lint`
- `npm run test -- src/modules/time/__tests__/time.service.test.ts`
- `npm run build`
- `npm run dev` (temporary for screenshot capture)

## Verification evidence
- Lint passed with zero ESLint errors/warnings.
- Time service unit suite passed.
- Build failed in this environment due Prisma unique constraint (`appSettings.id`) during prerender of `/403`.
- Screenshot captured at `browser:/tmp/codex_browser_invocations/0002efd80d6b7b20/artifacts/artifacts/nav-timer-fix-home.png`.

## Next steps
- Investigate build-time app settings seeding/idempotency causing `P2002` on `/403` prerender in this environment.

## Session Handoff — 2026-02-24 (FK/auth modal/status+seed+style)

Goal (1 sentence): Resolve test-mode FK/auth edge cases and UX auth prompting, ensure final-checklist completion reflects completed status, diversify demo seed flow, and align home metric card styling.

### What changed
- Test mode auth session now resolves to a persisted DB user (`test@local`) with stable admin role and returns that real `user.id` in session payload.
- Added centralized auth-required response helpers and updated timer/checklist protected endpoints to emit structured auth payloads.
- Added global shared auth interception (`window.fetch` wrapper + `fetchJson` fallback event emit) and a reusable sign-in modal dialog in app-wide providers.
- Updated order detail part badge logic to compute completion from active checklist item completion and render `COMPLETE` for fully completed parts.
- Expanded seed customers/orders with broader lifecycle-stage variety and more part/checklist distributions.
- Updated homepage intelligence metric cards with the same visual card treatment used on Customers page cards.

### Files touched
- `src/lib/auth-session.ts`
- `src/lib/auth-api.ts`
- `src/lib/auth-required.ts`
- `src/lib/fetchJson.ts`
- `src/components/AuthRequiredDialog.tsx`
- `src/components/Providers.tsx`
- `src/app/api/timer/start/route.ts`
- `src/app/api/orders/[id]/parts/[partId]/checklist/[itemId]/complete-and-advance/route.ts`
- `src/lib/rbac.ts`
- `src/app/orders/[id]/page.tsx`
- `src/app/page.tsx`
- `prisma/seed.ts`
- `prisma/seed.js`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- npm run prisma:push
- npm run seed
- npm run lint
- npm run test
- npm run build
- node -e 'const {PrismaClient}=require("@prisma/client"); ... groupBy ...'
- TEST_MODE=true npm run dev -- --port 3000 (screenshot capture)

### Verification evidence
- Prisma push + seed completed without FK errors.
- Lint passed clean.
- Vitest suite passed.
- Build still fails in this environment due known `AppSettings.id` unique collision during prerender (`/about`).
- Screenshot captured for home metric card styling parity.

### Next steps
- [ ] Consider centralizing auth response helpers across remaining protected API routes for fully uniform payload shape.
- [ ] Add a focused integration test for auth-required modal event handling on protected actions.
- [ ] Investigate/resolve environment-level `AppSettings.id` prerender build conflict.

## Session Handoff — 2026-02-25 (Dashboard nav dedupe + default Work Queue)

Goal (1 sentence): Replace duplicate dashboard/queue nav entries with a single `Dashboard` nav item and make Dashboard open on Work Queue layout by default.

### What changed
- Updated top-level navigation links to keep one `/` item labeled `Dashboard`; removed duplicate `Shop Floor Intelligence` and `Queue` nav entries.
- Changed `ShopFloorLayouts` initial `layout` state from `grid` to `workQueue` so Dashboard lands on Work Queue without extra clicks.
- Updated homepage copy using old naming (`Shop floor intelligence`, `Open queue`, `View queue`) to `Dashboard` wording.

### Files touched
- `src/components/AppNav.tsx`
- `src/components/ShopFloorLayouts.tsx`
- `src/app/page.tsx`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npm run lint`
- `TEST_MODE=true npm run dev -- --hostname 0.0.0.0 --port 3000`
- Playwright screenshot capture against `http://127.0.0.1:3000`

### Verification evidence
- Lint passed with no ESLint warnings/errors.
- Dashboard screenshot captured: `browser:/tmp/codex_browser_invocations/5b2f1381157b8568/artifacts/artifacts/dashboard-nav-workqueue.png`.

### Next steps
- [ ] If desired, consider renaming internal `Queue filters` label text in `ShopFloorLayouts` to `Dashboard filters` for naming consistency (not required for this user request).

## Session Handoff — 2026-02-25 (Dashboard border cleanup + button relocation)

Goal (1 sentence): Apply requested Dashboard visual/button follow-up by removing the Department Work Queue wrapper border, removing homepage quick-action buttons, and relocating New Order access to Admin Quotes actions.

### What changed
- Removed only the border from the `Department work queue` section wrapper in `ShopFloorLayouts` while preserving the outer shop-floor layout border and per-order tile borders.
- Removed Dashboard hero quick-action buttons (`New Order`, `Open dashboard`) from `src/app/page.tsx`.
- Removed `New Order` from global top navigation.
- Added `New order` button next to `New quote` in Admin Quotes action controls (`/admin/quotes`).

### Files touched
- `src/components/ShopFloorLayouts.tsx`
- `src/app/page.tsx`
- `src/components/AppNav.tsx`
- `src/app/admin/quotes/client.tsx`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npm run lint`
- `TEST_MODE=true npm run dev -- --hostname 0.0.0.0 --port 3000`
- Playwright screenshot capture against `http://127.0.0.1:3000` (firefox)

### Verification evidence
- Lint passed with no ESLint warnings/errors.
- Updated screenshot captured: `browser:/tmp/codex_browser_invocations/1beb2a2aeb55c846/artifacts/artifacts/dashboard-border-button-fix.png`.

### Next steps
- [ ] If desired, align remaining label text `Queue filters` to `Dashboard filters` for full naming consistency.

## Session Handoff — 2026-02-25 (Order Part BOM tab integration)

Goal (1 sentence): Integrate the existing Print Analyzer into Order → Part detail as a new BOM tab with native order-detail styling and deterministic conversion/tolerance helpers.

### What changed
- Added `PartBomTab` client component under `src/app/orders/[id]/` for BOM analysis UI inside order detail.
- Implemented image upload plus optional existing IMAGE attachment selection as analyzer input.
- Wired API call to existing `POST /api/print-analyzer/analyze` with `credentials: include`, handling success + error/debug payloads.
- Added helper logic for mm/inch conversion formatting, thread pitch parsing, tolerance rendering, and deterministic tight-tolerance flagging (`TIGHT TOL` + reamer suggestion).
- Integrated `bom` into part tab controls/rendering in `src/app/orders/[id]/page.tsx`.
- Updated `docs/PRINT_ANALYZER.md` with a BOM-tab integration note.

### Files touched
- `src/app/orders/[id]/PartBomTab.tsx`
- `src/app/orders/[id]/page.tsx`
- `docs/PRINT_ANALYZER.md`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npm run lint`
- `npm run build`
- `npm run dev -- --hostname 0.0.0.0 --port 3000`
- `TEST_MODE=true npm run dev -- --hostname 0.0.0.0 --port 3000`
- Playwright screenshot captures against `http://127.0.0.1:3000`

### Verification evidence
- Lint passed.
- Build failed due to existing baseline issue: missing `openai` package for pre-existing `src/app/api/print-analyzer/analyze/route.ts` import.
- Screenshot artifact captured: `browser:/tmp/codex_browser_invocations/bec823ec399c834f/artifacts/artifacts/bom-tab-testmode-orders.png`.

### Next steps
- [ ] Seed or access a concrete order/part in this environment to capture a BOM-tab-active screenshot and end-to-end analyzer interaction evidence on `/orders/[id]`.
- [ ] Resolve pre-existing missing `openai` package baseline issue if full production build verification is required in this workspace.

## Session Handoff — 2026-02-26 (QA flow mapping + regression tests)

Goal (1 sentence): Reverse-engineer actual quote/admin/backend workflow behavior, codify critical transitions as executable tests, and validate flow correctness with live local API exercises.

### What changed
- Added route-level Vitest coverage for quote conversion flow (`/api/admin/quotes/[id]/convert`) including:
  - already-converted conflict path (`409`),
  - PO-required gating path (`400`),
  - successful conversion with order custom-field allowlisting.
- Added route-level Vitest coverage for quote approval flow (`/api/admin/quotes/[id]/approval`) validating `requirePOForQuoteApproval` forwarding and service validation propagation.
- Performed live runtime checks in `TEST_MODE` for quote create/approve/convert, department assign/transition, and timer start/pause/resume/finish behavior.
- Logged high-priority backend flow defects discovered during runtime verification.

### Files touched
- `src/app/api/admin/quotes/[id]/convert/__tests__/route.test.ts`
- `src/app/api/admin/quotes/[id]/approval/__tests__/route.test.ts`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npm run test -- src/app/api/admin/quotes/[id]/convert/__tests__/route.test.ts src/app/api/admin/quotes/[id]/approval/__tests__/route.test.ts`
- `npm run test`
- `TEST_MODE=true npm run dev -- --hostname 0.0.0.0 --port 3000`
- Runtime verification scripts:
  - `python` + `curl` flow scripts for admin quote APIs, order department transition APIs, and timer APIs.

### Verification evidence
- New route tests passed and full Vitest suite passed.
- Runtime API verification succeeded for quote creation/conversion request paths and department transition guard behavior.
- Runtime API verification exposed test-mode state inconsistencies in timer lifecycle and cross-domain quote→order visibility.

### Next steps
- [ ] Add transactional/DB-backed conversion guard to prevent duplicate `orderNumber` creation under contention.
- [ ] Unify `TEST_MODE` storage strategy across quote/orders/time flows (all mock or all DB-backed) to avoid split-brain runtime behavior.
- [ ] Fix timer `TEST_MODE` user identity mismatch (auth user id vs mock seed user id) so active/pause/resume/finish behave coherently after start.

## Session Handoff — 2026-02-26 (QA findings remediation)

Goal (1 sentence): Fix the highest-impact backend issues identified in QA by hardening quote→order numbering and removing TEST_MODE state divergence.

### What changed
- Changed TEST_MODE repo behavior to use Prisma repos by default, with mock repos now opt-in only via `TEST_MODE_USE_MOCK_REPOS=true`.
- Added Vitest setup file (`src/test/setup-env.ts`) to keep test runs on mock repos without changing production/test-mode runtime behavior.
- Moved quote→order `orderNumber` generation into the conversion transaction in `convertQuoteToOrder`.
- Updated conversion route to return generated `orderNumber` from conversion result.
- Added `@unique` guard to `Order.orderNumber` in Prisma schema.

### Files touched
- `src/repos/index.ts`
- `vitest.config.ts`
- `src/test/setup-env.ts`
- `src/modules/quotes/quotes.repo.ts`
- `src/app/api/admin/quotes/[id]/convert/route.ts`
- `src/app/api/admin/quotes/[id]/convert/__tests__/route.test.ts`
- `prisma/schema.prisma`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npm run test`
- `TEST_MODE=true npm run dev -- --hostname 0.0.0.0 --port 3000`
- Runtime script: python/curl for quote create/convert/order fetch and timer start/active/pause.

### Verification evidence
- Full Vitest suite passed after repo-selection and conversion changes.
- Runtime TEST_MODE verification showed:
  - successful quote conversion returns order id + number,
  - `/api/orders/{id}` resolves converted order,
  - timer start/active/pause flow remains coherent.

### Next steps
- [ ] Run `prisma migrate dev` to materialize the new `Order.orderNumber` uniqueness constraint in migration history.
- [ ] Consider honoring requested `operation` in `/api/timer/start` (currently hardcoded to `Part Work`).
## Session Handoff — 2026-04-08 (Quote template detail-control expansion)

Goal (1 sentence): Give admins finer control over quote print templates, especially part-detail visibility and whether add-on/labor prices appear.

### What changed
- Updated `src/lib/quote-print-layout.ts`
  - Added structured option sets for `scope`, `addons_labor`, and `requirements` blocks.
- Updated `src/app/admin/templates/TemplatesClient.tsx`
  - Added new option panels in the template editor for:
    - `Line Items / Scope`: part number, qty, pieces, material, stock size, cut length, description/finish, notes.
    - `Addons/Labor`: prices, units, notes, part context, vendor items.
    - `Notes/Requirements`: materials, purchased items, requirements, notes.
- Updated `src/app/admin/quotes/[id]/print/page.tsx`
  - Quote print now honors those block options, including hiding add-on prices while still listing the work items.
  - Scope block now renders the requested part details conditionally instead of using one hardcoded layout.
- Added focused mapping coverage in `src/lib/__tests__/quote-print-layout.test.ts`.

### Files touched
- `src/lib/quote-print-layout.ts`
- `src/lib/__tests__/quote-print-layout.test.ts`
- `src/app/admin/templates/TemplatesClient.tsx`
- `src/app/admin/quotes/[id]/print/page.tsx`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npm run test -- src/lib/__tests__/quote-print-layout.test.ts`
- `npm run lint`

### Verification evidence
- Targeted quote-print-layout tests passed.
- Lint passed with no ESLint warnings/errors.

### Next steps
- [ ] User verify in `/admin/templates` that the new block options appear where expected and in `/admin/quotes/[id]/print` that toggles like `Show prices` for `Addons/Labor` affect output as intended.

---
## Session Handoff — 2026-04-08 (Quote template detail-control expansion)

Goal (1 sentence): Give admins finer control over quote print templates, especially part-detail visibility and whether add-on/labor prices appear.

### What changed
- Updated `src/lib/quote-print-layout.ts`
  - Added structured option sets for `scope`, `addons_labor`, and `requirements` blocks.
- Updated `src/app/admin/templates/TemplatesClient.tsx`
  - Added new option panels in the template editor for:
    - `Line Items / Scope`: part number, qty, pieces, material, stock size, cut length, description/finish, notes.
    - `Addons/Labor`: prices, units, notes, part context, vendor items.
    - `Notes/Requirements`: materials, purchased items, requirements, notes.
- Updated `src/app/admin/quotes/[id]/print/page.tsx`
  - Quote print now honors those block options, including hiding add-on prices while still listing the work items.
  - Scope block now renders the requested part details conditionally instead of using one hardcoded layout.
- Added focused mapping coverage in `src/lib/__tests__/quote-print-layout.test.ts`.

### Files touched
- `src/lib/quote-print-layout.ts`
- `src/lib/__tests__/quote-print-layout.test.ts`
- `src/app/admin/templates/TemplatesClient.tsx`
- `src/app/admin/quotes/[id]/print/page.tsx`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npm run test -- src/lib/__tests__/quote-print-layout.test.ts`
- `npm run lint`

### Verification evidence
- Targeted quote-print-layout tests passed.
- Lint passed with no ESLint warnings/errors.

### Next steps
- [ ] User verify in `/admin/templates` that the new block options appear where expected and in `/admin/quotes/[id]/print` that toggles like `Show prices` for `Addons/Labor` affect output as intended.

---
## Session Handoff — 2026-04-08 (Orders page syntax hotfix)

Goal (1 sentence): Fix the `/orders/[id]` compile error caused by mixing `??` with `||` in the manual department-move prompt.

### What changed
- Updated `src/app/orders/[id]/page.tsx`
  - Replaced the mixed nullish/logical fallback expression with a dedicated `currentDepartmentLabel` value before the prompt string.

### Files touched
- `src/app/orders/[id]/page.tsx`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npm run lint`

### Verification evidence
- Lint passed with no ESLint warnings/errors.

### Next steps
- [ ] User verify `/orders/[id]` and `/admin` load again without the compile-time 500s.

---
## Session Handoff — 2026-04-09 (Order-detail department + timer follow-up)

Goal (1 sentence): Make converted/new orders default part ownership to Machining/first department, stop apparent checklist-driven auto department moves on order detail, and reduce the timer panel footprint so parts stay visually primary.

### What changed
- Updated `src/modules/orders/orders.service.ts`
  - Added `initializeCurrentDepartmentForOrder(orderId)` helper.
  - `createOrderFromPayload()` now initializes part ownership immediately after order creation/checklist sync.
  - `getOrderDetails()` no longer infers a missing `currentDepartmentId` from open checklist rows; it now falls back only to the first active department.
  - Missing-department backfill/initialization now assigns the first active department instead of deriving a later stage from checklist completion.
- Updated `src/app/api/admin/quotes/[id]/convert/route.ts`
  - Quote conversion now initializes order-part department ownership right after checklist sync, so converted parts persist the default first department immediately.
- Updated `src/app/orders/[id]/page.tsx`
  - Narrowed the left rail from `360px` to `320px`.
  - Shortened timer status/action labels and changed the manual move CTA to default toward the next ordered department (`Submit to ...`).
  - Added a `Show details` toggle so time-history and manual time notes no longer consume left-rail space by default.
- Updated `src/modules/orders/__tests__/orders.service.test.ts`
  - Added regression coverage proving new parts initialize to Machining/first department.
  - Added regression coverage proving a null-owned part does not visually jump to the next department after checklist completion.
- Updated continuity docs and added Decision Log entry in `docs/AGENT_CONTEXT.md`.

### Files touched
- `src/modules/orders/orders.service.ts`
- `src/app/api/admin/quotes/[id]/convert/route.ts`
- `src/app/orders/[id]/page.tsx`
- `src/modules/orders/__tests__/orders.service.test.ts`
- `docs/AGENT_CONTEXT.md`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npm run test -- src/modules/orders/__tests__/orders.service.test.ts`
- `npm run lint`

### Verification evidence
- Targeted Orders service tests passed (7/7).
- Lint passed with no ESLint warnings/errors.

### Next steps
- [ ] User verify on `/orders/[id]` that converted parts now land in Machining/current first department instead of showing `Unassigned`.
- [ ] User verify that checking the last checklist item no longer makes the part appear to auto-move departments before using the manual submit/move action.
- [ ] Optional follow-up: if the owner wants an even more aggressive left-rail reduction, split timer controls and part list into separate stacked cards on mobile/tablet breakpoints only.
## Session Handoff — 2026-04-10 (BOM analyzer PDF runtime loader fix)

Goal (1 sentence): Fix the PDF analyzer runtime import strategy so PDF uploads succeed on the live local Next server, especially on port `3000`.

### What changed
- Updated `src/app/api/print-analyzer/analyze/route.ts`
  - Removed the earlier `createRequire` / filesystem-path PDF module loading approach that failed inside the Next bundled route runtime.
  - Switched both `pdfjs-dist` and `@napi-rs/canvas` loading to runtime dynamic imports.
  - Kept the existing page-1 PDF rasterization behavior and analyzer pipeline intact.
- Local runtime verification
  - Reclaimed port `3000` from the stale local Next process and restarted the updated workspace there.
  - Confirmed the live analyzer route now accepts a PDF request successfully on `http://127.0.0.1:3000`.

### Files touched
- `src/app/api/print-analyzer/analyze/route.ts`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npm run lint`
- `node -` (live PDF smoke test against `http://127.0.0.1:3000/api/print-analyzer/analyze`)

### Verification evidence
- Lint passed with no ESLint warnings/errors.
- Live PDF analyzer request on port `3000` returned `200` with structured JSON instead of the earlier module-resolution error.

### Next steps
- [ ] Push this runtime-loader follow-up to the existing PR branch so the GitHub PR matches the working local server.

## Session Handoff — 2026-04-09 (BOM analyzer PDF upload support)

Goal (1 sentence): Let the BOM analyzer accept PDFs by rasterizing page 1 to an image before running the existing analyzer flow.

### What changed
- Updated `src/app/orders/[id]/PartBomTab.tsx`
  - BOM upload input now accepts `image/*,application/pdf`.
  - Stored attachment picker now includes PDF print attachments instead of filtering them out as unsupported non-images.
  - Attachment-loading copy/errors now refer to supported print files rather than image-only files.
- Updated `src/app/private/print-analyzer/page.tsx`
  - Private analyzer upload input now accepts `image/*,application/pdf`.
  - Page copy now explicitly says image or PDF.
- Updated `src/app/api/print-analyzer/analyze/route.ts`
  - Route now accepts `data:application/pdf`.
  - Added server-side PDF page-1 rasterization using `pdfjs-dist` + `@napi-rs/canvas`.
  - Existing OpenAI/sharp image-analysis pipeline remains unchanged after PDF-to-PNG conversion.
- Updated `docs/PRINT_ANALYZER.md`
  - Documented PDF support and clarified that current behavior analyzes the first page.
- Updated `docs/AGENT_CONTEXT.md`
  - Added Decision Log entry for the new PDF-rendering dependency choice.
- Installed dependencies
  - `pdfjs-dist`
  - `@napi-rs/canvas`

### Files touched
- `package.json`
- `package-lock.json`
- `src/app/orders/[id]/PartBomTab.tsx`
- `src/app/private/print-analyzer/page.tsx`
- `src/app/api/print-analyzer/analyze/route.ts`
- `docs/PRINT_ANALYZER.md`
- `docs/AGENT_CONTEXT.md`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npm install pdfjs-dist @napi-rs/canvas`
- `npm run lint`
- `npm run build`
- `node -` (runtime PDF rasterization sanity check against `storage/sterling-tool-and-die/s-k-industrial/std-1007/tdc-british-standard-pipe-threads-1-d367a7f6-608a-47c9-8cea-274c3f180503.pdf`)

### Verification evidence
- Lint passed with no ESLint warnings/errors.
- Runtime PDF rasterization succeeded with `pdfjs-dist` + `@napi-rs/canvas`: `pdf-render-ok:303905:1224x1584`.
- `npm run build` still fails in this environment due the existing `next/font` Roboto fetch / `127.0.0.1:9` connection issue, but the PDF-renderer native-module webpack parse failure introduced during this work is gone.

### Next steps
- [ ] User verify on `/orders/[id]` BOM tab that uploading a PDF or selecting a stored PDF print attachment now analyzes successfully.
- [ ] Optional follow-up: expose page-selection for multi-page PDFs if the shop starts uploading packet-style prints.


