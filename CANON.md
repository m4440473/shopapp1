# CANON — ShopApp1

Single source of truth for what this product is, how it should behave, and why. If code or conversation conflicts with this canon, the canon wins and the work should be corrected.

## 1) Purpose

Build a shop operations system for real machine shop workflows—not generic SaaS CRUD. The goal is to make daily work boring, reliable, and fast for tired humans on a shop floor.

## 2) Audience & Use Context

Primary users:
- Shop owners/managers who need clear, accurate reporting and billing.
- Machinists/operators who need fast, interruption‑tolerant tracking.

Real‑world constraints:
- Users are busy, interrupted, and not sitting at a desk.
- The UI must be readable at a glance and tolerant of mistakes.

## 3) Canonical Mental Model (Non‑negotiable)

1) **Orders are containers** (customer, billing, status).
2) **Parts are the real units of work** (quantity, material, specs).
3) **Operations are where time and money live** (machine, setup, run) and always attach to a Part context.
4) **Time is tracked as intervals** (start/stop/pause/resume), not guessed totals.

If any implementation treats Orders as the primary work unit, it is wrong.

## 4) Product Principles (Veto Rules)

- **Auth is boring.** No feature work if auth or layout stability is broken.
- **Intervals are protected.** Non-admin users cannot edit closed intervals; admin edits require explicit auditability. Totals are computed, not stored.
- **UI favors clarity over cleverness.** One obvious action beats three clever ones.
- **Boundaries matter.** Domain logic is owned by modules, not lib or UI.
- **All charge kinds are part-level.** `partId` is required for every charge kind.
- **Orders are containers only.** Parts are the mandatory work units for execution and accounting.

## 5) UX Goals (Fulcrum‑level parity in behavior)

The target UX is calm, scannable, and optimized for real shop flow:
- Start/Pause/Resume is always obvious.
- Switching jobs does not inflate time.
- Operators can see what they last did without digging.
- Managers can trust totals without audits.

## 6) Current State (Truth, not optimism)

- Next.js App Router + Prisma, with a growing module structure in `src/modules/*`.
- Auth/session handling is present but still needs stabilization.
- Orders/Quotes/Customers logic is mid‑migration from `src/lib/*` into modules.
- UI uses shadcn + Tailwind; layout and mobile nav stability are still priority items.

## 7) Target Architecture

Module pattern (explicit ownership):
```
src/modules/<domain>/
  <domain>.repo.ts     // Prisma access only
  <domain>.service.ts  // business rules
  <domain>.schema.ts   // zod validation
  <domain>.types.ts    // shared types
  <domain>.ui.tsx      // domain UI components
```

Layering rules:
- Routes/API handlers call services only.
- Services call repos only.
- UI never imports Prisma or repo/service.

## 8) Time Tracking Model

- A user has **one active operation** at a time.
- Starting a new operation must present a dialog identifying the currently active part/operation and the switch consequence.
- Starting a new operation auto‑pauses the current one after explicit user confirmation in switch flow.
- TimeEntries are immutable after close for non-admin users.
- Admin edits to closed intervals are allowed only with explicit auditability.
- Totals are computed from intervals, not stored.

## 9) Roadmap (Short Horizon Only)

Phase 1 — **Stabilize the skeleton**
- Single source of truth for auth/session.
- Stable app shell and mobile navigation.

Phase 2 — **Refactor to the correct mental model**
- Part‑centric operations with interval time tracking.
- Services/repos established for Orders/Quotes/Customers/Time.

Phase 3 — **Fulcrum‑level time tracking UX**
- Fast, obvious controls with zero time inflation.

Phase 4 — **UI polish once logic is right**
- Calm, high‑signal screens that read clearly under fatigue.

## 10) Constraints & Commitments

- No new dependencies without a Decision Log entry.
- No drive‑by refactors. Fix only what the task requires.
- Update continuity docs every session (PROGRESS_LOG.md + docs/AGENT_HANDOFF.md).
- TEST_MODE is a local/dev-only harness that swaps in mock auth + in-memory repos (enable with TEST_MODE=\"true\" in local/Codex/Replit). It must remain OFF in production.

## 11) How to Use This Canon

- Any new work must align with the mental model and principles above.
- If a requirement is unclear, update this file first.
- When in doubt, treat this file as the project’s constitution.


## 12) TEST_MODE and Verification Discipline

- `TEST_MODE` must remain functional for local/Codex/Replit validation workflows.
- Agents must run build/test commands sufficient to validate their own edits before completion.
- If environment limitations block full verification, agents must log partial validation + blocker details in continuity docs.
