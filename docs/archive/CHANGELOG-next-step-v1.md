# Changelog — Next Step Patch v1 (Stabilize Phase 4A)

Replaced truncated files with complete implementations to get the Orders list/create API and seed working.

Touched paths:
- prisma/seed.ts — full seed for Materials, Vendors, ChecklistItems, Customers, Users, sample Orders (with Parts, StatusHistory, TimeLogs, Notes).
- src/lib/zod-orders.ts — enums + zod schemas for GET filters and POST body.
- src/app/api/orders/route.ts — GET with filters + cursor; POST to create order with parts, checklist, attachments, initial StatusHistory; RBAC (ADMIN for POST).

Runbook:
1) npm install
2) npx prisma generate
3) npx prisma migrate dev --name init (if first time)
4) npx ts-node prisma/seed.ts
5) npm run dev
6) Test GET /api/orders and POST /api/orders
