# ShopApp Current Architecture

Last verified against the running Windows server source: 2026-09-01.

This is the compressed map of how ShopApp is structured now. It is not a decision log, roadmap, runbook, or product specification.

## Authority

1. `CANON.md` — product and business truth.
2. `ROADMAP.md` — approved planned direction.
3. Current source and database schema — implementation reality.
4. This file — current architecture map.
5. `docs/AGENT_CONTEXT.md`, `PROGRESS_LOG.md`, and `docs/AGENT_HANDOFF.md` — decisions and operational history.

If this map disagrees with source, follow source and update this file in the same change. Update it whenever domain ownership, execution paths, route families, persistence, auth, storage, AI integration, or production topology changes. Do not add chronology here.

## System shape

- Next.js 15 App Router, React 18, and TypeScript.
- Tailwind CSS, Radix UI, and shared React components.
- NextAuth with server-side RBAC.
- Prisma 5 with SQLite.
- Zod validation and Vitest tests.
- OpenAI Responses API for drawing interpretation and print/BOM analysis.
- Locally hosted on a Windows 11 Pro LAN server.

Canonical work hierarchy:

```text
Order (customer/commercial container)
  -> OrderPart (unit of production and accounting)
     -> department/checklist state
     -> assignments and instructions
     -> attachments and BOM analysis
     -> timers and time intervals
     -> charges and pricing inputs
```

## Repository layout

```text
src/app/                 pages, layouts, and HTTP route handlers
src/modules/             domain repos, services, schemas, types, and tests
src/components/          shared and feature-facing React components
src/lib/                 infrastructure plus transitional helpers
prisma/schema.prisma     current persisted model
prisma/migrations/       additive database migrations
scripts/                 build, install, storage, seed, and maintenance helpers
docs/                    current maps, subsystem docs, decisions, and history
tasks/                   session plans and anti-repeat lessons
public/                  static assets
storage/                 default development attachment root
```

## Layering

```text
Page/component -> API route -> domain service -> domain repository -> Prisma
```

- `*.repo.ts` owns domain-specific Prisma access.
- `*.service.ts` owns business rules and orchestration.
- `*.schema.ts` owns domain validation.
- Routes authenticate, authorize, validate, call services, and shape HTTP responses.
- UI does not import Prisma or domain repositories/services directly.
- Services do not import React.
- Cross-cutting Prisma, auth, RBAC, storage, URL, and generic helpers live in `src/lib/`.

Strict module migration is incomplete. `src/lib/` still contains transitional domain helpers for application settings, custom fields, document templates, quote metadata/pricing/printing, and attachment visibility. This is current reality, not a pattern for new domain code.

## Application surfaces

### Operational UI

- `/` — Shop Floor / live production.
- `/orders`, `/orders/new`, `/orders/[id]` — order intake, detail, part workflow, editing, and print.
- `/customers`, `/customers/[id]` — customer dashboard, history, and print.
- `/repeat-orders` — repeat templates and new-order creation.
- `/search` and `/machinists/[id]` — lookup and activity detail.
- `/tools/feeds-speeds` — Haas VF-2SS-oriented calculator.
- `/phone-upload/[id]` — short-lived mobile upload session.
- `/account` and `/account/password` — account maintenance.

`/kiosk` is a compatibility route; the separate PIN-kiosk product flow is retired. Kiosk-named APIs/module code remain for trusted-console identity, instruction acknowledgement, and timer compatibility. Shop Floor is the supported production surface.

### Administrative UI

`/admin` owns protected management for orders, quotes, users, vendors, materials, add-ons, custom fields, document templates, application/AI settings, and system health. Admin pages use a shared protected layout; mutating APIs repeat authorization server-side.

### API families

- `/api/orders/*` — orders, parts, workflow, assignments, instructions, attachments, charges, BOM, print, and status.
- `/api/admin/quotes/*` — quotes, drawing intake, approval, conversion, PO detection, and print.
- `/api/admin/drawing-import/*` — import review and reprocessing.
- `/api/timer/*`, `/api/time/*`, `/api/dispatch/*` — interval tracking and dispatch.
- `/api/shop-floor/*` — live summaries and display options.
- `/api/phone-upload/*` — mobile transfer sessions.
- `/api/repeat-order-templates/*` — repeat templates and order creation.
- `/api/admin/*` — protected configuration and master data.
- `/api/health` and `/api/admin/system-health` — health boundaries.
- `/api/print-analyzer/analyze` — part drawing/BOM analysis.
- `/api/auth/[...nextauth]` and `/api/whoami` — auth/session boundaries.

## Major domains

### Orders — `src/modules/orders/`

Owns order/part lifecycle, intake normalization, status, material readiness, department routing, assignments, and traveler/print projections.

Primary files: `orders.repo.ts`, `orders.service.ts`, `orders.schema.ts`, `orders.types.ts`, `order-input.ts`, `department-routing.ts`, `order-traveler.ts`, `orders.constants.ts`, and `orders.shared.ts`.

### Quotes and pricing — `src/modules/quotes/`, `src/modules/pricing/`

Owns quote lifecycle/numbering, parts, departments, work items, add-ons, calculated/manual pricing, totals, approval, and conversion behavior.

Primary files: `quotes.repo.ts`, `quotes.service.ts`, `quotes.schema.ts`, `quote-work-items.ts`, `quote-departments.ts`, `quote-addon-bulk.ts`, `pricing/part-pricing.ts`, and `pricing/work-item-pricing.ts`. Some quote print/layout and metadata helpers remain in `src/lib/`.

### Drawing import — `src/modules/drawing-import/`

Owns PDF/image/ZIP intake, hashing, archive/PDF preparation, OCR, per-page evidence/classification, BOM relationships, AI extraction/routing/cost, validation, review, reprocessing, and persistence.

```text
Upload
 -> durable job and source normalization
 -> archive/PDF/image page preparation
 -> local OCR/title-block/BOM evidence
 -> OpenAI structured extraction
 -> deterministic mapping and validation
 -> optional configured escalation
 -> human review/edit
 -> quote or order-part persistence
```

Phone images use direct image input and a compact photo contract. Canonical PDFs retain the PDF/evidence path. Current deployment routing is `gpt-5.4-mini`, medium reasoning, low verbosity, with high-Luna fallback disabled. These mutable values must be rechecked when configuration changes.

Primary files:

- `drawing-import.service.ts` — public orchestration boundary.
- `drawing-import.schema.ts`, `.draft.ts`, `.review.ts`, and `.activity.ts` — validation/review behavior.
- `v2/drawing-import-v2.service.ts` and `.repo.ts` — job/page pipeline and persistence.
- `v2/drawing-import-v2.config.ts` and `.mapping.ts` — pipeline configuration/mapping.
- `v2/ai/drawing-import-ai.adapter.ts` — OpenAI boundary.
- `v2/ai/drawing-import-ai.prompt.ts` — model instructions.
- `v2/ai/drawing-import-ai.schema.ts` — structured output contracts.
- `v2/ai/drawing-import-ai.config.ts` — model/reasoning/token configuration.
- `v2/ai/drawing-import-ai.router.ts` and `.pricing.ts` — routing and cost.
- `v2/document/*`, `v2/local/*`, and `v2/bom/*` — document, evidence, and BOM processing.

See `docs/DRAWING_ORDER_IMPORT_WORKFLOW.md`. Model output is editable evidence, never authoritative manufacturing data.

### Customers and reusable parts

`src/modules/customers/` owns customers, businesses, contacts, and dashboards. `src/modules/customer-parts/` owns prior-part history and reusable drafts, including shop-wide selection with source customer/business context.

### Repeat orders — `src/modules/repeat-orders/`

Owns templates derived from historical work, template parts/charges/attachments, customer validation, and creation of new editable orders. Primary files: `repeat-orders.repo.ts`, `.service.ts`, `.schema.ts`, and `.types.ts`.

### Shop Floor and time

`src/modules/shop-floor/` owns work queues, department-visible summaries, and display behavior. `src/modules/time/` owns dispatch, start/pause/resume/finish/switch, interval audit history, summaries, and part labor history.

Primary files: `shop-floor.repo.ts`, `.service.ts`, `.shared.ts`, `time.repo.ts`, `.service.ts`, `.schema.ts`, `.types.ts`, `dispatch.service.ts`, and `part-labor-history.ts`.

### Phone upload — `src/modules/phone-upload/`

Owns short-lived session creation/claiming and phone-to-desktop file transfer. Primary files: `phone-upload.service.ts`, `.repo.ts`, `.http.ts`, and `.client.ts`.

### Supporting domains

- `attachments/` — attachment authorization/visibility.
- `intake-drafts/` — quote/order intake draft representation.
- `feeds-speeds/` — machine profile, FSWizard data, geometry, and calculations.
- `kiosk/` — remaining trusted-console compatibility services.
- `system-health/` — database/storage/runtime health aggregation.
- `users/` — user persistence for admin/auth flows.
- `vendors/` — vendor import; general vendor CRUD remains partly transitional.

## Persistence

`prisma/schema.prisma` is the persisted implementation source of truth.

- Identity/customer: `User`, `Customer`, `CustomerBusiness`, `CustomerContact`.
- Master data: `Material`, `Vendor`, `Addon`, `Department`.
- Production: `Order`, `OrderPart`, `OrderChecklist`, `OrderCharge`, `OrderPartAssignment`, `PartInstructionReceipt`, `PartEvent`, `StatusHistory`, `Note`.
- Time: `TimeLog`, `TimeEntry`, `TimeEntryAction`, `PartTimeAdjustment`.
- Files/analysis: `Attachment`, `PartAttachment`, `PartBomAnalysis`.
- Quotes: `Quote`, `QuotePart`, `QuoteVendorItem`, `QuoteAddonSelection`, `QuoteAttachment`, `QuotePartAttachment`.
- Repeat work: `RepeatOrderTemplate`, `RepeatOrderTemplatePart`, `RepeatOrderTemplateCharge`, `RepeatOrderTemplateAttachment`.
- Configuration: `AppSettings`, custom-field models, and document-template models.
- Imports: `DrawingImportJob`, `DrawingImportSource`, `DrawingImportPage`, `DrawingExtractionAttempt`, `DrawingImportBomRow`, `DrawingImportBomEdge`, `DrawingTitleBlockProfile`.

Production migrations are additive via `prisma migrate deploy`. Seed scripts never run against production.

## Cross-cutting boundaries

### Auth

NextAuth owns sessions. `src/lib/auth.ts`, `auth-session.ts`, `auth-api.ts`, and `rbac.ts` provide shared boundaries. Middleware/layouts gate navigation; APIs authorize mutations independently. `TEST_MODE` is local/test only and remains off in production.

### Storage

`src/lib/storage.ts` is the file boundary; metadata/ownership live in SQLite and bytes live outside it. Development defaults to `storage/`. Intended Windows root is `C:\ShopApp\storage`.

Current inconsistency: persisted `AppSettings` has been observed as `/app/storage`, configuration points to `C:\ShopApp\storage`, and files have also been observed under `C:\app\storage`. Determine the effective root before backup/migration work; never silently move files. Complete backups require SQLite plus the effective attachment tree.

### AI

Drawing Import uses `src/modules/drawing-import/v2/ai/*`. Print/BOM Analyzer enters through `/api/print-analyzer/analyze`. API keys remain in deployment configuration. Routing/reasoning/verbosity/token/fallback/cost decisions do not belong in UI components.

## Production topology

```text
C:\ShopApp\app          replaceable source and standalone build
C:\ShopApp\config       production environment configuration
C:\ShopApp\data         SQLite database
C:\ShopApp\storage      intended persistent attachment root
C:\ShopApp\logs         runtime/maintenance logs
C:\ShopApp\maintenance  startup, supervisor, and health scripts
C:\ShopApp\backups      rollback and data backups
```

Scheduled tasks: `ShopApp`, `ShopApp Health Monitor`, `ShopApp Boot Supervisor`, `ShopApp Codex Desktop`, and `ShopApp Codex WSL Bridge`.

The app listens on port 3000. `/api/health` is the basic probe. Production uses `next build`, `scripts/copy-standalone-assets.cjs`, and `.next/standalone`. Deployments replace code/build only; configuration, data, effective attachments, logs, maintenance scripts, and backups persist.

## Verification and context routing

Tests live primarily beside domains under `__tests__/`. Executable changes require focused tests/lint and a clean production build when relevant. Documentation-only changes require path/link/hash verification, not an app rebuild.

Always orient with `AGENTS.md`, `CANON.md`, `ROADMAP.md`, this file, and `tasks/lessons.md`. Then load only the nearest subsystem instructions/docs, targeted `AGENT_CONTEXT` decisions, recent relevant `PROGRESS_LOG` entries, and the relevant current handoff section.

Do not read full chronological history by default. Search by subsystem, path, decision, or date.
