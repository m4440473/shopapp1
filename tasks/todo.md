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
