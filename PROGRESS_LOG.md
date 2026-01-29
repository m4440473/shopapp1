**Non-authoritative operational history. CANON.md and ROADMAP.md are authoritative.**

# Progress Log

# PROGRESS_LOG — ShopApp1

Running “what happened / what next” log.
Agents MUST update this at the end of every session.

## Current Priorities (P0 → P3)

### P0 — Platform Stability
- Auth/session reliability (single approach, consistent guards)
- App shell reliability (providers, CSS, layout stability)
- Mobile nav + core shell usability

### P1 — UX + Core Flows
- Orders page redesign (clean, usable, fast)
- Time tracking that supports stop/switch/resume without inflating time

### P2 — Modularization
- Migrate domain logic out of src/lib/* into src/modules/*
- Enforce “repo/service/ui/schema” boundaries
- Establish consistent patterns for validation and data access

### P3 — Expansion
- Reporting/export, attachments, and other add‑ons as needed

## Latest Status

### Repo state summary
- Next.js App Router
- Prisma database layer
- shadcn/tailwind UI
- Auth utilities exist in src/lib/auth.ts
- Domain logic exists in src/lib/* (orders/quotes/etc.) but needs module boundaries

### Important domain note (do not regress)
- Labor and Addon charges are already enforced as per‑part (partId required for LABOR/ADDON).
- Order‑level charges are still allowed for non‑labor/addon kinds (e.g., shipping/fees/discounts) by design.

## Session Log (append newest at top)

### 2026-02-02 — Lockdown pass cleanup + build hardening
- Removed patch zip artifacts, archived process docs under docs/archive, and ignored future zip artifacts.
- Added non-authoritative banners to continuity docs and aligned README to npm as the canonical install path.
- Standardized admin quotes pages to use canAccessAdmin and adjusted API routes for consistent ServiceResult handling.
- Converted admin API PrismaClient usage to the shared prisma proxy, added lazy prisma init, and deferred prisma imports in public attachment routes to reduce build-time initialization.
- Removed pnpm-lock.yaml.

Files changed:
- AGENTS.md, PROGRESS_LOG.md, docs/AGENT_CONTEXT.md, docs/AGENT_HANDOFF.md
- README.md, .gitignore, pnpm-lock.yaml (removed)
- docs/archive/* (archived process/patch docs)
- src/app/admin/quotes/[id]/page.tsx, src/app/admin/quotes/page.tsx
- src/app/api/admin/*, src/app/api/orders/*, src/app/api/time/*
- src/app/(public)/attachments/[...path]/route.ts, src/app/(public)/branding/logo/route.ts
- src/lib/auth.ts, src/lib/prisma.ts
- src/modules/orders/orders.repo.ts, src/modules/orders/orders.service.ts, src/modules/time/time.types.ts

Commands run:
- npm ci (succeeded; warnings about deprecated packages)
- npm test (passed)
- npm run lint (passed)
- npm run prisma:generate (failed: Prisma schema validation error on TimeEntry.part relation)
- npm run build (failed: Prisma client not initialized during prerender without generated client)

### 2026-02-01 — Prompt E time tracking UX in orders/parts
- Added time tracking summary API plus repo/service helpers to surface active/last entries per order and part.
- Added order-level and part-level time tracking controls inside the order detail page with clear active/last status.
- Kept UI time tracking calls routed through API to avoid Prisma usage in UI components.

Tests run:
- Not run (not requested).

### 2026-01-31 — Prompt D time tracking interval core
- Added TimeEntry model and time tracking module with interval-based start/pause/stop/resume services.
- Created API routes for time start/pause/stop/resume that enforce single active entry per user.
- Added total computation helper from intervals (no stored totals).

Tests run:
- Not run (not requested).

### 2026-01-30 — Prompt C Orders/Quotes boundary cleanup
- Moved quote preparation logic into quotes service/repo helpers and routed quotes API handlers through the service layer.
- Removed Prisma usage from Orders/Quotes UI pages by fetching through new print-data endpoints and existing admin quote APIs.
- Added print-data API routes for quotes and orders and centralized document template listing.

Tests run:
- Not run (not requested).

### 2026-01-30 — Prompt B steps 3-4 layout/nav stability review
- Reviewed layout/provider tree for unstable conditionals; none found that would drop the shell or providers.
- No layout/nav code changes needed for step 3-4; mobile nav already covers core pages.

Tests run:
- Not run (review only).

### 2026-01-30 — Prompt A Step 3-5 auth guard alignment
- Standardized admin checks in middleware and whoami to use shared RBAC helper for consistent session-based admin evaluation.
- Reviewed layout/providers for duplication; no changes needed.

Tests run:
- Not run (not requested).

### 2026-01-30 — Add roadmap and mechanical agent prompts
- Added ROADMAP.md with gate-based phases and exit criteria.
- Added AGENT_PROMPTS.md with strict, rule-driven agent instructions.
- Logged the decision in docs/AGENT_CONTEXT.md.
- Updated handoff notes for continuity.

Tests run:
- Not run (not requested).

### 2026-01-30 — Add canonical project document
- Created CANON.md to define the product purpose, mental model, UX principles, and roadmap.
- Logged the new canon file in the Decision Log to prevent context drift.
- Updated handoff notes for continuity.

Tests run:
- Not run (per request).

### 2026-01-29 — Fix middleware response status typing
- Updated middleware to set status via NextResponse.rewrite init to satisfy read-only typing.
- Build now advances past middleware but fails in Orders assign route type narrowing (not modified).

Tests run:
- `npm run build` (failed: src/app/api/orders/[id]/assign/route.ts ServiceResult .data typing)

### 2026-01-29 — Regenerated Prisma client for build
- Ran `npx prisma generate` to fix the missing Prisma client artifacts.
- Build now progresses further but fails due to a TypeScript error in middleware (no changes made per constraints).

Tests run:
- `npx prisma generate`
- `npm run build` (failed: middleware.ts type error assigning to read-only status)

### 2026-01-29 — Mark quotes routes server-only
- Added `server-only` imports to all Quotes API routes.
- Re-ran build; failure persists due to missing Prisma client browser artifacts in this environment.

Tests run:
- `npm run build` (failed: Module not found: Can't resolve '.prisma/client/index-browser')

### 2026-01-29 — Add server-only to quotes repo
- Added the server-only import to the Quotes repo module.
- Re-ran build; failure persists due to missing Prisma client browser artifacts in this environment.

Tests run:
- `npm run build` (failed: Module not found: Can't resolve '.prisma/client/index-browser')

### 2026-01-29 — Quotes API routes use quotes repo
- Created src/modules/quotes/quotes.repo.ts and moved Quotes API Prisma queries into repo functions.
- Updated Quotes API routes to use the repo, keeping runtime behavior the same while enforcing Prisma boundaries.
- Build failed in this environment due to missing Prisma client build artifacts (see tests).

Tests run:
- `npm run build` (failed: Module not found: Can't resolve '.prisma/client/index-browser')

### 2026-01-30 — Orders API routes layered via repo/service
- Moved all Orders API route Prisma access into src/modules/orders/orders.repo.ts and added service wrappers for each Orders route.
- Updated Orders API routes to call orders.service.ts for data access and business rules, keeping routes thin.
- Orders routes no longer import Prisma directly, enforcing the Orders module boundary.

Next steps (immediate)
- Continue module extraction for the next domain (Quotes) following the Orders repo/service pattern.

### 2026-01-29 — Orders module extraction (repo/service/schema/types)
- Moved Orders domain helpers out of src/lib into src/modules/orders (repo/service/schema/types).
- Updated Orders-related API routes and UI imports to use the new module entry points.
- Documented remaining boundary gap: Orders API routes still use Prisma directly and need repo/service extraction later.

Next steps (immediate)
- Move Prisma access from Orders API routes into src/modules/orders/orders.repo.ts with service wrappers.
- Continue module extraction for the next domain (Quotes) after Orders routes are fully layered.

### 2026-01-28 — Architecture map + continuity docs alignment
- Reviewed current app shell, domains, data flow, and charge model to establish a repo-backed architecture map.
- Documented boundary violations and a plan-only Orders module extraction list (no code changes).
- Added docs/ARCHITECTURE_MAP.md and created docs/AGENT_CONTEXT.md and docs/AGENT_HANDOFF.md (docs were missing in /docs).

Next steps (immediate)
- Decide whether to deprecate/remove root AGENT_CONTEXT.md and AGENTS_HANDOFF.md now that docs/ copies exist.
- Begin Orders module extraction planning with repo/service/schema split.

### 2026-01-28 — Continuity spine created + corrected charge note
- Added AGENTS.md (agent charter + architecture rules)
- Added docs/AGENT_CONTEXT.md (priorities + invariants + decision log)
- Added docs/AGENT_HANDOFF.md (handoff template)
- Clarified that LABOR/ADDON are already per‑part; only other charge kinds may be order‑level

Next steps (immediate)
- Confirm desired UX direction for Orders page (hierarchy, what fields matter)
- Decide initial module split: Orders / Quotes / Customers / Time
- Begin “architecture lock” (file moves + boundary enforcement) without changing functionality

## Upcoming Work Queue (short list)

- [ ] Create src/modules/* structure and migrate one domain (Orders) first
- [ ] Standardize server-side data access pattern (repo/service)
- [ ] Standardize validation entry points (zod schemas in module)
- [ ] Establish mobile-first app shell nav pattern and apply across key pages
- [ ] Implement time tracking model (TimeEntry, active timer constraints)



## 2026-01-28
- Summary: Added admin-only part management controls with invoice handling prompts, add-on/labor charge copying, and server-side logging for part changes.
- Tests run: `npm run lint`

## 2026-01-23
- Summary: Expanded the Replit agent playbook with publishing rules, debugging checklist, and deployment templates.
- Tests run: `npm run lint`

## 2026-01-22
- Summary: Normalized template section data for the admin template designer and restored the Shop Floor Intelligence nav link.
- Tests run: `npm run lint`

## 2026-01-22
- Summary: Added Replit deployment playbook, fixed admin access handling, improved mobile navigation and orders list, and ensured standalone asset copying for Replit deployments.
- Tests run: `npm run lint`

## 2026-01-22
- Summary: Simplified NextAuth credential handling by removing debug logs and centralizing role/admin normalization helpers for cleaner session/token mapping.
- Tests run: `npm run lint`

## 2026-01-22
- Summary: Replaced raw img tags with Next.js Image components and fixed an effect dependency with useCallback.
- Tests run: `npm run lint`

## 2025-09-27
- Summary: Rebuilt the admin template builder into a drag-and-drop section canvas with a website-builder-style library and richer live preview.
- Tests run: `npm run lint` (failed: ESLint not installed in environment)

## 2026-01-21
- Summary: Added invoice and order-print specific live preview content in the template editor so layouts reflect the selected document type.
- Tests run: `npm run lint`

## 2026-01-21
- Summary: Added template selection controls for quote printing so admins can preview and print with any active quote template.
- Tests run: `npm run lint`

## 2026-01-21
- Summary: Added template selection for order print previews and disabled webpack caching in dev to avoid missing .next cache warnings.
- Tests run: `npm run lint`
