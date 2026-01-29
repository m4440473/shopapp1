# ShopApp1 Roadmap (Strict, Gate-Based)

This roadmap is the authoritative sequence of work. Each phase must be completed and verified before the next phase starts. If a phase is not complete, agents must not start work in later phases.

## Phase 0 — Continuity & Guardrails (Always-On)
**Goal:** Keep the project consistent and prevent context drift.

**Exit criteria:**
- CANON.md is current and matches the intended product direction.
- PROGRESS_LOG.md and docs/AGENT_HANDOFF.md are updated every session.

## Phase 1 — Platform Stability (P0)
**Goal:** Make auth/session handling and the app shell boring and reliable.

**Scope:**
- Auth/session flow is single-source and consistent.
- Layout/providers are stable across refreshes and route changes.
- Mobile navigation is present and usable.

**Exit criteria:**
- Refreshing any page (logged in/out) does not break styling or layout.
- Mobile nav allows access to core pages without dead ends.
- No auth-related runtime errors in normal navigation.

## Phase 2 — Modularization (P2)
**Goal:** Enforce module boundaries and isolate Prisma access.

**Scope:**
- Continue domain extraction into src/modules/*.
- Routes/API handlers call services only; services call repos only.
- No UI imports Prisma or repos/services.

**Exit criteria:**
- Orders and Quotes domains fully follow repo/service/schema/types patterns.
- No Prisma access outside *.repo.ts in those domains.

## Phase 3 — Time Tracking Core (P1)
**Goal:** Implement interval-based time tracking consistent with canon.

**Scope:**
- One active operation per user.
- Start/stop/pause/resume are interval-based and immutable on close.
- Totals are computed, not stored.

**Exit criteria:**
- Data model supports interval entries with proper constraints.
- API routes enforce single-active rule and immutable closed entries.

## Phase 4 — UX Flow Alignment (P1)
**Goal:** Make core UX behavior match Fulcrum-style expectations.

**Scope:**
- Obvious start/pause/resume controls.
- Clear visibility into the last operation and active timer.
- Orders/parts/operations hierarchy is scannable.

**Exit criteria:**
- Operators can start/stop/switch without time inflation.
- Managers can read totals without manual reconciliation.

## Phase 5 — UI Polish (P1/P3)
**Goal:** Improve legibility and reduce cognitive load.

**Scope:**
- Visual hierarchy and layout cleanup.
- Reduce clutter and unnecessary controls.

**Exit criteria:**
- Core screens read clearly under fatigue.
- No UX regressions in daily workflows.
