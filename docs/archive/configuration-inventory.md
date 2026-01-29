# Configuration Inventory (Phase 0)

## Goals & priorities (from stakeholder)
1. Custom fields (Quote + Order intake)
2. Invoices/templates
3. Orders workflow
4. Quotes workflow
5. Catalogs
6. Branding
7. Roles/permissions

## Admin scope
- Admin-only access to all configuration surfaces.
- No non-admin configuration editing.
- Single-tenant install with optional per-business overrides (multiple businesses under one roof).

## Current state (what exists today)

### Branding & theme
- App-wide branding (company name/logo) and theme colors are stored in `AppSettings`.
- Admin UI exists under **Admin → Settings** with a dedicated tab for Branding + Theme.

### Workflow rules
- Quote workflow constraints (PO requirement) are stored in `AppSettings` and editable via Admin Settings.

### Invoices/templates
- AppSettings includes `invoiceTemplateId` and `invoiceOptions`, but templates are hardcoded in the admin client.
- No persisted layout configuration exists for invoices.

### Catalogs
- Structured tables exist for core catalogs: `Materials`, `Vendors`, `Addons`, and `Departments`.
- Departments are already editable in Admin Settings.

### Orders/quotes
- Orders and quotes are first-class models with many fields, but layouts are static and not admin-configurable.
- `business` is stored as a string, allowing multiple business names under one instance.

### Roles/permissions
- Authentication is implemented (NextAuth + Prisma). Role values are stored as strings.
- No DB-driven permission model exists yet.

## Gaps vs desired configuration

### Dynamic layouts
- Quote, invoice, and order print layouts need to be admin-configurable via drag-and-drop UI.
- Live preview is required while rearranging sections.
- Layout configuration should be stored as versioned JSON for easy future migration.
- Initial sections to support: header, customer info, total price, part name, part info, line items, addons/labor, shipping.

### Custom fields
- Quote and order intake must support custom fields with required/optional rules.
- Field definitions must be data-driven and admin-managed.
- Fields should be optionally scoped to a business code, defaulting to global.

### Admin categorization
- Settings should be organized into clear categories:
  - Branding
  - Theme
  - Workflow
  - Catalogs
  - Documents/Templates
  - Custom Fields
  - Roles/Permissions

## Phase 1 schema foundation (planned)

### New tables to introduce
- **CustomField**: defines fields for entities (initially Quote + Order).
- **CustomFieldOption**: picklist options for select/multi-select fields.
- **CustomFieldValue**: stores values for a given entity + field.
- **DocumentTemplate**: persisted layout/config JSON for Quote/Invoice/Order Print templates.

### Notes
- Custom fields are initially scoped to **Quote** and **Order** entities.
- Templates store layout JSON plus a schema version to support drag-and-drop rendering and live preview.
- Single-tenant model remains, with optional per-business overrides via a `businessCode` string.
