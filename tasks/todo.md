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
