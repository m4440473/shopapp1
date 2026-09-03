# Order and Quote Workflow Decomposition Plan

## Goal

Reduce the largest order and quote workflow files without changing user-visible behavior or introducing a second set of business rules. Each phase must be independently testable, deployable, and reversible.

## Current pressure points

- `src/app/orders/new/page.tsx` combines three creation modes, data loading, autosave, drawing import, pricing, validation, and submission in roughly 2,600 lines.
- `src/app/orders/[id]/page.tsx` combines order-header editing, part editing, files, timers, routing, checklist, assignments, and dialogs in one page component.
- `src/modules/orders/orders.service.ts` combines creation, updates, workflow transitions, storage finalization, timers, checklist behavior, and read-model decoration in roughly 2,500 lines.
- `src/modules/orders/orders.repo.ts` exposes unrelated query and command families from one roughly 1,500-line repository.
- The quote editor repeats customer/contact, part, attachment, drawing-import, autosave, and submission concerns that also exist in direct-order creation.

## Guardrails

- No big-bang rewrite and no new dependency.
- Preserve route payloads and service result shapes until contract tests prove a deliberate migration.
- Keep domain rules in modules, database access in repositories, and UI state in hooks/components.
- Extract one seam at a time. A phase is complete only after focused tests, TypeScript, lint, build, and browser smoke coverage for both quote and direct-order paths.
- Prefer shared pure functions and small controllers; do not create a new generic “workflow framework.”

## Phase 0 — Lock contracts

Add characterization tests for quote create/edit, quote conversion, direct-order create, repeat-order create, and order-header/part updates. Cover customer/contact ownership, part identity, attachments, add-ons/checklists, custom fields, autosave restore, and error responses.

Exit gate: the current route-to-service contracts can be refactored without relying on manual comparison alone.

## Phase 1 — Extract shared intake primitives

Create focused, pure modules for:

- customer/contact selection and validation state;
- part draft normalization and payload mapping;
- date defaults and parsing;
- attachment draft mapping;
- server error extraction and submission-result handling.

Suggested homes are `src/modules/order-intake/` for cross-workflow intake behavior and existing domain modules for rules owned solely by orders or quotes. Quote and order screens should consume these primitives without sharing giant React state objects.

Exit gate: duplicated payload construction is removed, while route contracts remain unchanged.

## Phase 2 — Split the quote editor by workflow step

Keep one route-level coordinator, then extract customer/header, parts/pricing, drawing import/review, attachments, and final review sections. Move data-fetching and autosave orchestration into dedicated hooks. Components receive typed state and callbacks and never call Prisma or domain repositories.

Exit gate: each section has focused render/interaction tests and the coordinator owns navigation only.

## Phase 3 — Split new-order creation by mode

Introduce separate controllers for direct creation, quote conversion, and repeat-order creation behind the existing `/orders/new` route. Share presentation components only where the fields and persistence semantics are genuinely identical. Keep mode-specific prefill and submission mapping separate and explicit.

Exit gate: changing one creation mode cannot silently alter another; each mode has a dedicated submission test.

## Phase 4 — Split order detail into bounded panels

Leave data loading and selected-part routing in the page coordinator. Extract order header, part overview, procurement/material, assignments, files, checklist, timers, activity log, and workflow dialogs. Each mutation should use a small action hook with an explicit refresh boundary.

Exit gate: the page component is primarily composition and selected-part navigation, and each mutation panel can be tested independently.

## Phase 5 — Divide the orders domain by command family

Move service and repository functions together in small, owned slices:

- `orders.query` for list/detail/read models;
- `orders.create` for atomic order graph creation;
- `orders.header` for customer/contact/header updates;
- `orders.parts` for part CRUD, files, assignments, and procurement;
- `orders.workflow` for department routing, checklist, and status transitions;
- `orders.time` for timer and adjustment coordination;
- `orders.files` for canonical storage reconciliation.

Keep compatibility exports during each move so callers migrate incrementally. Remove compatibility exports only after repository-wide search proves no callers remain.

Exit gate: no service or repository becomes a replacement god module, dependency direction remains route/UI → service → repository, and transaction boundaries are explicit.

## Delivery sequence

Ship Phases 0 and 1 first, then Phase 3 before Phase 2 because direct-order creation currently carries the highest integrity risk. Phase 4 can follow independently. Start Phase 5 only after the UI contracts are characterized, migrating one command family per release.

Every release should record file-size movement, removed duplication, test evidence, browser paths exercised, production hashes, and rollback location. Line count is a diagnostic, not the objective; ownership and safe change boundaries are the acceptance criteria.

## Execution status — 2026-09-03

All currently safe presentation and domain seams have been extracted locally and in the production-derived staging tree. Shared intake mapping/submission clients, quote leaf sections, direct/repeat/conversion order-intake sections, order-detail panels, and header/files/events/charges/parts/create/query/status-workflow service and repository families now have explicit ownership and compatibility surfaces.

The remaining work is no longer safe source movement:

- Quote work-plan actions immediately persist add-on selections and execute pricing/rate-snapshot rules; final pricing derives and writes part pricing. Define a typed pricing controller before moving either block.
- Order checklist completion, department movement, part completion, timer conflicts, and time adjustments share permissions and transaction ordering. Define a typed lifecycle action contract with transaction-order tests, extract checklist commands and department transitions, then reassess whether time is an independent family.
- Remaining route coordinators keep fetch, autosave, upload/import, navigation, permission, confirmation, and refresh orchestration until focused hooks can replace those responsibilities without creating prop-heavy replacement components.

Verification for the completion push passed TypeScript, focused local/staged ESLint, 43 files / 205 tests, local 65-page and staged 66-page builds, boundary hash review, cross-tree import review, and `git diff --check`. Production was not changed; browser smoke and production hashes belong to the separately authorized deployment gate.
