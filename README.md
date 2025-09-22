# Shop Orders — Database Layer

This package contains the Prisma schema and seed for the Shop Orders app.

## Quickstart (SQLite)

```bash
pnpm add -D prisma
pnpm add @prisma/client
cp .env.example .env
pnpm prisma generate
pnpm prisma migrate dev --name init
pnpm ts-node ./prisma/seed.ts

If ts-node isn’t available:

pnpm add -D ts-node typescript

What you get
	•	Complete schema with enums and relations
	•	Indices for status/dueDate and common lookups
	•	Referential actions (Cascade/SetNull/Restrict) chosen to preserve history
	•	Seed data:
	•	Users: admin@example.com, mach1@example.com, mach2@example.com, viewer@example.com
	•	Catalogs: common materials/vendors/checklist items
	•	Customers: Corning, Toyota, Acme Fab
	•	Orders: 3 sample POs with parts, checklist rows, history, notes, timelogs, attachments

Switch to MySQL (optional)
	1.	In datasource db set provider = "mysql" and set DATABASE_URL in .env.
	2.	Run:

pnpm prisma generate
pnpm prisma migrate dev --name init_mysql
pnpm ts-node ./prisma/seed.ts

Hand-off to Agent 2+
	•	Agent 2 (Auth/RBAC) can rely on User.passwordHash being nullable.
	•	API can assume relational integrity and indexes are in place.

---

## Acceptance criteria (hard)
- `grep -R "\.\.\."` matches **zero** files.
- `prisma/schema.prisma` compiles; `pnpm prisma generate` succeeds.
- `pnpm prisma migrate dev --name init` creates a valid SQLite DB.
- `pnpm ts-node prisma/seed.ts` runs without error and creates at least 3 orders with child rows.
- All relations enforce sensible `onDelete` behaviors (Orders cascade parts, notes, timelogs, attachments, checklist; Users set-null on history/notes/attachments; Materials/Vendors set-null on parts/orders).
- Models and enums exactly cover: User, Customer, Material, Vendor, ChecklistItem, Order, OrderPart, OrderChecklist, TimeLog, StatusHistory, Attachment, Note; Role, Priority, Status, TimePhase.
