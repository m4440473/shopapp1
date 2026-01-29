# ShopApp1 Agent Prompts (Mechanical Execution Only)

These prompts are strict, rule-based instructions for agents. Agents must not expand scope, invent requirements, or “helpfully” fix unrelated issues. If a task is unclear, update CANON.md or ask for clarification rather than proceeding.

## Global Rules (Apply to Every Task)
- Do only the task described. No drive‑by refactors.
- Do not add dependencies without a Decision Log entry.
- Do not mix responsibilities (UI ↔ Prisma, Routes ↔ Business Logic, Services ↔ React).
- Update PROGRESS_LOG.md and docs/AGENT_HANDOFF.md every session.
- If any of the required pre‑reads are missing or stale, fix them first.

---

## Prompt A — P0 Auth/Session Stabilization
**Goal:** Make auth/session handling single-source and reliable.

**Scope:**
- Only auth/session flow and related routing guards.
- No UI polish unless required to fix auth/layout stability.

**Pre-reads:**
- CANON.md
- docs/AGENT_CONTEXT.md
- PROGRESS_LOG.md
- docs/AGENT_HANDOFF.md

**Steps (execute in order):**
1) Identify every auth/session entry point (middleware, providers, server utilities).
2) Document where session truth is read and written.
3) Choose the single-source approach already in use and remove or isolate the rest.
4) Update route guards to use the single source only.
5) Verify no layout/provider duplication causes hydration or styling loss.

**Out of scope:**
- Any changes to orders/quotes/time tracking logic.
- UI polish unrelated to auth stability.

**Exit criteria:**
- Auth is consistent across routes.
- Layout renders without hydration/style loss.

---

## Prompt B — P0 App Shell & Mobile Nav Stability
**Goal:** Ensure the app shell is stable and usable on mobile.

**Scope:**
- Providers/layout boundaries and mobile navigation only.

**Pre-reads:**
- CANON.md
- docs/AGENT_CONTEXT.md
- PROGRESS_LOG.md
- docs/AGENT_HANDOFF.md

**Steps (execute in order):**
1) Verify the layout/provider tree and note any conditional rendering that could break styles.
2) Ensure a mobile nav entry exists for core pages.
3) Remove or replace any unstable layout conditionals that cause style loss.
4) Keep changes minimal and scoped to layout/nav stability.

**Out of scope:**
- Feature work.
- Styling beyond what is required for usability.

**Exit criteria:**
- Mobile nav is functional.
- Layout stability on refresh is confirmed.

---

## Prompt C — P2 Orders/Quotes Module Boundary Enforcement
**Goal:** Ensure Orders/Quotes follow repo/service/schema/types boundaries.

**Scope:**
- Orders and Quotes domains only.

**Pre-reads:**
- CANON.md
- docs/AGENT_CONTEXT.md
- PROGRESS_LOG.md
- docs/AGENT_HANDOFF.md

**Steps (execute in order):**
1) Identify any Prisma usage outside *.repo.ts for Orders/Quotes.
2) Move Prisma calls into repo files only.
3) Ensure routes call services, and services call repos.
4) Confirm UI does not import Prisma or services/repos.

**Out of scope:**
- Changing business rules.
- Editing unrelated domains.

**Exit criteria:**
- No Prisma access outside Orders/Quotes repos.
- Routes are thin and service-backed.

---

## Prompt D — P1 Time Tracking Core (Interval Model)
**Goal:** Implement interval-based time tracking rules.

**Scope:**
- TimeEntry model, time tracking services, and API routes only.

**Pre-reads:**
- CANON.md
- docs/AGENT_CONTEXT.md
- PROGRESS_LOG.md
- docs/AGENT_HANDOFF.md

**Steps (execute in order):**
1) Define TimeEntry schema and constraints for interval tracking.
2) Enforce single active operation per user.
3) Implement start/stop/pause/resume as interval entries.
4) Ensure totals are computed from intervals (not stored).

**Out of scope:**
- UI polish beyond required controls.
- Orders/Quotes refactors.

**Exit criteria:**
- Intervals are immutable once closed.
- Single active operation enforced server-side.

---

## Prompt E — P1 UX Alignment (Fulcrum-Style Behavior)
**Goal:** Align UX behavior with the canon’s time tracking expectations.

**Scope:**
- UX behavior for start/pause/resume flows only.

**Pre-reads:**
- CANON.md
- docs/AGENT_CONTEXT.md
- PROGRESS_LOG.md
- docs/AGENT_HANDOFF.md

**Steps (execute in order):**
1) Identify current time tracking controls and state display.
2) Make start/pause/resume obvious and unambiguous.
3) Ensure switching operations auto-pauses the previous one.
4) Display the active operation and last action clearly.

**Out of scope:**
- Visual redesign beyond clarity.
- Changes to non-time-tracking screens.

**Exit criteria:**
- Operators can switch without inflating time.
- Active operation is always visible.
