# Architecture Map — ShopApp1 (Current State)

> Scope: **as-is** architecture only. No aspirational changes. This map reflects the repo at time of writing.

## 0) Repository continuity doc status

- `docs/AGENT_CONTEXT.md` and `docs/AGENT_HANDOFF.md` were missing in `docs/` at session start.
- `docs/AGENT_CONTEXT.md` has been created by copying the existing root `AGENT_CONTEXT.md` to satisfy the required reading path in `AGENTS.md`.
- `docs/AGENT_HANDOFF.md` has been created and filled for this session.

## 1) App shell

### Providers, layout, navigation entry points
- **Root layout**: `src/app/layout.tsx`
  - Applies global styles (`src/app/globals.css`).
  - Wraps app in `Providers` and renders a header with `AppNav`, a main container, and a footer.
  - Uses `getAppSettings()` and `buildThemeVars()` from `src/lib/app-settings.ts` for theme + branding data.
  - Uses `getInitials()` from `src/lib/get-initials.ts` for branding fallback initials.
- **Providers**: `src/components/Providers.tsx`
  - Client component; wraps children with `SessionProvider` from NextAuth.
- **Navigation**: `src/components/AppNav.tsx`
  - Client component that builds navigation links based on `useCurrentUser()` and `canAccessAdmin()`.
  - Fetches user from `/api/whoami` via `src/lib/use-current-user.ts`.

### Auth/session enforcement
- **Middleware**: `middleware.ts`
  - Enforces auth + admin-only access for `/admin/*` routes using `next-auth/jwt`.
- **API routes**: most server routes call `getServerSession(authOptions)` or otherwise check session and role (e.g., `src/app/api/orders/route.ts`).
- **Server components**: many pages query Prisma directly without explicit auth checks beyond route-level access (e.g., `src/app/admin/*` pages and `src/app/page.tsx`).

## 2) Domain areas that already exist

### Orders
- **UI**
  - `src/app/orders/page.tsx` (client list UI calling `/api/orders`).
  - `src/app/orders/new/*` (order creation UI).
  - `src/app/orders/[id]/*` (order detail + print pages).
- **API routes**
  - `src/app/api/orders/*` (list, create, parts, charges, checklist, attachments, notes, status, etc.).
- **Lib / domain logic + helpers**
  - `src/lib/orders.server.ts` (order number generation).
  - `src/lib/order-charges.ts` (order checklist sync for charges).
  - `src/lib/order-filtering.ts` + `src/lib/order-status-labels.ts` (client list display + sorting/filtering helpers).
  - `src/lib/zod-orders.ts` + `src/lib/zod-charges.ts` (request validation schemas).

### Quotes
- **UI (admin)**
  - `src/app/admin/quotes/*` (quote list, detail, edit, print).
- **API routes (admin)**
  - `src/app/api/admin/quotes/*` (list/create/update/convert/approval actions).
- **Lib / domain logic + helpers**
  - `src/lib/quotes.server.ts` (quote number generation + quote preparation logic).
  - `src/lib/quote-metadata.ts`, `src/lib/quote-part-pricing.ts`, `src/lib/quote-visibility.ts`.
  - `src/lib/zod-quotes.ts` (validation schemas).

### Customers
- **UI**
  - `src/app/customers/*` (customers list and detail).
- **API routes (admin)**
  - `src/app/api/admin/customers/*`.
- **Lib / domain logic + helpers**
  - `src/lib/zod-customers.ts`.

### Charges (labor/addons/etc.)
- **Order charges API**: `src/app/api/orders/[id]/charges/*` and checklist endpoints.
- **Schemas**: `src/lib/zod-charges.ts` (charge kind definitions + validation rules).
- **Checklist syncing**: `src/lib/order-charges.ts`.
- **Addons + departments**: `src/app/api/admin/addons/*`, `src/app/api/admin/departments/*` and pages under `src/app/admin/*`.

### Time-related logic (if present)
- No dedicated time-tracking domain or module observed. Mentions of time exist in UI copy and simple sorting/calculations (e.g., order list sorting by date) but no explicit time-entry domain logic or API routes.

## 3) Data flow (current behavior)

### Prisma access
- **Prisma client** is provided by `src/lib/prisma.ts` and imported directly in many files.
- **Direct Prisma access appears in**:
  - API routes under `src/app/api/**` (orders, quotes, admin resources, customers, etc.).
  - Server components (e.g., `src/app/page.tsx`, `src/app/admin/*`, `src/app/customers/*`, `src/app/machinists/[id]/page.tsx`).
  - Lib files that encapsulate logic (e.g., `src/lib/orders.server.ts`, `src/lib/quotes.server.ts`, `src/lib/order-charges.ts`).

### Typical request → validation → business logic → response
- **Orders list** (`GET /api/orders` in `src/app/api/orders/route.ts`):
  1) `getServerSession(authOptions)` checks session.
  2) Querystring is validated with `OrderQuery` from `src/lib/zod-orders.ts`.
  3) Route builds Prisma `where` filters inline.
  4) Prisma query executes directly in the route.
  5) Response sent as JSON.
- **Orders create** (`POST /api/orders` in same file):
  1) `getServerSession` + admin check via `canAccessAdmin`.
  2) Body validated with `OrderCreate` from `src/lib/zod-orders.ts`.
  3) Order number generation uses `generateNextOrderNumber` from `src/lib/orders.server.ts`.
  4) Prisma transaction is orchestrated directly in the route.

### Boundary violations (identification only)
- **Routes contain business logic + direct Prisma usage** (e.g., `src/app/api/orders/route.ts`, `src/app/api/admin/quotes/*`).
- **Server components access Prisma directly** (e.g., `src/app/admin/*`, `src/app/page.tsx`, `src/app/customers/*`).
- **Lib contains domain logic** (e.g., order/quote logic in `src/lib/*` instead of `src/modules/*`).

These are in-scope for future modularization but are **not** changed in this session.

## 4) Charge model reality check

- **LABOR and ADDON charges are per-part**: validation requires `partId` when `kind` is `LABOR` or `ADDON` (`src/lib/zod-charges.ts`).
- **Order-level charges are intentionally allowed** for other kinds (`MATERIAL`, `FEE`, `SHIPPING`, `DISCOUNT`), because those kinds do not require a `partId` in the schema.

## 5) First module extraction plan (Orders) — plan only

> No files moved in this session. This is a proposed, minimal extraction plan.

### Files to move into `src/modules/orders/`
- **Repo (Prisma access)**
  - `src/lib/orders.server.ts` → `src/modules/orders/orders.repo.ts`
  - Prisma-heavy logic currently in API routes (future extraction):
    - `src/app/api/orders/route.ts`
    - `src/app/api/orders/[id]/**`
- **Service (business logic)**
  - `src/lib/order-charges.ts` → `src/modules/orders/orders.service.ts`
  - Portions of route logic (e.g., order creation workflow) to be moved into services later.
- **Schema**
  - `src/lib/zod-orders.ts` → `src/modules/orders/orders.schema.ts`
  - `src/lib/zod-charges.ts` → `src/modules/orders/orders.charges.schema.ts` (or consolidated into orders.schema.ts).
- **Types**
  - Extract shared order types into `src/modules/orders/orders.types.ts` (currently implicit across files).
- **UI**
  - Domain UI components could move from `src/app/orders/**` into `src/modules/orders/orders.ui.tsx` as shared components (if/when reuse appears).

### What stays in `src/lib/`
- **Infrastructure/cross-cutting only**:
  - `src/lib/prisma.ts` (Prisma client)
  - `src/lib/auth.ts` (auth/session)
  - `src/lib/rbac.ts` (role checks)
  - `src/lib/storage.ts` (storage utilities)
  - `src/lib/fetchJson.ts`, `src/lib/utils.ts`, `src/lib/get-initials.ts`, `src/lib/app-settings.ts`

