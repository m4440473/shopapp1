# Agent Task Board (Ticket-Sized Execution)

This board turns ROADMAP phases into strict, ticket-sized tasks so work can be delegated safely.

Use with:
- `CANON.md` (product constitution)
- `ROADMAP.md` (phase gates)
- `AGENT_PROMPTS.md` (copy/paste task prompts)

---

## Operating rules

1. **One task ID per agent session.**
2. **Do tasks in dependency order.**
3. **No phase skipping** unless an explicit owner note marks a task as intentionally deferred.
4. **Every task must end with DoD evidence** in `PROGRESS_LOG.md` + `docs/AGENT_HANDOFF.md`.

---

## Phase 0 — Continuity & Guardrails (always on)

### P0-C1 — Continuity docs freshness check
- **Why:** Prevent context drift.
- **Scope:** `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, `docs/AGENT_CONTEXT.md` consistency.
- **DoD:**
  - Latest session appears at top of `PROGRESS_LOG.md`.
  - `docs/AGENT_HANDOFF.md` date/goal/commands reflect latest completed work.
  - Any new pattern/decision captured in `docs/AGENT_CONTEXT.md` Decision Log.
- **Dependencies:** none.

---

## Phase 1 — Platform Stability (P0)

### P1-T1 — Auth/session single-source convergence
- **Why:** Remove split auth behavior and runtime uncertainty.
- **Scope:** auth/session entry points, route guards, middleware/session utilities.
- **DoD:**
  - One clear session truth path is used.
  - No conflicting guard logic paths remain.
  - Refresh flow validated for logged-in and logged-out cases.
- **Dependencies:** P0-C1.

### P1-T2 — Shell/provider stability + mobile nav reachability
- **Why:** Keep UI reliable and navigable on shop floor devices.
- **Scope:** layout/providers and mobile nav only.
- **DoD:**
  - Refresh does not lose layout/styling on core routes.
  - Mobile nav reaches core pages without dead ends.
  - Any instability findings are fixed or explicitly logged as blockers.
- **Dependencies:** P1-T1.

### P1-T3 — Phase 1 gate closeout report
- **Why:** Make exit criteria auditable.
- **Scope:** evidence-only pass/fail report mapped to ROADMAP Phase 1.
- **DoD:**
  - Explicit pass/fail for each Phase 1 exit criterion with command/runtime evidence.
  - If fail, remaining gap is logged as next task with owner note.
- **Dependencies:** P1-T2.

---

## Phase 2 — Modularization (P2)

### P2-T1 — Orders layering enforcement
- **Why:** Establish canonical module ownership.
- **Scope:** Orders domain only.
- **DoD:**
  - No Orders Prisma access outside `src/modules/orders/*.repo.ts`.
  - Orders routes are thin and call services.
  - Orders services contain business logic and call repos.
- **Dependencies:** P1-T3.

### P2-T2 — Quotes layering enforcement
- **Why:** Mirror Orders boundaries for consistency.
- **Scope:** Quotes domain only.
- **DoD:**
  - No Quotes Prisma access outside `src/modules/quotes/*.repo.ts`.
  - Quotes routes are thin and call services.
  - Quotes services contain business logic and call repos.
- **Dependencies:** P2-T1.

### P2-T3 — Customers boundary alignment
- **Why:** Avoid Customers becoming a boundary exception.
- **Scope:** Customers paths touched by active flows.
- **DoD:**
  - Customers call paths align with repo/service ownership.
  - Any deferred customer refactor is logged with explicit rationale.
- **Dependencies:** P2-T2.

### P2-T4 — Phase 2 boundary audit + closeout
- **Why:** Prove phase completion with objective checks.
- **Scope:** boundary audit + evidence summary.
- **DoD:**
  - Prisma usage audit confirms no out-of-repo access for Orders/Quotes.
  - Exit criteria in ROADMAP Phase 2 explicitly marked pass/fail.
- **Dependencies:** P2-T3.

---

## Phase 3 — Time Tracking Core (P1)

### P3-T1 — Invariant enforcement (single-active, immutable intervals, computed totals)
- **Why:** Time trust is a core product promise.
- **Scope:** time model/service/repo + validation paths.
- **DoD:**
  - One active operation per user enforced.
  - Closed intervals are immutable.
  - Totals computed from intervals, not stored snapshots.
- **Dependencies:** P2-T4.

### P3-T2 — Time API enforcement audit
- **Why:** Rules must be server-side, not UI-dependent.
- **Scope:** timer/time API handlers and service integration.
- **DoD:**
  - API routes enforce invariants server-side.
  - Conflicts and invalid transitions return deterministic errors.
- **Dependencies:** P3-T1.

### P3-T3 — Phase 3 gate closeout report
- **Why:** Confirm canon-aligned core behavior before UX polish.
- **Scope:** evidence-only pass/fail report for ROADMAP Phase 3.
- **DoD:**
  - Phase 3 exit criteria explicitly pass/fail with evidence.
  - Any remaining gap logged as next ticket with scoped blast radius.
- **Dependencies:** P3-T2.

---

## Phase 4 — UX Flow Alignment (P1)

### P4-T1 — Control clarity pass (start/pause/resume)
- **Why:** Reduce operator hesitation and errors.
- **Scope:** time-tracking controls and adjacent state display.
- **DoD:**
  - Start/pause/resume controls are obvious and unambiguous.
  - Active state is clearly visible without extra navigation.
- **Dependencies:** P3-T3.

### P4-T2 — Switching flow safety + last-action visibility
- **Why:** Prevent inflation and preserve operator context.
- **Scope:** switch flow UX + supporting state display.
- **DoD:**
  - Switching operations does not inflate time.
  - Last operation/action context is visible and understandable.
- **Dependencies:** P4-T1.

### P4-T3 — Phase 4 gate closeout report
- **Why:** Validate operator and manager outcomes.
- **Scope:** evidence-only pass/fail report for ROADMAP Phase 4.
- **DoD:**
  - Operators can start/stop/switch without inflation.
  - Managers can trust totals without manual reconciliation.
- **Dependencies:** P4-T2.

---

## Phase 5 — UI Polish (P1/P3)

### P5-T1 — Visual hierarchy and declutter pass
- **Why:** Improve readability under fatigue.
- **Scope:** visual organization only; no business rule changes.
- **DoD:**
  - Core screens show clearer hierarchy.
  - Unnecessary controls/noise reduced.
- **Dependencies:** P4-T3.

### P5-T2 — Regression check + phase closeout
- **Why:** Ensure polish did not break workflows.
- **Scope:** regression evidence and final pass/fail report.
- **DoD:**
  - No UX regressions in core daily workflows.
  - ROADMAP Phase 5 exit criteria marked pass/fail with evidence.
- **Dependencies:** P5-T1.

---

## Assignment quick guide

When assigning work to an agent, send:
1. Task ID (for example `P2-T2`)
2. Prompt wrapper from `AGENT_PROMPTS.md`
3. Any repo-specific constraints unique to that run

Example assignment:
- "Execute `P2-T2` using `AGENT_PROMPTS.md` wrapper. Do not touch Orders domain."
