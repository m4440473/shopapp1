# ShopApp1 Agent Prompts (Execution Pack)

Purpose: give you copy/paste prompts and ticket-sized tasks so you can run an "agent season" with minimal drift.

Authoritative order of truth:
1) CANON.md
2) ROADMAP.md
3) docs/AGENT_TASK_BOARD.md
4) This file (prompt wrappers)

If a prompt conflicts with CANON/ROADMAP, CANON/ROADMAP wins.

---

## How to run an agent season

1) Pick the next open task in `docs/AGENT_TASK_BOARD.md`.
2) Give the agent exactly one task ID (example: `P1-T2`).
3) Paste the matching prompt from this file.
4) Require the agent to report pass/fail against that task's DoD checklist.
5) Merge only if DoD is fully satisfied or explicitly documented as blocked.

---

## Global constraints (prepend mentally to every task)

- Do only the assigned task ID. No drive-by refactors.
- Respect module boundaries: Prisma only in `*.repo.ts`; routes thin; services contain business logic.
- No new dependencies unless Decision Log is updated in `docs/AGENT_CONTEXT.md`.
- Update continuity docs every session: `PROGRESS_LOG.md` and `docs/AGENT_HANDOFF.md`.
- If task work changes canonical behavior, update CANON first, then code.

---

## Prompt Template (copy/paste shell)

Use this wrapper for every task:

> You are executing ShopApp1 task **<TASK_ID>** from `docs/AGENT_TASK_BOARD.md`.
>
> Required pre-reads (in order):
> 1. `CANON.md`
> 2. `ROADMAP.md`
> 3. `docs/AGENT_CONTEXT.md`
> 4. `PROGRESS_LOG.md`
> 5. `docs/AGENT_HANDOFF.md`
> 6. `docs/AGENT_TASK_BOARD.md`
> 7. `AGENT_PROMPTS.md`
>
> Hard constraints:
> - Stay strictly in scope for **<TASK_ID>**.
> - Do not add dependencies unless explicitly required and logged in Decision Log.
> - Preserve layering: routes->services->repos, no Prisma in UI.
> - Update continuity docs at end (`PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`).
>
> Deliverables:
> - Implement **<TASK_ID>** only.
> - Return a checklist of that task's Definition of Done with pass/fail evidence.
> - List follow-ups as backlog notes; do not implement them.

---

## Task prompts (one per ticket)

### P0-T1 — Auth/session source-of-truth audit + convergence

Goal: close ROADMAP Phase 1 auth/session consistency criteria.

Prompt add-on:
> Execute **P0-T1** only. Audit all auth/session entry points, remove split patterns, and converge on one session truth path. Validate refresh behavior for logged-in and logged-out paths.

### P0-T2 — App shell + mobile nav reliability verification

Goal: close ROADMAP Phase 1 shell/nav criteria.

Prompt add-on:
> Execute **P0-T2** only. Verify shell/provider stability across refresh and route transitions, and confirm mobile nav reaches core pages without dead ends.

### P0-T3 — Phase 1 gate closeout evidence

Goal: produce explicit proof that Phase 1 exit criteria are met.

Prompt add-on:
> Execute **P0-T3** only. Produce an evidence checklist mapped 1:1 to ROADMAP Phase 1 exit criteria and record pass/fail in continuity docs.

### P2-T1 — Orders boundary enforcement

Goal: ensure Orders domain is repo/service/schema/types compliant.

Prompt add-on:
> Execute **P2-T1** only. Remove/relocate any Orders Prisma access outside Orders repo files and ensure routes are thin service callers.

### P2-T2 — Quotes boundary enforcement

Goal: ensure Quotes domain is repo/service/schema/types compliant.

Prompt add-on:
> Execute **P2-T2** only. Remove/relocate any Quotes Prisma access outside Quotes repo files and ensure routes are thin service callers.

### P2-T3 — Customers boundary alignment

Goal: bring Customers paths into same module boundary pattern when touched.

Prompt add-on:
> Execute **P2-T3** only. Align Customers domain call paths with module ownership and layering; avoid unrelated domain edits.

### P2-T4 — Phase 2 boundary audit + gate closeout

Goal: prove Phase 2 criteria with artifacted audit.

Prompt add-on:
> Execute **P2-T4** only. Run a Prisma-usage and layering audit for Orders/Quotes (and Customers if touched), then document explicit pass/fail against ROADMAP Phase 2 exit criteria.

### P3-T1 — Time model invariants verification

Goal: enforce/verify single-active + immutable intervals + computed totals.

Prompt add-on:
> Execute **P3-T1** only. Verify and fix (if needed) interval invariants: one active entry per user, immutable closed entries, totals computed not stored.

### P3-T2 — Time API rule enforcement audit

Goal: ensure API routes enforce the time model server-side.

Prompt add-on:
> Execute **P3-T2** only. Audit and correct time APIs so rule enforcement is server-side and deterministic.

### P4-T1 — Operator control clarity (start/pause/resume)

Goal: make controls obvious with low cognitive overhead.

Prompt add-on:
> Execute **P4-T1** only. Improve clarity and placement of start/pause/resume controls with no broader redesign.

### P4-T2 — Switch-flow correctness + visibility

Goal: make operation switching safe/obvious and visible.

Prompt add-on:
> Execute **P4-T2** only. Ensure switch flows do not inflate time and active/last operation context is clearly visible.

### P4-T3 — Phase 4 UX evidence closeout

Goal: prove operator and manager outcomes from ROADMAP Phase 4.

Prompt add-on:
> Execute **P4-T3** only. Produce evidence that operators can switch without time inflation and managers can trust totals without reconciliation.

### P5-T1 — Visual hierarchy polish pass

Goal: improve readability and declutter after logic gates are closed.

Prompt add-on:
> Execute **P5-T1** only. Apply narrow visual hierarchy improvements and remove clutter without changing business behavior.

### P5-T2 — Regression check + polish gate closeout

Goal: prove no workflow regressions after polish.

Prompt add-on:
> Execute **P5-T2** only. Validate core workflows and document no-regression evidence against Phase 5 exit criteria.
