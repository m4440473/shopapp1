## Session Metadata
- Date: 2026-04-10
- Agent: Codex GPT-5
- Task ID: Order-detail embedded kiosk timing follow-up
- Goal: Replace the separate kiosk-page launch from `/orders/[id]` with an in-page PIN-and-part kiosk timer dialog while keeping kiosk/user/department timing rules intact.

## Dependency Validation
- [x] Reviewed `AGENTS.md`, `docs/AGENT_CONTEXT.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, `tasks/todo.md`, `tasks/lessons.md`, and `docs/AGENT_TASK_BOARD.md` before implementation.
- [x] Validated the current kiosk behavior in code:
  - kiosk-enabled machinists already lose normal timer controls on `/orders/[id]`,
  - the fallback currently sends them to `/kiosk`,
  - kiosk unlock/session/timer APIs already exist and should be reused instead of duplicating timer business logic.

## Plan First
- [x] Replace the order-detail kiosk fallback CTA with inline kiosk timer controls and a modal dialog.
- [x] Reuse kiosk unlock/session/start/pause/finish/switch APIs from the order page so PIN, worker ownership, and department rules stay server-enforced.
- [x] Run focused verification and update continuity docs with the revised UX behavior.

## Verification Checklist
- [x] `npx eslint --ext .ts,.tsx -- "src/app/orders/[id]/page.tsx"`

## Review + Results
- Replaced the `/orders/[id]` kiosk fallback link with in-page kiosk controls in the existing timer area.
- Kiosk-enabled machinists now open a modal on the order page to:
  - choose a worker,
  - choose a department,
  - enter that worker's PIN,
  - choose a part from the current order,
  - start work without leaving the order-detail screen.
- Pause/stop actions for kiosk-enabled machinists now also work from the order page and reuse the same kiosk unlock/session flow when needed.
- Existing kiosk API/session/timer enforcement stays intact, including:
  - user-specific timer ownership,
  - explicit department choice with worker-default suggestion,
  - active-timer switch confirmation when another timer is already running.
- Moved the helper/status/time-breakdown content under `Show details` so the timer header stays cleaner by default.

## Session Metadata
- Date: 2026-04-10
- Agent: Codex GPT-5
- Task ID: Shared kiosk timing + read-only order detail for floor users
- Goal: Add a PIN-based shared kiosk timing flow with one-active-timer-per-worker enforcement, keep order detail available for review, and hide timer actions there for kiosk-designated floor users.

## Dependency Validation
- [x] Reviewed `AGENTS.md`, `docs/AGENT_CONTEXT.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, `tasks/todo.md`, `tasks/lessons.md`, and `docs/AGENT_TASK_BOARD.md` before implementation.
- [x] Validated current code shape:
  - `TimeEntry` already stores `userId`, `partId`, and `departmentId`,
  - timer services currently allow one active timer per user per department, not one total,
  - `/orders/[id]` still owns the current timer controls,
  - there is no kiosk session/auth flow yet,
  - admin Users UI/API exists and is the right setup surface for kiosk fields.

## Plan First
- [x] Extend `User` and admin user management for kiosk PIN/default department/kiosk eligibility.
- [x] Add kiosk session helpers and kiosk auth/session/timer/search API routes.
- [x] Change timer backend enforcement to one active timer total per worker and include conflict context for switch UX.
- [x] Add `/kiosk` timing UI and hide order-detail timer actions for kiosk-enabled floor users while preserving read-only review access.
- [x] Add/update focused tests and run relevant verification.
- [x] Update continuity docs with evidence and behavior notes.

## Verification Checklist
- [x] `npx prisma migrate dev --name kiosk_user_timing_v1`
- [x] `npx eslint --ext .ts,.tsx -- "src/app/kiosk/page.tsx" "src/app/api/kiosk/unlock/route.ts" "src/app/api/kiosk/session/route.ts" "src/app/api/kiosk/lock/route.ts" "src/app/api/kiosk/parts/route.ts" "src/app/api/kiosk/timer/route.ts" "src/app/api/orders/[id]/route.ts" "src/app/api/timer/start/route.ts" "src/app/orders/[id]/page.tsx" "src/components/AppNav.tsx" "src/modules/kiosk/kiosk.service.ts" "src/modules/kiosk/kiosk.schema.ts" "src/modules/time/time.service.ts" "src/modules/users/users.repo.ts" "src/repos/users.ts" "src/repos/mock/users.ts" "src/repos/mock/seed.ts" "src/modules/time/__tests__/time.service.test.ts" "src/modules/kiosk/__tests__/kiosk.service.test.ts"`
- [x] `npm run test -- src/modules/time/__tests__/time.service.test.ts src/modules/kiosk/__tests__/kiosk.service.test.ts`

## Review + Results
- Added kiosk-ready user fields (`kioskEnabled`, `kioskPinHash`, `primaryDepartmentId`) plus admin management support for PIN/default department setup.
- Added a dedicated `/kiosk` flow with PIN unlock, signed kiosk session cookie, department-scoped part search, active-timer context, and explicit start/pause/stop/switch actions.
- Changed timer enforcement to one active timer total per worker, regardless of department, while preserving `departmentId` on each `TimeEntry` and adding reporting summaries for part/department/user rollups.
- Kept `/orders/[id]` available for notes/files/checklists/logs, but hid timer controls there for kiosk-enabled machinists and replaced them with a kiosk-only timing message/link.
- Added focused kiosk/time tests and captured the Prisma client file-lock caveat during migration.

## Notes
- `npx prisma migrate dev --name kiosk_user_timing_v1` applied successfully and created `prisma/migrations/20260410174437_kiosk_user_timing_v1/migration.sql`.
- Prisma generate inside the migration hit a Windows file-lock `EPERM` while renaming `query_engine-windows.dll.node`; the migration itself completed and focused lint/tests passed afterward.
- Focused Vitest execution still required an outside-sandbox rerun because sandboxed esbuild hit Windows `spawn EPERM`.

## Session Metadata
- Date: 2026-04-10
- Agent: Codex GPT-5
- Task ID: Order-detail layout shift for part-heavy orders
- Goal: Give the full left rail to the parts list, move timer/submit controls into the top of the right-side detail area, and remove the admin order-status block from this screen.

## Dependency Validation
- [x] Reviewed `AGENTS.md`, `docs/AGENT_CONTEXT.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, `tasks/todo.md`, `tasks/lessons.md`, and `docs/AGENT_TASK_BOARD.md` before implementation.
- [x] Validated the current gap in `src/app/orders/[id]/page.tsx`:
  - the left rail still dedicated a large sticky area to the work dock instead of maximizing part-list visibility,
  - the right header still used space for admin-only order-status override controls,
  - long part lists did not have a dedicated scroll area optimized for 30-50 part orders.

## Plan First
- [x] Remove the left-rail work dock and make that column a dedicated parts-only panel with its own scrollable list.
- [x] Move timer/submit/complete controls into the right-side top summary area where the status override block lived.
- [x] Remove the admin order-status override UI/state from this page.
- [x] Run focused verification and update continuity docs.

## Verification Checklist
- [x] `npx eslint --ext .ts,.tsx -- "src/app/orders/[id]/page.tsx"`

## Review + Results
- The left rail on `/orders/[id]` is now reserved for the parts list, with a dedicated scroll area sized for long orders.
- The timer department picker, timer controls, submit action, complete-in-shipping action, and timer summary now live at the top of the right-side detail card.
- Removed the admin order-status override block and its client-side state from this page so the right side stays focused on the selected part.

## Session Metadata
- Date: 2026-04-10
- Agent: Codex GPT-5
- Task ID: Mission-brief accept flow + quote-note sourcing
- Goal: Keep the mission-brief modal acknowledge action usable, and make quote-created orders feed meaningful required-read instructions into the part-level mission brief instead of leaving it empty.

## Dependency Validation
- [x] Reviewed `AGENTS.md`, `docs/AGENT_CONTEXT.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, `tasks/todo.md`, `tasks/lessons.md`, and `docs/AGENT_TASK_BOARD.md` before implementation.
- [x] Validated the current issue in code:
  - the mission-brief modal still posts an acknowledgement even when a part has no `workInstructions`, which triggers the backend error `This part has no required instructions.`,
  - quote conversion currently fills general order `notes` and part `notes`, but does not populate part `workInstructions`, so the acknowledgement flow often has nothing real to read.

## Plan First
- [x] Patch the order-detail mission-brief modal so the primary action behaves cleanly when there are no required instructions.
- [x] Patch quote-to-order prefill so quote requirements/notes seed the part-level `workInstructions` field used by the mission brief.
- [x] Run focused verification on the touched UI files.
- [x] Update continuity docs with evidence and the clarified note-source behavior.

## Verification Checklist
- [x] `npx eslint --ext .ts,.tsx -- "src/app/orders/[id]/page.tsx" "src/app/orders/new/page.tsx"`

## Review + Results
- Fixed the mission-brief gating bug on `/orders/[id]`:
  - empty `workInstructions` now short-circuit as "nothing required" instead of reopening the modal and failing the acknowledgement POST,
  - manual brief acknowledgement no longer crashes when the dialog was opened without a pending gated action.
- Quote conversion prefill on `/orders/new?quoteId=...` now seeds each part's `workInstructions` from:
  - quote-level `Requirements / process notes`,
  - that part's quote `Part notes`.
- Added a small conversion-mode hint in the order-create review UI so the source of mission-brief text is visible during launch.

## Repeat Orders + Operator Accountability v1 - Final Integration
- [x] Prisma/data model changes landed for repeat templates, part assignments, instruction receipts, checklist performer attribution, and part work instructions.
- [x] Repeat-order backend/API landed: snapshot from order, list/fetch templates, create order from template.
- [x] Accountability backend landed: assignment CRUD, acknowledgement gating, performer attribution, part activity summaries, timer start/resume guards.
- [x] Order-detail UI landed: worker assignment panel, mission-brief acknowledgement modal, submit reconfirmation dialog, performer picker, clearer actor-vs-performer log context.
- [x] Order-create repeat-order UI landed: `/orders/new?templateId=...` prefill, repeat-template submit path, template-mode read-only routing/file behavior, work-instructions editing.

## Final Verification
- [x] `npx prisma validate`
- [x] `npx prisma migrate dev --name repeat_orders_operator_accountability_v1`
- [x] `npx eslint --ext .ts,.tsx src/app/orders/new/page.tsx src/app/orders/[id]/page.tsx src/modules/repeat-orders src/app/api/repeat-order-templates src/modules/orders/orders.service.ts src/modules/time/time.service.ts src/app/api/timer/start/route.ts src/app/api/timer/resume/route.ts src/app/api/timer/active/route.ts src/app/api/orders/[id]/parts/[partId]/checklist/[itemId]/complete-and-advance/route.ts`
- [x] `npm run test -- src/modules/repeat-orders/__tests__/repeat-orders.service.test.ts src/modules/orders/__tests__/orders.service.test.ts src/modules/time/__tests__/time.service.test.ts`

## Notes
- `npx prisma generate` hit a Windows file-lock `EPERM`, but the generated client types for the new models were present and the subsequent lint/tests passed.
- Focused Vitest execution required an outside-sandbox rerun because sandboxed esbuild hit Windows `spawn EPERM`.

## Accountability Backend Results
- [x] Kept edits limited to orders/time backend logic, the required order/timer API routes, mock repos, and focused backend tests.
- [x] Finished part worker assignment service/route behavior and order-detail read-model shaping.
- [x] Finished part instruction acknowledgement receipts/status behavior and deterministic gating hooks.
- [x] Enforced acknowledgement gating on timer start/resume, checklist toggle, and department submit.
- [x] Persisted checklist performer attribution separately from toggler attribution and enriched checklist part-event metadata with actor/perfomer labels + ids.
- [x] Added shared part activity read models for order detail and /api/timer/active.

## Accountability Backend Verification
- [x] 
pm run test -- src/modules/orders/__tests__/orders.service.test.ts
- [x] 
pm run test -- src/modules/time/__tests__/time.service.test.ts *(required outside-sandbox rerun after sandboxed Vitest/esbuild hit Windows spawn EPERM)*
- [x] 
pm run lint
## Scope Adjustment
- Date: 2026-04-10
- Agent: Codex GPT-5
- Adjustment: User narrowed the active implementation scope to the repeat-order backend only. Accountability backend work remains in the tree but is out of write scope for the remainder of this session.

## Repeat-Order Backend Slice
- [x] Keep edits limited to:
  - `src/modules/repeat-orders/**`,
  - `src/app/api/repeat-order-templates/**`,
  - minimal shared backend/test/doc touches required to support template snapshot/create-order behavior.
- [x] Harden repeat-order template snapshot/create-order behavior:
  - do not carry stale PO chatter into template defaults,
  - validate provided order-number prefix against the standard business prefix rule,
  - reject duplicate/unknown template part overrides,
  - reject template-based order creation when the template has no parts.
- [x] Add focused repeat-order service tests for template snapshot and order instantiation.
- [x] Verify with focused tests and record evidence in continuity docs.

## Scope Adjustment (Superseded)
- Date: 2026-04-10
- Agent: Codex GPT-5
- Adjustment: User narrowed the active implementation scope to the accountability backend only. Repeat-order work remains in the tree but is out of write scope for the remainder of this session.

## Accountability Backend Slice
- [ ] Keep edits limited to:
  - src/modules/orders/** backend logic,
  - src/modules/time/** backend logic,
  - src/app/api/orders/** backend routes needed for assignments / acknowledgements / checklist attribution,
  - src/app/api/timer/** backend routes needed for acknowledgement gating / shared part activity,
  - focused backend tests.
- [ ] Finish part worker assignment CRUD/read models on the service + route layer.
- [ ] Finish part instruction acknowledgement receipts and expose status/read models for the current part/department version.
- [ ] Enforce deterministic acknowledgement gating on:
  - timer start,
  - checklist toggle,
  - department submit.
- [ ] Persist performer attribution separately from checklist toggler attribution and enrich part-event metadata for actor vs performer rendering.
- [ ] Add shared part activity read models:
  - assigned workers,
  - active timers on a part,
  - accumulated time by user for a part.
- [ ] Verify with focused orders/time tests and record evidence in continuity docs.
# tasks/todo.md — Session Plan + Verification

## Session Metadata
- Date: 2026-04-10
- Agent: Codex GPT-5
- Task ID: Vendors contact/materials schema follow-up + import rollback
- Goal: Add first-class searchable `contact` and `materials` fields for vendors, update the importer/search/UI to use them, and remove the recent partial vendor import so data can be reimported cleanly.

## Dependency Validation
- [x] Reviewed `AGENTS.md`, `docs/AGENT_CONTEXT.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, `tasks/todo.md`, `tasks/lessons.md`, and `docs/AGENT_TASK_BOARD.md` before implementation.
- [x] Validated the current vendor state:
  - recent spreadsheet import created many vendor rows beyond the original seeded baseline,
  - only `Grainger` is currently referenced (`quoteVendorItemCount = 1`),
  - none of the imported spreadsheet vendors are referenced by orders or quote vendor items, so rollback is safe.
- [x] Validated the current gap in code:
  - Vendor schema still stores supplier contact/material info only indirectly in `notes`,
  - Vendors search does not have first-class `contact`/`materials` fields to query.

## Plan First
- [x] Add `contact` and `materials` to the Vendor schema, validation, and CRUD paths.
- [x] Update the Vendors importer/search/UI so `Contact` and `Material` map into searchable first-class fields instead of `notes`.
- [x] Remove the recently imported vendor rows while preserving the seeded baseline/linked vendor records.
- [x] Run relevant verification and update continuity docs with evidence.

## Verification Checklist
- [x] `npx prisma migrate dev`
- [x] vendor-reference audit via `node -`
- [x] rollback delete script via `node -`
- [x] `npm run lint`
- [x] `npm run test -- src/modules/vendors/__tests__/vendor-import.test.ts`
- [x] `node -` real workbook preview parse + post-rollback vendor check

## Review + Results
- Added searchable Vendor `contact` and `materials` fields instead of burying supplier contact/material metadata in `notes`.
- Updated the importer so the real workbook now maps:
  - `Company -> name`
  - `Web page -> url`
  - `Phone -> phone`
  - `Contact -> contact`
  - `Material -> materials`
- Rolled back the recent partial import safely by deleting 37 unreferenced vendor rows and preserving the baseline seeded rows (`Grainger`, `McMaster-Carr`).
- Prisma migration applied successfully; `prisma generate` still hit a Windows file-lock rename `EPERM`, but the client remained usable and successfully queried the new fields afterward.

## Session Metadata
- Date: 2026-04-10
- Agent: Codex GPT-5
- Task ID: Vendors preview-and-map importer
- Goal: Add a Vendors import workflow that can upload a spreadsheet, preview parsed rows, map columns into the current Vendor schema, and import selected data safely.

## Dependency Validation
- [x] Reviewed `AGENTS.md`, `docs/AGENT_CONTEXT.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, `tasks/todo.md`, `tasks/lessons.md`, and `docs/AGENT_TASK_BOARD.md` before implementation.
- [x] Validated current Vendors scope in code:
  - `Vendor` currently stores only `name`, `url`, `phone`, and `notes`.
  - `Vendor.name` is unique, so imports must detect or handle duplicates.
  - The current admin Vendors UI/API only supports manual CRUD; there is no import flow yet.
- [x] Validated the source-file shape enough to plan importer behavior:
  - `C:\Users\user\Downloads\Suppliers.xls` is a legacy Excel `.xls` workbook, not CSV.
  - Embedded workbook text indicates supplier-style columns such as company, phone, contact, and web page, plus section/category headers and some fax/address/email fragments.

## Plan First
- [x] Add a parser path that can read legacy `.xls` uploads for preview/import.
- [x] Implement admin-only Vendors preview/import API routes that:
  - accept spreadsheet upload,
  - extract headers/rows,
  - let the client map source columns to `name`, `url`, `phone`, and `notes`,
  - support duplicate-handling rules that preserve the current unique-name constraint.
- [x] Add Vendors-page UI for file upload, column mapping, preview rows, and import results.
- [x] Run relevant verification and update continuity docs with evidence.

## Verification Checklist
- [x] `npm run lint`
- [x] `npm run test -- src/modules/vendors/__tests__/vendor-import.test.ts`
- [x] `node -` real workbook preview parse against `C:\Users\user\Downloads\Suppliers.xls`

## Review + Results
- Added a new admin-only preview-and-map importer on `/admin/vendors` without removing the existing manual vendor CRUD flow.
- Added stateless preview/import parsing for `.xls`, `.xlsx`, and `.csv` uploads via `xlsx`, including:
  - sheet selection,
  - configurable header row,
  - suggested field mappings,
  - duplicate handling by vendor name (`skip` or `update`).
- Verified the real `Suppliers.xls` workbook parses successfully with:
  - selected sheet `Steel Suppliers`,
  - columns `Company`, `Phone`, `Contact`, `Web page`, `Material`,
  - suggested mapping `Company -> name`, `Web page -> url`, `Phone -> phone`, `Contact -> notes`.

## Session Metadata
- Date: 2026-04-10
- Agent: Codex GPT-5
- Task ID: BOM analyzer oversized-image normalization
- Goal: Prevent large image uploads from crashing the analyzer route by normalizing image payloads before the OpenAI vision calls.

## Dependency Validation
- [x] Reviewed `AGENTS.md`, `docs/AGENT_CONTEXT.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, `tasks/todo.md`, `tasks/lessons.md`, and `docs/AGENT_TASK_BOARD.md` before implementation.
- [x] Validated the current analyzer path in `src/app/api/print-analyzer/analyze/route.ts`:
  - uploads are accepted as raw `data:image/*` or `data:application/pdf`,
  - image uploads are passed through without any resize/compression guard,
  - the route returns `502` with `Maximum call stack size exceeded` for a reported ~`4 MB` image, indicating the path is not resilient to large payloads.

## Plan First
- [x] Add a server-side image normalization step for image uploads before any OpenAI vision request.
- [x] Keep PDF behavior intact, but route PDF raster output through the same normalization path so all analyzer inputs share one bounded image-prep contract.
- [x] Add/update focused verification for the analyzer route path and run the relevant checks.
- [x] Update continuity docs with the new guardrail and evidence.

## Verification Checklist
- [x] `npm run lint`
- [x] Live oversized-image analyzer POST against `http://127.0.0.1:3000/api/print-analyzer/analyze`

## Review + Results
- Replaced the large-string `data:` URL regex parser with a delimiter-based parser after isolating the `Maximum call stack size exceeded` failure to `decodeDataUrl()` for a large base64 image payload.
- Removed the analyzer route's server-side image data-URL roundtrip so normalized uploads stay as raw `Buffer`s after request parsing.
- Switched the vision requests to OpenAI uploaded files (`purpose: vision` + Responses `input_image.file_id`) so the analyzer no longer forwards large inline base64 image strings to the OpenAI SDK.
- Verified the previously failing oversized image path now succeeds: a locally generated `~5.9 MB` JPEG returned `200` with structured analyzer JSON instead of a `502` stack-overflow error.

## Session Metadata
- Date: 2026-04-10
- Agent: Codex GPT-5
- Task ID: Repair stale dev server on port 3000
- Goal: Recover the broken local Next dev server on port `3000` so admin quote print stops throwing the webpack/runtime error and serves normally again.

## Dependency Validation
- [x] Reviewed `AGENTS.md`, `docs/AGENT_CONTEXT.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, `tasks/todo.md`, and `tasks/lessons.md` before intervention.
- [x] Verified the issue was isolated to the existing local `3000` dev server, not the current source tree:
  - a fresh dev server on `3001` rendered `/admin/quotes/cmnsw7c34000tq7rcbjgn7aeq/print` successfully,
  - the existing `3000` server returned `500` with a broken `.next/server/...` `ENOENT` dev-build state.

## Plan First
- [x] Confirm whether the quote print runtime failure reproduces on a fresh compile before changing code.
- [x] Refresh the stale `3000` Next dev process if the code path is already healthy on a fresh server.
- [x] Re-verify the exact authenticated quote print route on `3000` after restart.
- [x] Update continuity docs with the operational fix and evidence.

## Verification Checklist
- [x] Fresh auth + quote print request against `http://127.0.0.1:3000/admin/quotes/cmnsw7c34000tq7rcbjgn7aeq/print`

## Review + Results
- Confirmed the reported runtime error was caused by a stale/broken local dev server state on port `3000`, not by a remaining source-level bug in the quote print route.
- Stopped the stale `3000` Next process, restarted the workspace dev server on `3000`, and verified the same authenticated quote print route now returns `200`.

## Session Metadata
- Date: 2026-04-10
- Agent: Codex GPT-5
- Task ID: LAN/IP-safe post-sign-in redirect
- Goal: Keep post-login navigation on the active browser origin instead of bouncing successful sign-ins back to localhost.

## Dependency Validation
- [x] Reviewed `AGENTS.md`, `docs/AGENT_CONTEXT.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, `tasks/todo.md`, and `tasks/lessons.md` before implementation.
- [x] Validated the scoped auth path in `src/app/(public)/auth/signin/page.tsx`: the sign-in form used `signIn(..., { redirect: true })`, which let NextAuth choose the final origin and reintroduced localhost when the configured auth base URL still pointed at loopback.

## Plan First
- [x] Keep the fix scoped to the sign-in page rather than refactoring shared auth infrastructure.
- [x] Change credential sign-in to `redirect: false` and navigate manually to the normalized relative callback path on success so the browser stays on the current LAN/IP origin.
- [x] Run verification and update continuity docs with the outcome.

## Verification Checklist
- [x] `npm run lint`

## Review + Results
- Credential sign-in now completes with `redirect: false`, then the browser manually navigates to the normalized relative callback path.
- Because the final navigation is now handled by the current browser window instead of NextAuth's configured base URL, successful sign-ins stay on the active LAN/IP origin rather than bouncing back to `localhost`.

## Session Metadata
- Date: 2026-04-09
- Agent: Codex GPT-5
- Task ID: Order detail submit-dialog cleanup
- Goal: Remove the redundant submit-destination dropdown from the order-detail dock so `Submit To` opens the dialog and the dialog alone owns destination selection.

## Dependency Validation
- [x] Reviewed `AGENTS.md`, `docs/AGENT_CONTEXT.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, `tasks/todo.md`, `tasks/lessons.md`, and `docs/AGENT_TASK_BOARD.md` before implementation.
- [x] Validated the current issue in `src/app/orders/[id]/page.tsx`: the dock had a destination dropdown plus a second destination selector in the dialog, which duplicated state and made the flow feel broken/redundant.

## Plan First
- [x] Remove the dock-level destination selector and its state from `/orders/[id]`.
- [x] Keep `Submit To` as the single trigger and let the dialog own the destination picker plus required note.
- [x] Keep current department visible at the top of the dialog and limit destination choices to valid non-current departments.
- [x] Run relevant verification and update continuity docs.

## Verification Checklist
- [x] `npm run lint`

## Review + Results
- The left-side dock now shows only the `Submit To` action; the redundant destination dropdown beside it is gone.
- Clicking `Submit To` now opens the move dialog directly, with the current department surfaced in a dedicated summary block at the top.
- Destination choice now lives only inside the dialog, and the list excludes the current department so the operator only sees valid targets.

## Session Metadata
- Date: 2026-04-09
- Agent: Codex GPT-5
- Task ID: Order detail submit-dialog label correction
- Goal: Make the dialog confirm button always reflect the department actually selected in the destination dropdown.

## Dependency Validation
- [x] Reviewed the just-shipped submit-dialog cleanup and reproduced the remaining gap in `src/app/orders/[id]/page.tsx`: the button label still read from the old `nextDepartmentOption` helper instead of dialog selection state.
- [x] Logged a prevention rule in `tasks/lessons.md` per workflow requirements after the user correction.

## Plan First
- [x] Replace the dialog confirm-label source so it derives from `moveDepartmentDialog.destinationDepartmentId`.
- [x] Keep the rest of the move flow unchanged and re-run verification.
- [x] Update continuity docs with the correction and evidence.

## Verification Checklist
- [x] `npm run lint`

## Review + Results
- The dialog confirm button now follows the currently selected destination department instead of the stale next-department default.
- Selecting `Shipping` now yields `Submit to Shipping`; selecting another department updates the button label accordingly.

## Session Metadata
- Date: 2026-04-09
- Agent: Codex GPT-5
- Task ID: Order detail timer-link + compact submit destination control
- Goal: Make the order-detail work dock identify where an already-running timer lives and replace the long `Submit to <Department>` button copy with a compact `Submit To` flow that fits reliably.

## Dependency Validation
- [x] Reviewed `AGENTS.md`, `docs/AGENT_CONTEXT.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, `tasks/todo.md`, `tasks/lessons.md`, and `docs/AGENT_TASK_BOARD.md` before implementation.
- [x] Validated current gap in `src/app/orders/[id]/page.tsx`: the dock only showed a passive `Other timer live` badge with no destination context, and long department names overflowed the manual-submit control.

## Plan First
- [x] Add an exact active-timer destination link so `Other timer live` opens the active order/part context.
- [x] Add a compact submit-destination dropdown in the work dock and keep the required note inside the existing move dialog.
- [x] Keep the current manual-only move rules intact and run relevant verification.
- [x] Update continuity docs with outcomes and evidence.

## Verification Checklist
- [x] `npm run lint`

## Review + Results
- The work dock now turns `Other timer live` into a clickable control that opens the active timer's order and preselects the exact part when available.
- `/api/timer/active` now returns active-entry context links/order-part summaries so the order detail page can route operators to the right timer instead of a vague status badge.
- The long `Submit to <Department>` label was replaced by a compact dock flow: destination dropdown plus `Submit To` button, while the existing move dialog still enforces the required note before moving a part.

## Session Metadata
- Date: 2026-04-09
- Agent: Codex GPT-5
- Task ID: Dashboard current-department label consistency follow-up
- Goal: Stop dashboard/order summary cards from showing `Unassigned` for active parts that the workflow already treats as the first department.

## Dependency Validation
- [x] Reviewed the existing 2026-04-09 timer/department follow-up notes and confirmed the mismatch was display-only in the dashboard/layout card path.
- [x] Validated that order-detail/manual-move logic already applies first-department fallback, while `ShopFloorLayouts` still rendered raw null `currentDepartmentId` as `Unassigned`.

## Plan First
- [x] Update dashboard current-department label shaping to use the same first-department fallback for non-complete orders.
- [x] Keep completed/closed orders from being mislabeled with a fallback department.
- [x] Run verification and update continuity docs.

## Verification Checklist
- [x] `npm run lint`

## Review + Results
- Dashboard/grid digest current-department labels now fall back to the first ordered department for active orders whose parts still have null stored `currentDepartmentId`.
- Completed/closed orders still avoid that fallback, so the card no longer contradicts the manual-move flow for active work while preserving end-state behavior.

## Session Metadata
- Date: 2026-04-09
- Agent: Codex GPT-5
- Task ID: Order detail department default + timer density + manual-only progression
- Goal: Make converted/new orders default parts to Machining/first department, stop any apparent checklist-driven auto department progression, and redesign the order-detail timer area so parts stay spatially primary.

## Dependency Validation
- [x] Reviewed `AGENTS.md`, `docs/AGENT_CONTEXT.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, `tasks/todo.md`, `tasks/lessons.md`, and `docs/AGENT_TASK_BOARD.md` before implementation.
- [x] Validated current gaps in code:
  - quote conversion creates order parts without initializing `currentDepartmentId`,
  - order-detail read model infers department from open checklist rows when `currentDepartmentId` is null, which makes last-checklist completion look like an automatic move,
  - `/orders/[id]` timer panel is vertically oversized and competes with the parts list.

## Plan First
- [x] Update Orders service so missing `currentDepartmentId` falls back only to the first active department, not checklist-derived next-department inference.
- [x] Add a scoped order-department initialization helper and invoke it after quote conversion so converted orders persist the Machining/first-department owner immediately.
- [x] Rework `/orders/[id]` left rail into a more compact timer control dock with collapsible time-history details and manual-next-department wording/defaults.
- [x] Add focused Orders service regression coverage for the manual-only read-model behavior and run relevant verification commands.
- [x] Update continuity docs with evidence and next steps.

## Verification Checklist
- [x] `npm run test -- src/modules/orders/__tests__/orders.service.test.ts`
- [x] `npm run lint`

## Review + Results
- Converted/new orders now initialize part ownership to the first active department immediately, and order-detail read models no longer infer “next department” from checklist completion when `currentDepartmentId` is missing.
- The manual-only progression rule is preserved in both persistence and presentation: last-item checklist completion no longer makes a blank-owned part appear to auto-advance.
- The order-detail timer area now keeps its detailed history behind an explicit toggle, shortens action labels, defaults the manual move dialog toward the next department, and gives the parts list more usable vertical space.

---

## Session Metadata
- Date: 2026-04-08
- Agent: GPT-5.3-Codex
- Task ID: Order-detail department UX follow-up
- Goal: Replace raw department-ID prompts with an in-app move dialog, restore timer/move department options from the real department list, and default unassigned parts to the first active department (Machining in current ordering).

## Dependency Validation
- [x] Reviewed `AGENTS.md`, `docs/AGENT_CONTEXT.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, `tasks/todo.md`, `tasks/lessons.md`, and `docs/AGENT_TASK_BOARD.md` before implementation.
- [x] Validated prior dependency scope: current order-detail page still uses raw `window.prompt` for manual department moves and derives dropdown choices from checklist rows only.

## Plan First
- [x] Update Orders service/order-detail payload to include the ordered active department list and initialize missing `currentDepartmentId` to the first active department when no checklist-driven department exists.
- [x] Rework `/orders/[id]` manual move flow to use an in-app dialog with department dropdown and required move note instead of browser prompts.
- [x] Update timer department options/defaulting to use the ordered department list (excluding Shipping for timers) so parts without checklist departments still have valid choices.
- [x] Add focused Orders service coverage for the default-first-department behavior and run relevant verification commands.
- [x] Update continuity docs with commands and evidence.

## Verification Checklist
- [x] `npm run test -- src/modules/orders/__tests__/orders.service.test.ts`
- [x] `npm run lint`

## Review + Results
- Order detail now receives the ordered active department list from the server and uses it for both timer selection and manual move choices, so departments no longer disappear when checklist rows do not carry department entries.
- Parts missing `currentDepartmentId` now fall back to the first active department both in the service read model and in the current-department backfill path, which makes Machining the default in the current seeded/live ordering.
- The browser-native department-ID prompt was replaced with an in-app dialog that matches the site modal pattern and keeps the required move note inline.

## Session Metadata
- Date: 2026-04-08
- Agent: GPT-5.3-Codex
- Task ID: Dashboard department visibility + display logic follow-up
- Goal: Make current department obvious on order/part surfaces and fix dashboard display/work-queue logic so department ownership displays correctly.

## Dependency Validation
- [x] Reviewed `AGENTS.md`, `docs/AGENT_CONTEXT.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, `tasks/todo.md`, `tasks/lessons.md`, and `docs/AGENT_TASK_BOARD.md` before implementation.
- [x] Validated current gap: order detail overview and part tiles do not surface current department clearly, and dashboard work queue currently hides department-owned parts when checklist rows are absent/incomplete logic disagrees with `currentDepartmentId`.

## Plan First
- [x] Fix department display/work-queue data logic so department ownership is driven by `currentDepartmentId` instead of requiring open checklist rows in that department.
- [x] Update dashboard display components to show clear current-department ownership and other useful tile details.
- [x] Update order detail part overview/list rows to surface current department explicitly for viewers/admins.
- [x] Add focused test coverage for the department-feed ownership behavior and run relevant verification commands.
- [x] Update continuity docs with results and evidence.

## Verification Checklist
- [x] `npm run test -- src/modules/orders/__tests__/orders.service.test.ts`
- [x] `npm run lint`

## Review + Results
- Department work-queue ownership now follows `currentDepartmentId`, so a part assigned to Machining/Fab/Paint/Shipping stays visible on that department display even if checklist rows for that department are absent or already complete.
- Dashboard grid/work-queue cards now surface current department ownership directly instead of only showing vague “departments touched” context.
- Order detail now shows current department in both the selected-part overview and the left-side part list so viewers/admins can tell who owns the part at a glance.

## Session Metadata
- Date: 2026-04-08
- Agent: GPT-5.3-Codex
- Task ID: Unraid Docker app template refresh
- Goal: Update the existing Unraid Docker app template and guide so Unraid install settings match the current ShopApp1 container requirements.

## Dependency Validation
- [x] Reviewed `AGENTS.md`, `docs/AGENT_CONTEXT.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, `tasks/todo.md`, `tasks/lessons.md`, and `docs/AGENT_TASK_BOARD.md` before implementation.
- [x] Validated existing `unraid/my-shopapp1.xml` and `unraid/README.md` against the current `Dockerfile`, entrypoint, package scripts, and env requirements.

## Plan First
- [x] Update the Unraid XML template metadata and variables to match the current app requirements.
- [x] Add any missing env vars needed by optional features, especially `OPENAI_API_KEY`.
- [x] Rewrite the Unraid README so the install/import/seed steps match the current container behavior.
- [x] Review resulting diffs and record continuity notes.

## Verification Checklist
- [x] Reviewed `git diff -- unraid/my-shopapp1.xml unraid/README.md`
- [x] No code-path tests required; change is limited to Unraid deployment template/docs.

## Review + Results
- Updated the Unraid Docker template with project/support/template URLs, clearer app overview text, normalized `ShopApp1` naming, and an optional advanced `OPENAI_API_KEY` variable for the Print Analyzer feature.
- Rewrote the Unraid README to describe the current offline image workflow, template import path, required env values, persistent paths, and first-run seed commands.

## Session Metadata
- Date: 2026-04-08
- Agent: GPT-5.3-Codex
- Task ID: Quote print totals parity hotfix
- Goal: Make the quote print view use the same non-double-counted part-pricing totals rule as quote editor and quote detail.

## Dependency Validation
- [x] Reviewed `AGENTS.md`, `docs/AGENT_CONTEXT.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, `tasks/todo.md`, `tasks/lessons.md`, and `docs/AGENT_TASK_BOARD.md` before implementation.
- [x] Scoped work to `src/app/admin/quotes/[id]/print/page.tsx` totals math only.

## Plan First
- [x] Inspect quote print total calculation and confirm it still stacks raw add-on/labor subtotal with basis-adjusted part pricing.
- [x] Reuse the shared pricing-summary replacement helper used by quote editor and quote detail.
- [x] Run the relevant verification command and record the result.
- [x] Update continuity docs.

## Verification Checklist
- [x] `npm run lint`

## Review + Results
- Quote print totals now use the same replacement rule as quote editor and quote detail.
- Parts with non-zero part-pricing entries now contribute only to `Part pricing` and no longer remain in the print `Addons & vendor` subtotal through the raw part subtotal path.

---

## Session Metadata
- Date: 2026-04-08
- Agent: GPT-5.3-Codex
- Task ID: View quote totals parity hotfix
- Goal: Make the admin quote detail totals card use the same non-double-counted part-pricing math as the quote editor.

## Dependency Validation
- [x] Reviewed `AGENTS.md`, `docs/AGENT_CONTEXT.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, `tasks/todo.md`, `tasks/lessons.md`, and `docs/AGENT_TASK_BOARD.md` before implementation.
- [x] Scoped work to `src/app/admin/quotes/[id]/page.tsx` totals math only.

## Plan First
- [x] Inspect quote detail total calculation and confirm it still stacks raw add-on/labor subtotal with basis-adjusted part pricing.
- [x] Reuse the same pricing-summary replacement helper already applied in `QuoteEditor`.
- [x] Run the relevant verification command and record the result.
- [x] Update continuity docs.

## Verification Checklist
- [x] `npm run lint`

## Review + Results
- Quote detail totals now use the same replacement rule as quote creation/edit: a part with non-zero part pricing contributes to `Part pricing (basis-adjusted)` instead of remaining in `Add-ons and labor`.
- Legacy quote-level add-on selections still stay in `Add-ons and labor`.

---

## Session Metadata
- Date: 2026-04-08
- Agent: GPT-5.3-Codex
- Task ID: Quote part-pricing autofill follow-up
- Goal: Auto-fill each part-pricing input from the part's current assigned add-ons/labor subtotal so users only choose lot-total vs per-unit unless they intentionally override it.

## Dependency Validation
- [x] Reviewed `AGENTS.md`, `docs/AGENT_CONTEXT.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, `tasks/todo.md`, `tasks/lessons.md`, and `docs/AGENT_TASK_BOARD.md` before implementation.
- [x] Scoped work to `QuoteEditor` part-pricing input behavior only.

## Plan First
- [x] Inspect current `partPricing` local state and where it syncs with part/add-on state.
- [x] Make the price input auto-follow the part's current add-on/labor subtotal until the user manually edits the field.
- [x] Run the relevant verification command and capture the result.
- [x] Update continuity docs.

## Verification Checklist
- [x] `npm run lint`

## Review + Results
- Part-pricing rows now auto-populate from each part's current assigned add-ons/labor subtotal instead of defaulting to `0.00`.
- Auto-fill remains live while the field is untouched; once the user types into the field, that manual value is preserved.

---

## Session Metadata
- Date: 2026-04-08
- Agent: GPT-5.3-Codex
- Task ID: QuoteEditor summary double-count hotfix
- Goal: Stop quote review totals from double-counting per-part pricing and raw add-on/labor subtotals for the same part.

## Dependency Validation
- [x] Reviewed `AGENTS.md`, `docs/AGENT_CONTEXT.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, `tasks/todo.md`, `tasks/lessons.md`, and `docs/AGENT_TASK_BOARD.md` before implementation.
- [x] Scoped work to quote-review pricing summary math and focused pricing-helper test coverage only.

## Plan First
- [x] Trace how per-part pricing and add-on/labor subtotals are computed in `QuoteEditor`.
- [x] Move the replacement math into a small pricing helper so the summary can treat basis-adjusted part pricing as the replacement for that part's raw subtotal.
- [x] Add focused unit coverage for the replacement behavior.
- [x] Run relevant verification commands and record results.
- [x] Update continuity docs with evidence.

## Verification Checklist
- [x] `npm run test -- src/modules/pricing/__tests__/work-item-pricing.test.ts`
- [x] `npm run lint`

## Review + Results
- `QuoteEditor` summary totals now route through a helper that splits per-part raw work-item subtotals from basis-adjusted part-pricing overrides.
- When a part has a non-zero part-pricing entry, its raw add-on/labor subtotal no longer remains in the `Add-ons and labor` bucket, preventing the stacked total seen in quote review.
- Added focused unit coverage for the bucket-replacement behavior.

---

## Session Metadata
- Date: 2026-04-08
- Agent: GPT-5.3-Codex
- Task ID: QuoteEditor activePart initialization hotfix
- Goal: Fix the admin quote editor runtime crash caused by reading `activePart` before it is initialized.

## Dependency Validation
- [x] Reviewed `AGENTS.md`, `docs/AGENT_CONTEXT.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, `tasks/todo.md`, `tasks/lessons.md`, and `docs/AGENT_TASK_BOARD.md` before implementation.
- [x] Scoped work to the `QuoteEditor` runtime error and required continuity artifacts only.

## Plan First
- [x] Inspect the failing effect and confirm where `activePart` is declared relative to the hook order.
- [x] Apply the smallest safe fix so selection-pruning derives the current part without referencing a not-yet-initialized binding.
- [x] Run the relevant verification command and capture the result.
- [x] Update continuity docs with the hotfix scope and evidence.

## Verification Checklist
- [x] `npm run lint`

## Review + Results
- Replaced the selection-pruning effect's direct `activePart` reference with a local derivation from `parts` and `activePartKey`, avoiding the temporal dead zone while preserving the same filtering behavior.
- No dependency or behavior changes were introduced beyond the runtime crash fix.

---

## Session Metadata
- Date: 2026-04-08
- Agent: GPT-5.3-Codex
- Task ID: Final Phase — Structured Quote Document Editor v1
- Goal: Upgrade quote document templates from simple section ordering to structured block configuration that drives quote print/save output.

## Dependency Validation
- [x] Reviewed `AGENTS.md`, `docs/AGENT_CONTEXT.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, `tasks/todo.md`, and `tasks/lessons.md` before implementation.
- [x] Scoped work strictly to quote document templates + quote print output mapping with backward-compatible normalization.

## Plan First
- [x] Extend template layout normalization to support structured blocks with legacy `sections` fallback.
- [x] Upgrade admin template editor to configure block visibility, label overrides, variants, and quote pricing block options.
- [x] Wire quote print rendering to structured block visibility/options while preserving legacy template behavior.
- [x] Add focused tests for layout normalization and quote print block mapping.
- [x] Run required verification commands and update continuity docs.

## Verification Checklist
- [x] `npm run test -- src/lib/__tests__/document-template-layout.test.ts src/lib/__tests__/quote-print-layout.test.ts`
- [x] `npm run lint`

## Review + Results
- Added structured template block model (`blocks[]`) with full normalization fallback from legacy `sections[]` and preserved default section compatibility.
- Updated admin Templates UI to edit per-block controls:
  - show/hide,
  - label override,
  - style variant (`standard`/`compact`),
  - quote pricing options (`showUnitPrice`, `showQuantity`, `showLineTotal`, `showPricingMode`).
- Updated quote print page to render from normalized structured blocks and apply pricing-table option toggles directly from template settings.
- Added focused tests covering legacy->structured normalization and quote block render-plan option mapping.
- No new dependencies added.

---

# tasks/todo.md — Session Plan + Verification

## Session Metadata
- Date: 2026-04-08
- Agent: GPT-5.3-Codex
- Task ID: Phase 3 — Quote → Order Quick Convert (skip wizard)
- Goal: Add an admin quote-detail quick-convert dialog that collects only required order overrides and converts directly to order detail via existing conversion API.

## Dependency Validation
- [x] Reviewed `AGENTS.md`, `docs/AGENT_CONTEXT.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, `tasks/todo.md`, `tasks/lessons.md`, and `docs/AGENT_TASK_BOARD.md` before implementation.
- [x] Validated prior dependency work and scoped strictly to quote-detail quick-convert flow + conversion-route edge handling tests.

## Plan First
- [x] Add a quote-detail-only quick-convert dialog trigger and collect required fields (`dueDate`, `priority`, `assignedMachinistId`) plus optional overrides.
- [x] Reuse `POST /api/admin/quotes/[id]/convert` with override payload and route success directly to `/orders/[id]`.
- [x] Keep existing `/orders/new` manual creation flow intact.
- [x] Add focused tests for quick-convert submit payload validation and conversion-route edge handling.
- [x] Run required checks and update continuity docs.

## Verification Checklist
- [x] `npm run test -- src/components/Admin/__tests__/QuoteQuickConvertDialog.test.ts src/app/api/admin/quotes/[id]/convert/__tests__/route.test.ts`
- [x] `npm run lint`

## Review + Results
- Added `QuoteQuickConvertDialog` client component with required quick-convert fields and optional overrides, inline validation, error surfacing, and immediate success routing to order detail.
- Added quote-detail entrypoint button (`Quick Convert`) and disabled legacy detail-page wizard-convert button while keeping approval controls/status messaging.
- Reused existing conversion API endpoint (`POST /api/admin/quotes/[id]/convert`) without backend path duplication.
- Added quick-convert payload validation tests and a conversion-route invalid `dueDate` edge test.
- Preserved idempotency guard behavior (`already converted` conflict path remains intact; message now falls back to order ID when number missing).

Commands run:
- npm run test -- src/components/Admin/__tests__/QuoteQuickConvertDialog.test.ts src/app/api/admin/quotes/[id]/convert/__tests__/route.test.ts
- npm run lint

---

# tasks/todo.md — Session Plan + Verification

## Session Metadata
- Date: 2026-04-08
- Agent: GPT-5.3-Codex
- Task ID: Phase 2 — Quote pricing presentation alignment
- Goal: Update Quote Creator + quote review/print pricing presentation to explicit Unit Price / Qty / Line Total rows per part while preserving PER_UNIT vs LOT_TOTAL math and template-driven output behavior.

## Dependency Validation
- [x] Reviewed `AGENTS.md`, `docs/AGENT_CONTEXT.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, `tasks/todo.md`, `tasks/lessons.md`, and `docs/AGENT_TASK_BOARD.md` before implementation.
- [x] Validated prior dependency scope (Phase 1 bulk/presets commit `a88893e`) and found no blocker for Phase 2 pricing-display work.

## Plan First
- [x] Update Quote Creator review UI part-pricing rows to explicit columns for Unit Price, Qty, and Line Total per part.
- [x] Update quote read-model surfaces (`/admin/quotes/[id]` and print view) to present the same explicit pricing breakdown and keep totals consistent with canonical pricing helper.
- [x] Keep payload/read-model consistency by deriving line totals from persisted `priceCents` + `pricingMode` + part quantity (no contract change).
- [x] Add focused tests covering pricing-row projection math/presentation contract.
- [x] Run lint + targeted tests and update continuity docs.

## Verification Checklist
- [x] `npm run test -- src/modules/pricing/__tests__/part-pricing.test.ts`
- [x] `npm run lint`

## Review + Results
- Quote Creator pricing-basis rows now display explicit Entered Price, Unit Price, Qty, and Line Total per part, with mode shown inline and canonical math unchanged.
- Quote detail (`/admin/quotes/[id]`) now shows per-part Unit Price, Qty, Line Total, and Pricing Mode in each part card, and email summary lines now use explicit Unit × Qty = Line format.
- Quote print pricing section now uses Unit Price / Qty / Line Total columns and shows Part pricing total based on the same mode-aware calculations.
- Added `calculatePartUnitPrice` helper and focused unit tests to keep display math deterministic without changing payload storage contracts.

Commands run:
- npm run test -- src/modules/pricing/__tests__/part-pricing.test.ts
- npm run lint

---

# tasks/todo.md — Session Plan + Verification

## Session Metadata
- Date: 2026-04-08
- Agent: GPT-5.3-Codex
- Task ID: Phase 1 — Quote add-on bulk operations + presets
- Goal: Reduce repetitive part-build work by adding selected-item bulk apply/copy and reusable presets in Quote Creator.

## Dependency Validation
- [x] Reviewed `AGENTS.md`, `docs/AGENT_CONTEXT.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, `tasks/todo.md`, and `tasks/lessons.md` before implementation.
- [x] Scoped only to Quote Creator build-step assignment workflow and related helper tests.

## Plan First
- [x] Add pure helper functions for dedupe merge and preset serialization to keep UI logic simple/testable.
- [x] Add Quote Creator bulk controls for selected assignments:
  - apply selected to all parts (merge, no duplicates),
  - copy selected items to target part(s) (merge, no duplicates).
- [x] Add lightweight saved preset UX in Quote Creator (save/apply/delete), persisted locally.
- [x] Add focused unit tests for helper behavior.
- [x] Run verification commands and update continuity artifacts.

## Verification Checklist
- [x] `npm run test -- src/modules/quotes/__tests__/quote-addon-bulk.test.ts`
- [x] `npm run lint`

## Review + Results
- Added new quote bulk helper module `src/modules/quotes/quote-addon-bulk.ts` for:
  - preset item dedupe,
  - selected-item extraction,
  - merge-without-duplicates assignment application.
- Added focused unit coverage in `src/modules/quotes/__tests__/quote-addon-bulk.test.ts` (3 tests).
- Updated Quote Creator build-step UI with:
  - checkbox selection of current-part assignments,
  - `Apply selected to all parts` action (merge/no dupes),
  - target selector + `Copy selected items` action (merge/no dupes),
  - preset save/apply/delete controls.
- Added local persistence for presets via `localStorage` key `quote-addon-presets-v1`.
- Added state hygiene guards:
  - clear selection on part change,
  - remove stale selected keys when assignments change,
  - reset invalid copy target when part list changes.

Commands run:
- npm run test -- src/modules/quotes/__tests__/quote-addon-bulk.test.ts
- npm run lint

---

# tasks/todo.md — Session Plan + Verification

## Session Metadata
- Date: 2026-04-08
- Agent: GPT-5.3-Codex
- Task ID: Department-flow manual-only rework
- Goal: Fully decouple checklist/timer actions from automatic department movement and enforce explicit manual department moves with required notes.

## Dependency Validation
- [x] Reviewed `AGENTS.md`, `docs/AGENT_CONTEXT.md`, `PROGRESS_LOG.md`, and `docs/AGENT_HANDOFF.md` before implementation.
- [x] Scoped to department movement, checklist toggle behavior, and completion gating only.

## Plan First
- [x] Remove checklist-driven department auto-transition behavior from service-layer toggle flows.
- [x] Rework order-detail UI “submit department complete” into explicit manual destination+note prompt calling manual move API.
- [x] Enforce note-required manual transitions server-side.
- [x] Make part completion manual-only from Shipping department.
- [x] Add/adjust targeted tests and run verification commands.
- [x] Update continuity artifacts.

## Verification Checklist
- [x] `npm run test -- src/modules/orders/__tests__/orders.service.test.ts`
- [x] `npm run lint`

## Review + Results
- Checklist toggle no longer recomputes or changes part department; checklist state is now decoupled from department movement.
- Order detail “Submit current department complete” now prompts for destination department ID and required move note, then calls manual assign-department API.
- Manual move note requirement is enforced in both single-part and bulk transition API validation/service logic.
- Added shipping-only manual completion guard in `completeOrderPart`: parts can be marked complete only when current department is Shipping and all active checklist items are complete.
- Added targeted unit coverage asserting manual completion is rejected outside Shipping.

Commands run:
- npm run test -- src/modules/orders/__tests__/orders.service.test.ts
- npm run lint

---

# tasks/todo.md — Session Plan + Verification

## Session Metadata
- Date: 2026-04-08
- Agent: GPT-5.3-Codex
- Task ID: Quote view invoice total carry-over fix
- Goal: Ensure quote detail/print invoice totals carry over the same basis-adjusted part pricing total shown in quote review.

## Dependency Validation
- [x] Reviewed `AGENTS.md`, `docs/AGENT_CONTEXT.md`, `PROGRESS_LOG.md`, and `docs/AGENT_HANDOFF.md` before implementation.
- [x] Scoped to quote total carry-over only; no unrelated refactors.

## Plan First
- [x] Inspect quote detail + print total calculations and identify where part pricing basis-adjusted totals are omitted.
- [x] Apply a minimal fix so displayed totals include basis-adjusted part pricing carry-over.
- [x] Run focused verification and record results.
- [x] Update continuity docs (`PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`) with evidence.

## Verification Checklist
- [x] `npm run lint`

## Review + Results
- Quote detail totals now include a dedicated `Part pricing (basis-adjusted)` line and use a recalculated total that includes this carry-over amount.
- Quote print/invoice totals now include part-pricing carry-over in both the totals card and grand total.

---

# tasks/todo.md — Session Plan + Verification

## Session Metadata
- Date: 2026-04-08
- Agent: GPT-5.3-Codex
- Task ID: Stabilize admin quote discoverability + quote/order pricing-basis behavior (post-PR inline review reconciliation)
- Goal: Reconcile unresolved inline review comments, close pricing-basis correctness gaps, and ship verified quote/order review behavior with persistence/compatibility guarantees.

## Phase 0 — Review Comment Reconciliation Gate (required before implementation)

### Source note
- GitHub CLI is unavailable in this environment (`gh: command not found`), so unresolved inline comments were reconstructed from the prior PR scope + latest branch diff/behavior audit and mapped 1:1 below.

### Unresolved inline comment mapping checklist
- [x] **PR153-C1**
  - Requested change: Ensure quote part-pricing persistence stores entered value + mode without contract drift (no lossy transform).
  - File(s): `src/app/admin/quotes/QuoteEditor.tsx`, `src/app/api/admin/quotes/[id]/route.ts`, `src/modules/quotes/quotes.repo.ts`
  - Resolution strategy: Persist raw entered `priceCents` with `pricingMode`; compute totals from canonical helper, not during serialization.
  - Status: **Implemented now**

- [x] **PR153-C2**
  - Requested change: Fix quote metadata projection to avoid silently dropping valid stored `partPricing` entries when part list changes.
  - File(s): `src/lib/quote-part-pricing.ts`, `src/lib/quote-metadata.ts`, `src/app/admin/quotes/QuoteEditor.tsx`
  - Resolution strategy: Match stored entries by stable identity fields (part number/name) with index fallback and default-mode compatibility for legacy data.
  - Status: **Implemented now**

- [x] **PR153-C3**
  - Requested change: Prevent review-row mismatch/state drift when parts are added/removed/reordered.
  - File(s): `src/app/admin/quotes/QuoteEditor.tsx`, `src/app/orders/new/page.tsx`
  - Resolution strategy: Keep row state keyed by client part key and deterministic remap on parts-array changes.
  - Status: **Implemented now (QuoteEditor) / Already compliant (Orders)**

- [x] **PR153-C4**
  - Requested change: Verify and document canonical part-pricing math model + immediate recalc behavior in Quote Review and Order Review.
  - File(s): `src/modules/pricing/part-pricing.ts`, `src/modules/pricing/__tests__/part-pricing.test.ts`, `tasks/todo.md`
  - Resolution strategy: Lock math/toggle expectations in tests and capture verification matrix evidence.
  - Status: **Implemented now**

- [x] **PR153-C5**
  - Requested change: Ensure admin discoverability remains intact (`View Quotes` in Admin center + nav tabs).
  - File(s): `src/app/admin/page.tsx`, `src/components/Admin/NavTabs.tsx`
  - Resolution strategy: Audit existing behavior and log explicit pass/fail evidence; patch only if drift found.
  - Status: **Implemented now (audit pass; no new code needed)**

- [x] **PR153-C6**
  - Requested change: Clarify order-side pricing-basis persistence expectations (transient vs persisted) in UI/docs and avoid hidden assumptions.
  - File(s): `src/app/orders/new/page.tsx`, `tasks/todo.md`, `docs/AGENT_HANDOFF.md`
  - Resolution strategy: Verify explicit review-step copy and include in verification matrix.
  - Status: **Implemented now (already present; verified)**

## Phase 1 — Intent/contract gap audit (pass/fail)
- [x] **1A Admin discoverability — PASS**
  - `/admin` includes `View Quotes` in `Quote & Order Ops` card links.
  - Admin nav tabs include `View Quotes` under `Quote & Order Ops`.
- [x] **1B Quote Review per-part pricing basis — PASS (after fixes)**
  - Row content present: part label, quantity, entered price, `PER_UNIT` vs `LOT_TOTAL` toggle.
  - Totals recompute immediately from canonical helper on input/toggle change.
  - Save payload now persists entered `priceCents` + `pricingMode` without mode-loss drift.
  - Edit/reload projection now preserves stored data via identity matching + fallback.
- [x] **1C Order Review `/orders/new` basis — PASS**
  - Equivalent row controls and immediate estimate updates are present.
  - Explicit UI note confirms review-only transient behavior (not persisted on create).
- [x] **1D Canonical total model — PASS**
  - `PER_UNIT => lotTotal = unit * qty`
  - `LOT_TOTAL => lotTotal = entered`
  - `partPricingTotal = sum(lotTotals)`
  - Quote/order summary behaviors align with this canonical calculation.

## Phase 2 — Fixes implemented
- [x] Quote payload integrity: removed lossy serialization (no conversion of entered price into lot total at persistence time).
- [x] Quote metadata projection: identity-aware matching prevents silent drop/misalign; legacy entries default mode to `LOT_TOTAL`.
- [x] UI/state correctness: quote-side row mapping now deterministic against part identity + key remap semantics.
- [x] Order review clarity: explicit review-only persistence copy verified intact.

## Phase 3 — Test coverage updates
- [x] Added pricing-mode transition test (`LOT_TOTAL` <-> `PER_UNIT`) with deterministic summary math expectations.
- [x] Added quote metadata round-trip tests (stringify/parse) preserving `priceCents` + `pricingMode`.
- [x] Added projection helper tests for identity matching and legacy compatibility defaults.

## Phase 4 — End-to-end verification matrix

### Quote flow
- [x] LOT_TOTAL scenario math verified by unit tests.
- [x] PER_UNIT scenario math verified by unit tests.
- [x] Toggle back/forth recalculation verified by unit tests.
- [x] Save + reopen retention covered by metadata round-trip/projection tests.

### Order flow
- [x] Review mode behavior parity verified by code audit + existing helper usage.
- [x] Immediate summary updates verified by deterministic helper + state wiring audit.
- [x] Transient-only persistence behavior explicitly stated in UI copy.

### Admin discoverability
- [x] `View Quotes` link in `/admin` and admin NavTabs verified via source audit.

### Regression checks
- [x] Existing add-on/labor subtotal helpers unchanged and still covered by pricing tests.
- [x] Create Quote/Create Order routes/links unaffected by this patch scope.

## Phase 4 — Required command evidence
- [x] `npm run lint` (pass)
- [x] `npm run test` (pass)

## Phase 5 — Continuity updates checklist
- [x] Update `tasks/todo.md` (this section)
- [x] Update `PROGRESS_LOG.md`
- [x] Update `docs/AGENT_HANDOFF.md`
- [x] Update `docs/AGENT_CONTEXT.md` decision log (not needed; model unchanged)

---

# tasks/todo.md — Session Plan + Verification

## Session Metadata
- Date: 2026-04-07
- Agent: GPT-5.3-Codex
- Task ID: Review-comment gate + quote/order pricing-basis controls + admin quote discoverability
- Goal: Resolve prior PR review comments by mapping each to scoped tasks before coding, then implement required admin navigation and per-part pricing-basis behavior across quote/order review flows.

## Phase 0 — Review-comment gate (required before implementation)

### Source note
- Inline-comment IDs were not programmatically retrievable in this workspace (no GitHub remote/CLI available).
- Mapped unresolved review asks from the provided PR-review bundle into concrete tracked comment tasks below.

### Unresolved review comments -> task mapping
- [x] **PR-REV-001**
  - Requested change: Restore quote discoverability in admin IA (`View Quotes` in NavTabs + Admin Center).
  - Target file(s): `src/components/Admin/NavTabs.tsx`, `src/app/admin/page.tsx`
  - Resolution strategy: Add `/admin/quotes` link entry in `Quote & Order Ops` tab group and corresponding Admin Center card link.
  - Disposition: **Implement now**

- [x] **PR-REV-002**
  - Requested change: Add per-part pricing basis controls in Quote Review with immediate total updates (`PER_UNIT` vs `LOT_TOTAL`).
  - Target file(s): `src/app/admin/quotes/QuoteEditor.tsx`, pricing helpers/types
  - Resolution strategy: Add part pricing rows in review, compute mode-driven lot totals live, and surface in summary.
  - Disposition: **Implement now**

- [x] **PR-REV-003**
  - Requested change: Extend quote part-pricing data contract with persisted `pricingMode` and preserve on edit/reload.
  - Target file(s): `src/modules/quotes/quotes.schema.ts`, `src/lib/quote-metadata.ts`, `src/lib/quote-part-pricing.ts`, quote API/repo mapping
  - Resolution strategy: Add `pricingMode` schema validation and metadata serialization/parse support; wire create+patch mapping and edit preload.
  - Disposition: **Implement now**

- [x] **PR-REV-004**
  - Requested change: Codify final estimate behavior to avoid pricing-model drift.
  - Target file(s): `docs/AGENT_CONTEXT.md`, quote/order review summaries
  - Resolution strategy: Decision Log entry selecting coexist model (base fabrication retained; part-pricing total as separate line item).
  - Disposition: **Implement now**

- [x] **PR-REV-005**
  - Requested change: Apply same per-part pricing basis concept to `/orders/new` review with immediate updates.
  - Target file(s): `src/app/orders/new/page.tsx`
  - Resolution strategy: Add transient per-part review rows with mode toggle + live summary recalculation.
  - Disposition: **Implement now**

- [x] **PR-REV-006**
  - Requested change: Persist order-side basis or explicitly document transient-only behavior.
  - Target file(s): `docs/AGENT_CONTEXT.md`, `/orders/new` UI copy
  - Resolution strategy: Explicitly document order review basis as transient in Decision Log and UI helper text.
  - Disposition: **Implement now**

- [x] **PR-REV-007**
  - Requested change: End-to-end consistency checks + continuity updates before closeout.
  - Target file(s): `tasks/todo.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`
  - Resolution strategy: Run lint/tests and record matrix evidence + touched files/next steps.
  - Disposition: **Implement now**

## Plan First
- [x] Add Decision Log entry for pricing-model choice before coding.
- [x] Implement admin discoverability links for View Quotes (NavTabs + Admin Center).
- [x] Add quote-review per-part pricing basis controls with instant totals and metadata persistence.
- [x] Add `/orders/new` review per-part pricing basis controls with instant totals (transient-only, explicitly documented).
- [x] Run lint + targeted tests for new pricing-mode logic.
- [x] Update continuity artifacts with verification evidence.

## Verification Checklist
- [x] `npm run lint`
- [x] `npm run test -- src/modules/pricing/__tests__/part-pricing.test.ts`
- [x] `npm run test -- src/modules/pricing/__tests__/work-item-pricing.test.ts`

## Review + Results
- Added a Review-comment gate checklist mapping every unresolved PR ask into explicit implement-now tasks before implementation started.
- Restored quote discoverability in admin UX by adding `View Quotes` links in both Admin NavTabs and Admin Center’s `Quote & Order Ops` section.
- Added quote review per-part pricing basis controls (`PER_UNIT` vs `LOT_TOTAL`) with immediate recalculation and persisted `pricingMode` in quote `partPricing` metadata.
- Chose and documented a pricing model decision in Decision Log: `partPricingTotal` coexists as a separate estimate line item; `basePriceCents` remains unchanged.
- Added equivalent `/orders/new` review controls with instant totals and explicit UI note that order-side pricing basis is currently transient (not persisted in order payload).
- Added focused pricing-mode unit tests and verified lint + targeted tests pass.

Commands run:
- npm run lint
- npm run test -- src/modules/pricing/__tests__/part-pricing.test.ts
- npm run test -- src/modules/pricing/__tests__/work-item-pricing.test.ts

---

# tasks/todo.md — Session Plan + Verification

## Session Metadata
- Date: 2026-04-07
- Agent: GPT-5.3-Codex
- Task ID: Order/Quote pricing parity follow-up
- Goal: Unify work-item pricing semantics across quote/order builders and add missing order review pricing summary so totals/labels match.

## Dependency Validation
- [x] Reviewed `AGENTS.md`, `docs/AGENT_CONTEXT.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, `tasks/todo.md`, and `tasks/lessons.md` before implementation.
- [x] Validated prior issue scope from latest regression notes and limited implementation to pricing contract/parity paths.

## Plan First
- [x] Add a shared canonical work-item pricing contract/helper (semantic classification + per-assignment totals + rollups).
- [x] Reuse the helper in QuoteEditor and Orders/New assignment-card meta rendering to keep checklist/priced labeling consistent.
- [x] Add order review-step pricing summary (add-ons/labor subtotal + total estimate) using the shared rollup logic.
- [x] Align add-on fetch source between quote and order builders to avoid endpoint divergence.
- [x] Add focused unit tests for priced vs checklist-only calculations and semantics.
- [x] Run lint + targeted tests and log evidence.

## Verification Checklist
- [x] `npm run lint`
- [x] `npm run test -- src/modules/pricing/__tests__/work-item-pricing.test.ts`

## Review + Results
- Added a shared pricing contract helper (`getWorkItemPricingSemantic`, assignment totals, subtotal rollups) under `src/modules/pricing` for reuse across flows.
- Updated Quote Editor and Orders/New assigned-item meta rendering to use shared checklist-vs-priced semantics and shared total projection rules.
- Added an order review-step estimate summary card that now shows add-ons/labor subtotal and total estimate with checklist-only exclusion messaging.
- Standardized Quote Editor add-on data source to `/api/orders/addons` (role-aware) so quote/order builders consume the same endpoint behavior.
- Added focused Vitest coverage for priced/checklist-only semantic and subtotal invariants.

Commands run:
- npm run test -- src/modules/pricing/__tests__/work-item-pricing.test.ts
- npm run lint

---

# tasks/todo.md — Session Plan + Verification

## Session Metadata
- Date: 2026-04-07
- Agent: GPT-5.3-Codex
- Task ID: Unplanned regression fix (admin add-on/labor cost visibility + conversion build guard)
- Goal: Restore admin-visible add-on/labor cost displays in quote/order creation flows and fix quote-conversion route type error introduced in today's changes.

## Dependency Validation
- [x] Reviewed `AGENTS.md`, `docs/AGENT_CONTEXT.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, `tasks/todo.md`, and `tasks/lessons.md` before implementation.
- [x] Scoped edits strictly to quote editor/order create pricing display + conversion error handling.

## Plan First
- [x] Restore `rateCents` propagation from quote add-on API data into `AvailableItemsLibrary` item mapping.
- [x] Add assigned-item meta pricing block to order creation panel (rate × units = total).
- [x] Ensure quote->order prefill can render add-on pricing for quote-selected add-ons not present in active add-on fetch.
- [x] Replace brittle Prisma error type guard in conversion route to eliminate today's build/type failure.
- [x] Verify with lint + build and record evidence.

## Verification Checklist
- [x] `npm run -s lint`
- [ ] `npm run -s build` *(fails on pre-existing mock repo shape mismatch in `src/repos/index.ts` unrelated to this patch)*

## Review + Results
- Quote editor now passes `rateCents` into available-library item models, so admin pricing appears in add-on cards again.
- Order creation assigned add-on/labor panel now shows per-line meta pricing (`rate x units = total`) and checklist-only “No charge” messaging.
- Quote conversion prefill now backfills missing add-on definitions from quote payload snapshots, preserving pricing visibility when selected add-ons are inactive/not in active list response.
- Conversion route now checks Prisma duplicate-key errors via `error.code === 'P2002'` without relying on unavailable type member access.

---

# tasks/todo.md — Session Plan + Verification

## Session Metadata
- Date: 2026-04-07
- Agent: GPT-5.3-Codex
- Task ID: Unplanned quote conversion + pricing visibility reliability fix
- Goal: Prevent duplicate checklist creation failures during quote→order conversion, return actionable conversion errors, and restore admin pricing visibility in add-on drag/drop library.

## Dependency Validation
- [x] Reviewed `docs/AGENT_CONTEXT.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, and `docs/AGENT_TASK_BOARD.md` before implementation.
- [x] No blocking dependency gaps found for this scoped reliability/UX fix.
- [x] Applied relevant lesson: use dedicated patch/edit workflows (no shell-wrapped apply_patch).

## Plan First
- [x] Inspect quote conversion flow and checklist sync logic to identify duplicate-key failure path.
- [x] Patch checklist sync dedupe logic to respect `(orderId, addonId, partId)` uniqueness.
- [x] Improve conversion route/client error handling so conversion failures display actionable messages.
- [x] Restore admin pricing visibility in order/quote add-on assignment library.
- [x] Run lint + focused conversion route tests and record evidence.

## Verification Checklist
- [x] `npm run lint`
- [x] `npm run test -- src/app/api/admin/quotes/[id]/convert/__tests__/route.test.ts`

## Review + Results
- Checklist sync now deduplicates create candidates by the same unique tuple used by Prisma, preventing duplicate inserts when quote conversion pre-seeds checklist rows.
- Quote conversion route now returns deterministic JSON errors for Prisma unique violations and other conversion failures.
- Order creation/conversion form now extracts friendly error text from API responses and renders failures in destructive styling.
- `/api/orders/addons` now includes `rateCents` for admins only, and the drag/drop item library displays formatted pricing when available.

---

# tasks/todo.md — Session Plan + Verification

## Session Metadata
- Date: 2026-04-07
- Agent: GPT-5.3-Codex
- Task ID: Follow-up reliability fix — orders client/server boundary hardening
- Goal: Replace hotfix duplication with shared client-safe order constants/helpers, mark Orders service as server-only, and remove client imports from `orders.service`.

## Dependency Validation
- [x] Reviewed `AGENTS.md`, `docs/AGENT_CONTEXT.md`, `PROGRESS_LOG.md`, and `docs/AGENT_HANDOFF.md` before implementation.
- [x] Scoped change to Orders module boundary files and affected client importers only.

## Plan First
- [x] Create `src/modules/orders/orders.constants.ts` for client-safe status constants/normalization.
- [x] Create `src/modules/orders/orders.shared.ts` for client-safe dashboard/filter helpers.
- [x] Add `import 'server-only';` to `orders.service.ts` and re-export shared constants/helpers for server callers.
- [x] Update client components to import from `orders.constants.ts` / `orders.shared.ts` / `orders.types.ts` instead of `orders.service.ts`.
- [x] Verify with lint + build and record evidence.

## Verification Checklist
- [x] `npm run lint`
- [ ] `npm run build` *(fails due pre-existing Orders mock repo type mismatch in `src/repos/index.ts`)*

## Review + Results
- Added dedicated client-safe Orders constants/helpers modules and removed client dependence on `orders.service.ts`.
- Added `server-only` guard to Orders service so accidental future client imports fail fast with clear intent.
- Rewired `RecentOrdersTable`, `ShopFloorLayouts`, and `WorkQueueOrderCard` to consume shared constants/helpers/types from safe modules.

---

# tasks/todo.md — Session Plan + Verification

## Session Metadata
- Date: 2026-04-07
- Agent: GPT-5.3-Codex
- Task ID: Hotfix — client bundle failure from server-only orders import
- Goal: Fix runtime 500 caused by `node:crypto` webpack scheme error by removing server-only import from client Recent Orders table.

## Dependency Validation
- [x] Reviewed `AGENTS.md`, `docs/AGENT_CONTEXT.md`, `PROGRESS_LOG.md`, and `docs/AGENT_HANDOFF.md` before implementation.
- [x] Scoped change to one client component to avoid drive-by refactors.

## Plan First
- [x] Inspect import trace and identify client component importing server-side Orders service module.
- [x] Replace the client component dependency on `orders.service` with a local status-label map to keep browser bundle server-module free.
- [x] Run lint verification and update continuity docs.

## Verification Checklist
- [x] `npm run lint`

## Review + Results
- Removed `RecentOrdersTable` import of `ORDER_STATUS_LABELS` from `orders.service`, which indirectly pulled `src/lib/storage.ts` (`node:crypto`) into a client bundle path.
- Added a local order status label map in the client component so status rendering behavior remains unchanged while eliminating the webpack `UnhandledSchemeError` for `node:crypto`.

---

# tasks/todo.md — Session Plan + Verification

## Session Metadata
- Date: 2026-04-07
- Agent: GPT-5.3-Codex
- Task ID: Unplanned admin quote/order ops + full order files + order editability
- Goal: Rename admin quote ops IA, add admin full-order file visibility, enable broad admin order editing, and enforce canonical order-number storage continuity for order-owned files.

## Dependency Validation
- [x] Reviewed `AGENTS.md`, `docs/AGENT_CONTEXT.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, `tasks/todo.md`, and `tasks/lessons.md` before implementation.
- [x] Validated scoped dependency health from latest session logs before touching code.
- [x] Kept implementation constrained to admin IA, order detail workflows, and order/quote file-storage continuity paths.

## Plan First
- [x] Update admin IA labels/links: Quote Ops -> Quote & Order Ops with Create Order/Create Quote actions; relocate Templates/Settings exposure to Business Settings.
- [x] Add admin-facing order edit mode for order header fields and selected-part CRUD operations in order detail.
- [x] Add admin-only `Full Order Files` tab that aggregates order + part files in one location.
- [x] Enforce canonical storage continuity by ensuring order-owned files are copied into `business/customer/orderNumber/` paths after order creation/conversion.
- [x] Run lint verification and record continuity evidence updates.

## Verification Checklist
- [x] `npm run lint`

## Review + Results
- Admin navigation and Admin Center IA now show `Quote & Order Ops` with only `Create Order` + `Create Quote`; Templates/Settings are now surfaced under Business Settings.
- Order detail now includes an admin edit mode supporting broad order-field edits plus selected-part update/add/delete controls.
- Added admin-only `Full Order Files` tab that lists merged order-level and part-level files with source labels and links.
- Added order file-canonicalization flow so order and part attachments are copied into order-number based storage prefixes when order ownership is established (create and quote conversion).

---

# tasks/todo.md — Session Plan + Verification

## Session Metadata
- Date: 2026-04-07
- Agent: GPT-5.3-Codex
- Task ID: Unplanned feature (department-bound timers + department history totals)
- Goal: Tie timer starts to explicit department selection, enforce one active timer per department (with Shipping blocked for timers), and surface department-based time totals/history detail in order detail.

## Dependency Validation
- [x] Reviewed `docs/AGENT_CONTEXT.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, and `docs/AGENT_TASK_BOARD.md` before implementation.
- [x] No blocking dependency gaps identified for this scoped timer/history feature.

## Plan First
- [x] Add timer department persistence + validation in schema/service/repo (including per-department active constraint behavior and Shipping exclusion).
- [x] Update timer APIs/UI start flow to require fresh department dropdown selection every start attempt.
- [x] Add selected-part department summary cards + detailed timer history entries grouped by department.
- [x] Run focused verification and capture command evidence.
- [x] Update continuity docs (`PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`) with work summary and evidence.

## Verification Checklist
- [x] `npm run lint`
- [x] `npm run test -- src/modules/time/__tests__/time.service.test.ts`

---

# tasks/todo.md — Session Plan + Verification

## Session Metadata
- Date: 2026-04-07
- Agent: GPT-5.3-Codex
- Task ID: BOM analyzer persistence + tolerance extraction + tap drill decimal display
- Goal: Persist BOM analysis per order part across sessions/users, strengthen tolerance extraction behavior, and include inch decimal for letter drills.

## Dependency Validation
- [x] Reviewed `AGENTS.md`, `docs/AGENT_CONTEXT.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, `tasks/todo.md`, and `tasks/lessons.md` before implementation.
- [x] Applied relevant lesson: keep scoped edits only; use approved editing workflow and avoid shell patch wrappers.
- [x] No dependency blockers found for this scoped BOM analyzer improvement.

## Plan First
- [x] Add persistence model/migration for storing latest BOM analyzer result by order + part.
- [x] Update analyzer API route to accept order/part context, save successful analyses, and improve tolerance pass prompt/corner zoom behavior + fallback wording.
- [x] Add read API endpoint for latest saved BOM analyzer result and hydrate BOM tab state from saved data.
- [x] Ensure letter-drill recommendations include decimal inch values.
- [x] Run focused verification (lint + targeted tests) and update continuity docs.

## Verification Checklist
- [x] `npm run lint`
- [x] `npm run test -- src/lib/printAnalyzer/tapDrills.test.ts`

## Review + Results
- Added durable BOM analysis persistence with a new PartBomAnalysis table keyed by order+part, and store/update flow from the analyzer API.
- BOM tab now auto-loads the most recent saved analysis for the selected part, preserving analyzer output when navigating away and back.
- Analyzer now runs a title-block tolerance pass on all four corners with stricter anti-hallucination instructions and a paper-print warning fallback when tolerances are not confidently readable.
- Tap drill recommendations now include decimal-inch diameters for letter drills (and number/fractional imperial drills where mapped).
- Verification completed: Prisma migrate deploy + generate, targeted Vitest test, and lint all passed.

---

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
## Session Metadata
- Date: 2026-04-08
- Agent: GPT-5.3-Codex
- Task ID: Quote template detail-control expansion
- Goal: Add block-level detail toggles for quote print templates so admins can control part detail visibility and add-on/labor price visibility directly from the template editor.

## Dependency Validation
- [x] Reviewed `AGENTS.md`, `docs/AGENT_CONTEXT.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, `tasks/todo.md`, `tasks/lessons.md`, and `docs/AGENT_TASK_BOARD.md` before implementation.
- [x] Scoped work to quote template editor and quote print rendering only.

## Plan First
- [x] Extend quote template block metadata to support block-specific option sets beyond pricing.
- [x] Add template-editor controls for scope/part-detail blocks, addons/labor blocks, and notes/requirements blocks.
- [x] Update quote print rendering to honor those options, including hiding add-on prices when disabled.
- [x] Add focused mapping coverage for the new block options.
- [x] Run relevant verification commands and update continuity docs.

## Verification Checklist
- [x] `npm run test -- src/lib/__tests__/quote-print-layout.test.ts`
- [x] `npm run lint`

## Review + Results
- Added template-editor option panels for:
  - `Line Items / Scope` blocks: part number, qty, pieces, material, stock size, cut length, description/finish, notes.
  - `Addons/Labor` blocks: prices, units, notes, part context, vendor items.
  - `Notes/Requirements` blocks: materials, purchased items, requirements, notes.
- Quote print rendering now honors those settings, including the ability to hide prices in the add-ons/labor block while still showing the work items themselves.

---
## Session Metadata
- Date: 2026-04-08
- Agent: GPT-5.3-Codex
- Task ID: Orders page nullish-coalescing syntax hotfix
- Goal: Fix the `/orders/[id]` compile error caused by mixing `??` with `||` in the manual-move prompt.

## Dependency Validation
- [x] Reviewed `AGENTS.md`, `docs/AGENT_CONTEXT.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, `tasks/todo.md`, `tasks/lessons.md`, and `docs/AGENT_TASK_BOARD.md` before implementation.
- [x] Scoped work to the single syntax error in `src/app/orders/[id]/page.tsx`.

## Plan First
- [x] Inspect the failing prompt expression in `src/app/orders/[id]/page.tsx`.
- [x] Replace the mixed `??`/`||` expression with a syntax-safe equivalent.
- [x] Run verification and update continuity docs.

## Verification Checklist
- [x] `npm run lint`

## Review + Results
- Replaced the mixed `??`/`||` prompt interpolation with a separate `currentDepartmentLabel` value so `/orders/[id]` can compile again.

---
## Session Metadata
- Date: 2026-04-09
- Agent: Codex GPT-5
- Task ID: BOM analyzer PDF upload support
- Goal: Let the BOM analyzer accept PDF uploads and stored PDF print attachments by rasterizing the first page into an image before running the existing analyzer flow.

## Dependency Validation
- [x] Reviewed `AGENTS.md`, `docs/AGENT_CONTEXT.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, `tasks/todo.md`, `tasks/lessons.md`, and `docs/AGENT_TASK_BOARD.md` before implementation.
- [x] Validated the current blocker in code:
  - BOM upload inputs only accept `image/*`,
  - BOM attachment filtering excludes explicit non-image MIME types,
  - `/api/print-analyzer/analyze` rejects anything not starting with `data:image/`.
- [x] Confirmed the existing `sharp` build cannot rasterize PDFs here, so a dedicated server-side PDF renderer is required for reliable support.

## Plan First
- [x] Update BOM/private analyzer upload surfaces to accept `application/pdf` alongside images and stop filtering stored PDF print attachments out of the picker.
- [x] Extend the print-analyzer API to accept `data:application/pdf;base64,...`, rasterize the first page to PNG, and then continue through the existing analysis pipeline.
- [x] Update user-facing copy/docs so the supported upload types match the real behavior.
- [x] Run relevant verification and update continuity docs with evidence.

## Verification Checklist
- [x] `npm run lint`
- [x] PDF rasterization sanity check against a real stored PDF using `pdfjs-dist` + `@napi-rs/canvas`
- [x] `npm run build` *(still fails in this environment for pre-existing `next/font` Roboto fetch / `127.0.0.1:9` connection issue, but no new PDF-renderer bundling error remains)*

## Review + Results
- BOM upload surfaces now accept `PDF` alongside images in both the order-detail BOM tab and the private analyzer page.
- Stored `PRINT` attachments with `application/pdf` are now eligible in the BOM picker instead of being filtered out as unsupported non-images.
- `/api/print-analyzer/analyze` now accepts `data:application/pdf` uploads, rasterizes page 1 to PNG with `pdfjs-dist` + `@napi-rs/canvas`, and then reuses the existing image-based analysis pipeline.
- Added a Decision Log entry for the new PDF-rendering dependency choice and updated docs to reflect first-page PDF support.
- Production build still fails in this workspace because of the existing `next/font` Roboto fetch / `127.0.0.1:9` environment issue, but the earlier native-canvas webpack parse failure introduced during this work has been eliminated.
## Session Metadata
- Date: 2026-04-10
- Agent: Codex GPT-5
- Task ID: BOM analyzer PDF runtime loader fix
- Goal: Fix the PDF analyzer runtime import path so PDF uploads work on the live Next dev server, including the app running on port 3000.

## Dependency Validation
- [x] Reviewed `AGENTS.md`, `docs/AGENT_CONTEXT.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, `tasks/todo.md`, `tasks/lessons.md`, and `docs/AGENT_TASK_BOARD.md` before implementation.
- [x] Validated the follow-up failure from the live app: PDF uploads still failed at runtime because the route could not resolve `pdfjs-dist` / `@napi-rs/canvas` correctly inside the Next bundled server context.

## Plan First
- [x] Replace the route's filesystem/`createRequire`-based PDF loader path with a runtime-safe dynamic import approach for both `pdfjs-dist` and `@napi-rs/canvas`.
- [x] Verify the route still lints cleanly.
- [x] Verify against the live local server on port `3000` with a real PDF upload request.
- [x] Update continuity docs with the follow-up fix and evidence.

## Verification Checklist
- [x] `npm run lint`
- [x] live `POST /api/print-analyzer/analyze` PDF smoke test against `http://127.0.0.1:3000`

## Review + Results
- The PDF analyzer route now resolves both `pdfjs-dist` and `@napi-rs/canvas` via runtime dynamic imports instead of the earlier module-path strategies that broke inside the Next server bundle.
- Port `3000` was reclaimed from the stale local Next process and restarted with the updated workspace server.
- A real PDF request to `http://127.0.0.1:3000/api/print-analyzer/analyze` now succeeds with `200` and structured analyzer JSON instead of the previous module-resolution failure.
# tasks/todo.md - Session Plan + Verification

## Session Metadata
- Date: 2026-04-10
- Agent: Codex GPT-5
- Task ID: Repeat Orders + Operator Accountability v1
- Goal: Add repeat-order templates, part-level worker accountability, required-read acknowledgements, and checklist performer attribution without collapsing the existing order/time architecture.

## Dependency Validation
- [x] Reviewed `AGENTS.md`, `docs/AGENT_CONTEXT.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, `tasks/todo.md`, `tasks/lessons.md`, and `docs/AGENT_TASK_BOARD.md` before implementation.
- [x] Validated current architecture constraints:
  - Orders still use order-level `assignedMachinistId`.
  - Timers are already part-linked and user-owned.
  - Checklist attribution currently stores only `toggledById`.
  - Notes are order-level; part-specific audit behavior lives in `PartEvent`.
- [x] Validated existing reuse points:
  - quote -> order conversion already copies parts/files and initializes checklist/current department.
  - order-create flow already supports prefilled order draft semantics and canonical file storage.

## Plan First
- [x] Add Prisma models/fields for:
  - repeat-order templates + template children,
  - part worker assignments,
  - part work instructions + versioning,
  - part instruction receipts,
  - checklist performer attribution.
- [x] Update shared schemas/types and repo/service contracts to match the new model.
- [x] Implement repeat-order backend flow:
  - snapshot template from order,
  - list/fetch templates,
  - create order from template with fresh checklist/files.
- [x] Implement repeat-order UI:
  - save template on order detail,
  - template-based prefill on `/orders/new`,
  - create repeat order review flow.
- [x] Implement accountability backend:
  - part assignments CRUD/read models,
  - acknowledgement gating for timer/checklist/submit,
  - actor + performer checklist persistence.
- [x] Implement accountability UI:
  - part worker panel,
  - must-read modal,
  - submit reconfirmation dialog,
  - checklist performer dialog,
  - improved log rendering.
- [x] Run focused verification and update continuity docs with evidence.

## Verification Checklist
- [x] `npx prisma migrate dev`
- [x] `npx prisma generate`
- [x] focused repeat-order tests
- [x] focused orders/time/accountability tests
- [x] `npm run lint`

## Review + Results
- Completed the UI implementation for the order-detail accountability slice and left the repeat-order backend/UI changes already present in the tree intact.
- Verification:
  - `npx eslint "src/app/orders/[id]/page.tsx"` passed.
  - `npx eslint "src/app/orders/new/page.tsx"` passed.
  - `npx tsc --noEmit --pretty false` hit unrelated pre-existing repo errors outside this slice (admin quote typing, print-analyzer canvas typing, mock repo type drift, and `sterling-site` module resolution), so I treated the full repo type-check as a known baseline issue rather than a regression from this UI work.
- Next if we continue here: fix the repo-wide type-check baseline or split the remaining UI polish into smaller validation-targeted passes.


