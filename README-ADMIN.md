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
- Custom Fields: define per-business fields for Orders or Quotes. Supports required flags and select options. Admin UI stub lists current fields with a placeholder builder.
- Document Templates: configure versioned templates for Quotes, Invoices, and Order Prints. Admin UI stub lists templates with placeholders for drag/drop layout and live preview.

Validation
- Zod schemas in `src/lib/zod.ts`, enforced client + server.

Pagination
- `take` default 20; cursor by `id` with `{ items, nextCursor }` response.

UI
- Dark theme, `NavTabs`, `Table` with actions, shadcn-styled dialog modals, confirmation prompts, and toast notifications.
- Quote detail actions now include **Email** (pre-populated `mailto:` with totals and attachment links) and **Print**. The print view hides vendor purchases/markup so only customer-facing pricing is shared.

Custom Fields (Admin)
- Navigate to `/admin/custom-fields`.
- Use the list to review per-business fields. The builder panel is a Phase 2 placeholder for drag/drop ordering and validation rules.
- API endpoints:
  - `GET /api/admin/custom-fields?entityType=ORDER&businessCode=STD`
  - `POST /api/admin/custom-fields`
  - `PATCH /api/admin/custom-fields/:id`
  - `DELETE /api/admin/custom-fields/:id`

Document Templates (Admin)
- Navigate to `/admin/templates`.
- Review templates by document type and business. The layout editor and live preview are placeholders for Phase 2.
- API endpoints:
  - `GET /api/admin/document-templates?documentType=QUOTE&businessCode=STD`
  - `POST /api/admin/document-templates`
  - `PATCH /api/admin/document-templates/:id` (creates a new version when layout/schema changes)
  - `DELETE /api/admin/document-templates/:id`
