**Non-authoritative operational history. CANON.md and ROADMAP.md are authoritative.**

# Agent Context — ShopApp1 (Single Source of Truth)

Shared brain for multiple agents.
If you are working on this repo, follow it and update the Decision Log when needed.

## Product Intent

ShopApp1 is a shop operations app focused on:
- Orders / jobs
- Customers
- Labor / addons / charges
- Time tracking that supports real shop interruptions and job switching
- Admin settings that allow customization without code edits

Goal: a scalable foundation that can grow.

## Architecture Invariants (Do Not Break)

1) Module ownership is explicit
   - Each domain lives in src/modules/<domain>/
   - Domain logic does not live in src/lib/

2) Layer separation
   - *.repo.ts talks to Prisma. Nothing else does.
   - *.service.ts contains business rules.
   - UI components do not import Prisma.
   - Services do not import React.

3) Validation lives with the domain
   - Zod schemas in src/modules/<domain>/*.schema.ts
   - Cross-domain schemas should be rare and justified

4) No new dependencies without Decision Log entry

5) Changes must be discoverable
   - Update PROGRESS_LOG.md and docs/AGENT_HANDOFF.md each session

## Current Priorities

### P0 — Platform Stability
- Ensure auth/session handling is consistent (single approach)
- Ensure app shell is stable and mobile navigation is usable

### P1 — UX improvements
- Orders page: cleaner hierarchy, less clutter
- Time tracking: accurate totals with stop/switch/resume

### P2 — Modularization
- Move orders/quotes/customers logic into modules
- Establish stable patterns and repeat them

### P3 — Feature expansion
- Reporting/export, attachments, and other add-ons as needed

## Domain Truths (so agents don’t hallucinate requirements)

- LABOR and ADDON charges are per-part: partId is required for those kinds.
- Other charge kinds may be order-level (partId optional) unless explicitly changed.

## Decision Log (append newest at top)

### 2026-02-05 — Add PartEvent logging + part status for order detail workflow
Decision: Introduce PartEvent records (with OrderPart.status) to capture part-level activity (timers, notes, files, checklist).
Reason: The two-card order workspace needs a dedicated part log and a completion marker for finish events.

### 2026-01-30 — Add roadmap and mechanical agent prompts
Decision: Add ROADMAP.md and AGENT_PROMPTS.md to enforce gate-based planning and strict, rule-based agent execution.
Reason: Keep work sequenced and prevent agents from taking initiative or expanding scope.

### 2026-01-30 — Add CANON.md as project constitution
Decision: Introduce CANON.md as the single source of truth for product intent, mental model, and UX principles.
Reason: Prevent context drift across chats/agents and make project direction explicit.

### 2026-01-28 — Clarify charge model
Decision: Document that LABOR/ADDON are already per-part; other charge kinds can be order-level.
Reason: Prevent agents from redoing already-solved work.

### 2026-01-28 — Adopt explicit module pattern
Decision: Move toward src/modules/<domain>/{repo,service,schema,types,ui} structure.
Reason: Avoid scattered domain logic and enable multi-agent work without drift.

### 2026-01-28 — Establish continuity docs
Decision: Add AGENTS.md, PROGRESS_LOG.md, and docs/AGENT_HANDOFF.md.
Reason: Multi-agent continuity must be enforced by repo artifacts, not memory.
