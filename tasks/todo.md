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
