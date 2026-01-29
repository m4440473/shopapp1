**Non-authoritative operational history. CANON.md and ROADMAP.md are authoritative.**

# AGENTS.md — ShopApp1 Agent Charter (Read First)

This file is the authoritative operating guide for any Codex/agent working on this repo.
If you are an agent: follow it. If you can’t, stop.

## North Star

Build a shop operations app that is:
- Cleanly coded: obvious where things go, minimal surprises.
- Scalable: modular boundaries, no “god files,” no tangled dependencies.
- Maintainable: small changes are easy, predictable patterns.
- Boring (in the best way): reliable and consistent.

## Absolute Rules (Non‑negotiables)

1) No drive‑by refactors. Only touch what your task requires.
2) No new dependencies without a clear reason and a Decision Log entry.
3) No mixing responsibilities:
   - UI components do NOT talk to Prisma directly.
   - Routes/API handlers do NOT contain business logic.
   - Services do NOT import React.
4) Prefer composition over cleverness. Readability beats “smart.”
5) Update continuity docs every session so context persists.

## Before You Start (Required Reading)

Read these files before writing code:
- docs/AGENT_CONTEXT.md (priorities + invariants + decision log)
- PROGRESS_LOG.md (what was last done and what’s next)
- docs/AGENT_HANDOFF.md (what you must update before you stop)

If any of these are missing or stale, fix them first.

## Working Style

- Define exactly what you are changing.
- Keep changes small: one feature/bugfix at a time.
- If you discover extra issues, log them in PROGRESS_LOG.md rather than “fixing everything.”

## Architecture Target

We are moving toward a modular architecture with explicit ownership.

Desired module pattern:
src/modules/
  orders/
    orders.repo.ts      // DB access only
    orders.service.ts   // business logic
    orders.schema.ts    // validation (zod)
    orders.types.ts     // shared types
    orders.ui.tsx       // domain UI components

### lib rules
src/lib/ is for infrastructure, not domain ownership.

Allowed in lib:
- prisma client
- auth/session utilities
- rbac
- storage utilities
- generic helpers that are truly cross‑cutting

Not allowed in lib:
- domain ownership (orders/quotes/customers business logic)
- business rules tied to one domain

## Decision Log Rules

Use docs/AGENT_CONTEXT.md (Decision Log section) to record:
- new patterns
- new packages
- major refactors
- anything future agents must know

## End‑of‑Session Requirements (Do Not Skip)

Before ending:
1) Update PROGRESS_LOG.md (what you did + what’s next)
2) Update docs/AGENT_HANDOFF.md (handoff template: goal, scope, touched files, commands run)
3) Ensure the repo builds/tests if you changed relevant build/test paths

If you did not do these, you did not finish.

## “Don’t get off track” checklist

If you feel tempted to do extra work:
- Is it required for the ticket?
- Does it break a rule above?
- Would it be better as a note in PROGRESS_LOG.md?

When in doubt: write it down, don’t implement it.
