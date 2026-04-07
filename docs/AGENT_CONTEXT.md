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

- All charge kinds are per-part: `partId` is required for every charge kind.

## Decision Log (append newest at top)


### 2026-04-07 — Canonical order-number storage normalization for order-owned files
Decision: Add an Orders-domain post-create/post-conversion normalization step (`ensureOrderFilesInCanonicalStorage`) that ensures order-owned file records point to storage paths under `business/customer/orderNumber/` while preserving conversion behavior as copy semantics.
Reason: Operators require file continuity across quote→order lifecycle with a stable backend folder convention keyed by order number.

### 2026-04-07 — Department-bound timer model (Shipping blocked for timers)
Decision: Require department selection when starting timers, persist `departmentId` on `TimeEntry`, allow concurrent active timers across different departments, enforce one active timer per `(user, department)`, and block Shipping from timer start flows.
Reason: Shop-floor time tracking must reflect real department usage (Machining/Fab/Paint) with department-level totals/history while keeping Shipping configured for checklist/workflow but out of timer operations.

### 2026-04-07 — Explicit department submit workflow + part time adjustments
Decision: Shift order-detail checklist behavior from checkbox-driven auto-advance to explicit per-part department submission, and record optional user-added part time via a dedicated `PartTimeAdjustment` model with required note when extra time is entered.
Reason: Operators reported unreliable/incorrect “last checklist item” auto-advance behavior; explicit submit gating plus auditable manual time notes improves trust, control, and traceability of part progression and total-time reporting.

### 2026-03-23 — Isolated marketing site lives as its own Vite subproject
Decision: Build the new manufacturing marketing website in a dedicated `sterling-site/` folder with its own Vite/React/TypeScript toolchain, package manifest, styling, and content files rather than coupling it to the existing Next.js app.
Reason: The requested site must stay deployable by direct URL and remain isolated from the main shop app's navigation, components, styles, logic, config, and dependency graph while the marketing experience evolves independently.

### 2026-03-23 — Simplify order status to workflow rollup with admin override
Decision: Standardize manager-facing order statuses to `RECEIVED`, `IN_PROGRESS`, `COMPLETE`, and `CLOSED`; auto-sync them from part activity/checklist completion while keeping admin-only manual status edits with required reasons.
Reason: The shop-floor workflow is already part/department-driven, so the order status should act as a simple searchable dashboard rollup instead of a second operational workflow that drifts from parts.

### 2026-03-19 — LAN-aware auth base URL fallback
Decision: Add shared `src/lib/base-url.ts` and use it for auth redirect/sign-out base URL resolution; when configured env URLs still point at loopback (`localhost`/`127.0.0.1`) but the request/base URL is a LAN origin, prefer the request origin.
Reason: Local-network dev access was bouncing auth flows back to loopback URLs, so auth needed one shared rule that still preserves explicit non-loopback env config.

### 2026-02-26 — Dual seed profiles + one-script installer workflow
Decision: Introduce `seed:basic` (functionality baseline) and `seed:demo` (pre-populated showcase dataset) plus `scripts/install.sh` to orchestrate local/Docker installation with explicit `--seed` selection.
Reason: Operators need a predictable quick-start path for either lightweight functional validation or full demo walkthroughs without manual command choreography.

### 2026-02-25 — Add OpenAI SDK dependency for isolated Print Analyzer vision route
Decision: Add `openai` npm dependency and implement OpenAI Responses API usage only inside `src/app/api/print-analyzer/analyze/route.ts` for server-side vision extraction.
Reason: The new sealed Print Analyzer feature requires a server-side vision-capable LLM call without exposing API keys to the client.

### 2026-02-23 — Closed-interval admin edit path must be API-gated and audited
Decision: Add an admin-only `PATCH /api/time/entries/[entryId]` path that permits closed-interval edits only when a reason is supplied; emit a part event audit record (`TIME_ENTRY_EDITED`) for part-linked edits.
Reason: P3-T1/P3-T2 require explicit admin-audited edit policy enforcement on the server side and deterministic rule handling independent of UI behavior.

### 2026-02-23 — Customers module boundary pattern aligned with Orders/Quotes
Decision: Add `src/modules/customers/{customers.repo.ts, customers.service.ts, customers.schema.ts, customers.types.ts}` and route active Customers call paths through service/repo layering; keep `src/lib/zod-customers.ts` as a compatibility shim.
Reason: P2-T3 requires Customers to stop being a boundary exception while avoiding broad drive-by refactors.

### 2026-02-23 — Orchestration standards + business-logic canon alignment
Decision: Formalize plan-first orchestration artifacts (`tasks/todo.md`, `tasks/lessons.md`), require prior-task validation before new task execution, require build/test verification per session, and align canon with part-level charges + Orders-as-container enforcement + switch-context dialog + admin-audited closed-interval edit policy.
Reason: Owner clarified governance and business-logic standards that must be uniform across all future task execution and architecture work.

### 2026-02-18 — Centralize sign-in callback URL normalization
Decision: Add `src/lib/auth-redirect.ts` and route all sign-in redirects + callback parsing through shared helpers (`buildSignInRedirectPath`, `normalizeCallbackUrl`).
Reason: P1-T1 requires one auth/session truth path; shared redirect normalization removes split callback handling and prevents unsafe external callback targets.

### 2026-02-18 — Treat continuity freshness as explicit recurring task work
Decision: When executing `P0-C1`, record explicit DoD evidence in `PROGRESS_LOG.md` and refresh `docs/AGENT_HANDOFF.md` even when no product code changes occur.
Reason: Continuity drift is a tracked risk; explicit audit artifacts make freshness verifiable across agent sessions.

### 2026-02-18 — Add ticket-sized agent task board + prompt pack
Decision: Add `docs/AGENT_TASK_BOARD.md` and `AGENT_PROMPTS.md` as execution companions to ROADMAP for one-task-per-session delegation.
Reason: Reduce agent drift by making phase order, dependencies, scope, and DoD explicit and copy/paste assignable.

### 2026-02-03 — Add dotenv load for postinstall DB setup
Decision: Add dotenv as a dev dependency and load it in scripts/setup-db.cjs so postinstall can see DATABASE_URL from .env.
Reason: Local dev should honor .env during setup-db without requiring manual exports.

### 2026-02-09 — Add CustomField.uiSection for quote step staging
Decision: Introduce CustomField.uiSection (INTAKE/PART_BUILD/REVIEW) to control when custom fields appear in the quote editor.
Reason: Move Finish Required out of intake without breaking existing custom field behavior.

### 2026-02-08 — Add TEST_MODE harness + repo factory
Decision: Introduce TEST_MODE switch with centralized auth bypass and repo factory that can swap Prisma repos for in-memory mocks (orders/users/time).
Reason: Allow safe testing in restricted environments without DB/auth, while keeping production behavior unchanged.

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
