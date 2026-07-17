# Agent Task Board (Ticket-Sized Execution)

This board turns ROADMAP phases into strict, ticket-sized tasks so work can be delegated safely.

Use with:
- `CANON.md` (product constitution)
- `ROADMAP.md` (phase gates)
- `AGENT_PROMPTS.md` (copy/paste task prompts)

---


## Session Status Notes

- 2026-07-17: Retired the separate PIN-kiosk user flow: the existing TV dashboard is now labeled Shop Floor, `/kiosk` redirects there, Kiosk navigation and employee PIN setup are removed, and trusted-console audit/Read Me First behavior is preserved.
- 2026-07-17: Completed authoritative Read Me First enforcement: dispatch starts require a persisted versioned receipt, the trusted console shows the full brief and records worker/operator separately without repeated worker PIN entry, and the kiosk resolves the same gate for its PIN-unlocked worker. Evidence is recorded in `tasks/todo.md`, `PROGRESS_LOG.md`, and `docs/AGENT_HANDOFF.md`.
- 2026-07-17: Completed unplanned production feeds-and-speeds correction for the owner's Haas VF-2SS: explicit 12,000 RPM / 833 IPM caps, operation-specific FSWizard geometry, honest validation/unavailable states, and branch-complete regression coverage. Evidence is recorded in `tasks/todo.md`, `PROGRESS_LOG.md`, and `docs/AGENT_HANDOFF.md`.
- 2026-07-16: Completed unplanned Quote workflow simplification + pricing-integrity slice (task-first admin home, shared admin guard, unified Work Steps UI, frozen quote work snapshots, explicit calculated/manual final prices, duplicate prevention, one approval-gated conversion path). Focused admin/quote suite passes 22/22; repo-wide build remains blocked only by logged pre-existing vendor/kiosk/type baselines.
- 2026-07-16: Completed unplanned Drawing-to-order import v1 (dedicated part name, reviewed PDF/ZIP extraction, per-part drawing attachment, and automatic BOM analysis). Evidence is recorded in `tasks/todo.md`, `PROGRESS_LOG.md`, and `docs/AGENT_HANDOFF.md`.
- 2026-04-07: Completed unplanned department-bound timer enhancement (required department selection on timer start, one-active-per-department enforcement, Shipping timer exclusion, and selected-part department history totals/detail in order detail). Evidence recorded in `PROGRESS_LOG.md` and `docs/AGENT_HANDOFF.md`.
- 2026-03-23: Completed unplanned isolated `sterling-site/` marketing-site scaffold (premium one-page manufacturing landing page with standalone tooling/docs). Evidence recorded in `PROGRESS_LOG.md` and `docs/AGENT_HANDOFF.md`.
- 2026-02-26: Completed unplanned Part BOM analyzer attachment-ingestion bugfix (non-image MIME guard + image MIME resolution hardening) and documented quote→order conversion audit evidence.
- 2026-02-25: Completed unplanned Order→Part BOM tab integration using existing print-analyzer API, including deterministic unit/thread/tight-tolerance helpers and continuity evidence updates.
- 2026-02-25: Completed dashboard follow-up fix for department-touch visibility (added checklist/part department IDs to dashboard payload + UI union count) after Fab/Shipping feedback. Evidence recorded in `PROGRESS_LOG.md` and `docs/AGENT_HANDOFF.md`.
- 2026-02-25: Completed unplanned dashboard cleanup (removed Ready for fab layout option, added per-order department-touch count on grid digest). Evidence recorded in `PROGRESS_LOG.md` and `docs/AGENT_HANDOFF.md`.
- 2026-02-24: Completed unplanned timer reliability patch for start/resume paths (default `operation` compatibility + resume FK handling). Evidence recorded in `PROGRESS_LOG.md` and `docs/AGENT_HANDOFF.md`.
- 2026-02-24: Completed unplanned timer resume workflow update (order-detail start vs resume behavior + `/api/timer/resume` endpoint + coverage). Evidence recorded in `PROGRESS_LOG.md` and `docs/AGENT_HANDOFF.md`.
- 2026-02-23: Completed unplanned maintenance scope (outside numbered roadmap ticket) for local install/readme, timer start FK failure handling, and order-detail timer control layout overlap. Verification evidence recorded in `PROGRESS_LOG.md` and `docs/AGENT_HANDOFF.md`.

---

## Operating rules

1. **One task ID per agent session.**
2. **Do tasks in dependency order.**
3. **No phase skipping** unless an explicit owner note marks a task as intentionally deferred.
4. **Every task must end with DoD evidence** in `PROGRESS_LOG.md` + `docs/AGENT_HANDOFF.md`.
5. **Plan first for non-trivial tasks** in `tasks/todo.md` (3+ steps, cross-file impact, architectural decisions).
6. **Validate prior dependency task quality before starting**; report unresolved gaps first.
7. **Run build/test checks relevant to changed paths** before completion.
8. **After correction/failure, append prevention rule** in `tasks/lessons.md`.

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

### P2-T1 — Orders layering + mental model enforcement
- **Why:** Establish canonical module ownership and canonical work model.
- **Scope:** Orders domain only.
- **DoD:**
  - No Orders Prisma access outside `src/modules/orders/*.repo.ts`.
  - Orders routes are thin and call services.
  - Orders services contain business logic and call repos.
  - Server-side contracts enforce: Orders are containers; Parts are work units.
  - Any order-centric work-unit logic is removed or explicitly deprecated.
- **Dependencies:** P1-T3.

### P2-T2 — Quotes layering enforcement
- **Why:** Mirror Orders boundaries for consistency.
- **Scope:** Quotes domain only.
- **DoD:**
  - No Quotes Prisma access outside `src/modules/quotes/*.repo.ts`.
  - Quotes routes are thin and call services.
  - Quotes services contain business logic and call repos.
  - Domain quote logic in `src/lib/*` is migrated/deprecated in favor of module-owned services.
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

### P3-T1 — Invariant enforcement (single-active, admin-audited edits, computed totals)
- **Why:** Time trust is a core product promise.
- **Scope:** time model/service/repo + validation paths.
- **DoD:**
  - One active operation per user enforced.
  - Non-admin users cannot edit closed intervals.
  - Admin closed-interval edits are explicit, audited, and policy-gated.
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

### P3-T4 — Switch-dialog + user context safety
- **Why:** Preserve trust when switching operations/parts.
- **Scope:** time start/switch UX + API response payloads.
- **DoD:**
  - Starting a new part/operation shows context dialog about the previous active timer.
  - Dialog clearly identifies which part/operation was active and what action will occur.
  - No time inflation occurs during switch confirmation path.
- **Dependencies:** P3-T3.

---

## Phase 4 — UX Flow Alignment (P1)

### P4-T1 — Control clarity pass (start/pause/resume)
- **Why:** Reduce operator hesitation and errors.
- **Scope:** time-tracking controls and adjacent state display.
- **DoD:**
  - Start/pause/resume controls are obvious and unambiguous.
  - Active state is clearly visible without extra navigation.
- **Dependencies:** P3-T4.

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

---

## Audit follow-up queue — 2026-07-17

### FLOOR-I1 — Identity and active-timer integrity (P0)
- **Why:** Disabled kiosk users remain PIN-authenticatable, normal sessions retain stale access, and one active timer is not database-enforced.
- **Scope:** auth/session refresh, kiosk eligibility/revocation, time schema/service transaction boundary, admin stale-timer recovery.
- **DoD:**
  - `active`, current role, and `kioskEnabled` are enforced at the correct session boundary.
  - Disabling kiosk access revokes existing kiosk authority.
  - A database constraint prevents two open intervals for one worker.
  - Switch is atomic and deterministic under conflict.
  - Admin can close a stale employee timer with a required reason and before/after audit.
  - Concurrency, disabled-user, stale-session, switch-failure, and recovery tests pass.

### FLOOR-I2 — Canonical department transition (P0)
- **Why:** The visible move flow bypasses canonical completion, final submission persists the wrong status, and active timers can survive moves.
- **Dependencies:** FLOOR-I1.
- **Scope:** department submit/reassignment contracts, status derivation, active-timer guard, legacy completion endpoint retirement.
- **DoD:**
  - Normal floor completion checks required work and follows the configured route.
  - Administrative reassignment is visually separate, permissioned, and reasoned.
  - Move/complete cannot strand an active timer.
  - Final completion is persisted and returned consistently.
  - Order completion is derived only from persisted part completion.
  - Legacy auto-advance routes cannot bypass the contract.

### FLOOR-I3 — Shared-station and timer surface consolidation (P1)
- **Why:** Timer, acknowledgement, checklist, and submit can currently record different people for one physical work sequence.
- **Dependencies:** FLOOR-I2.
- **Scope:** acting-worker context, order-detail timer extraction, worker directory, duplicate route/UI retirement.
- **DoD:**
  - One short-lived, expected-worker identity is bound to every floor mutation.
  - Cross-tab worker replacement cannot silently affect another worker.
  - Order detail is the primary floor work surface; any standalone kiosk has a narrow documented role.
  - Duplicate/dead timer handlers and API families are removed or redirected.

### BUILD-B1 — Existing TypeScript baseline cleanup (P1)
- **Why:** Small unrelated contract errors prevent a clean production build and hide future regressions.
- **Scope:** vendor tuple inference, kiosk result typing/obsolete route, Orders test signatures, mock Orders parity, root `sterling-site` exclusion/project boundary.
- **DoD:**
  - Root type-check and production build pass without changing workflow behavior.
  - Focused vendor/kiosk/orders/mock tests remain green.

### FLOOR-I1/FLOOR-I3 owner clarification — dispatch-console target
- The TV computer is a trusted interactive dispatch console. Do not model its signed-in account as the employee performing the labor.
- Every timer command must store both the authorized console actor and explicit labor owner.
- The console may control an active employee without login switching or target-worker PIN entry on each action.
- Enforce one active timer total per employee across departments; atomic switch pauses the previous interval and starts the requested part.
- Multiple employees may run on the same part, while assignment remains independent of pause/resume state.
- Order detail is the primary interactive floor surface. The dashboard receives a TV-optimized, pricing-free status mode.
- Part History/Log groups intervals by employee, shows employee subtotals and an all-worker total, and exposes the console actor in interval detail.

### Trusted dispatch completion evidence — 2026-07-17
- `FLOOR-I1`: complete for the approved trusted-console scope. Current session role/active state is refreshed, kiosk eligibility is enforced, one-open-timer-per-worker is database-enforced, switch is atomic, and stale/admin closes are audited.
- `FLOOR-I2`: complete for the normal order-detail flow. Active timers block department completion/reassignment, final completion persists correctly, and the bypassing auto-advance route is retired.
- `FLOOR-I3`: complete for timer identity/surface consolidation. Order detail uses explicit labor owner plus authenticated console actor; the TV dashboard is the primary status surface and the optional PIN kiosk delegates to the same timer invariants.
- `BUILD-B1`: complete. Root type-check, full lint, 127 tests, and production build pass.
- Browser evidence: 1920x1080 TV dashboard, live running-worker card, direct part navigation, employee timer dialog, Pause/Finish dialog, employee-grouped labor history, assignment labels, part-switch URL state, and Shipping/complete timer guard all verified.
