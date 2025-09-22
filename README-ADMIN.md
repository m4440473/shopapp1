# Admin Portal (Agent 3) — Fixed

Scope: Admin-only CRUD for Users, Materials, Vendors, Checklist Items.

Setup
- Ensure Agent 1 (DB/Prisma) and Agent 2 (Auth/RBAC) are installed and configured.
- Start: `pnpm dev` (or `npm run dev`), sign in as an ADMIN.
- Navigate to `/admin`.

RBAC
- Every `/api/admin/*` route calls `getServerSession(authOptions)` and checks `canAccessAdmin(role)`.
- If no session: `new NextResponse('Unauthorized', { status: 401 })`.
- If non-admin: `new NextResponse('Forbidden', { status: 403 })`.

Entities
- Users: list name/email/role/active. Create (email, name?, role, active=true). Update (name, role, active). **Email is immutable after create.** **DELETE blocked** (405).
- Materials & Vendors: list/search, create/edit/delete.
- Checklist Items: label, active. Delete guarded — if referenced in any `OrderChecklist`, returns 409 `{ "error": "Item in use; disable instead." }`.

Validation
- Zod schemas in `src/lib/zod.ts`, enforced client + server.

Pagination
- `take` default 20; cursor by `id` with `{ items, nextCursor }` response.

UI
- Dark theme, `NavTabs`, `Table` with actions, `DialogForm` modals, `ConfirmButton`, `Toast` notifications.
