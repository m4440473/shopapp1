# Phase 4A — Orders API (List + Create)

Files added:
- `src/lib/zod-orders.ts`
- `src/app/api/orders/route.ts`

Usage:
- `GET /api/orders` — filter with `?q=&status=&assignedMachinistId=&customerId=&overdue=1&awaitingMaterial=1&priority=&take=&cursor=`
- `POST /api/orders` — Admin only; JSON body includes order meta, parts, optional checklist seeding, and attachments.

This patch doesn't touch existing files; safe to merge into Phase 1–3 baseline.

## Attachments storage

Orders now store uploaded files on the shared filesystem. Refer to
[`docs/order-attachments-migration.md`](docs/order-attachments-migration.md) for guidance on migrating
legacy base64 attachments into the new directory structure.
