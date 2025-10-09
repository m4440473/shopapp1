# Shop Orders — Database Layer

This package contains the Prisma schema and seed for the Shop Orders app.

## Prerequisites

1. Install **Node.js 18** or newer. The easiest cross-platform approach is to
   use [nvm](https://github.com/nvm-sh/nvm#installing-and-updating). Once nvm is
   installed, run:

   ```bash
   nvm install --lts
   nvm use --lts
   ```

   This installs Node.js and its accompanying `npm` CLI.
2. Enable [Corepack](https://nodejs.org/api/corepack.html) so you can use the
   project’s preferred package manager (`pnpm`):

   ```bash
   corepack enable
   ```

   If Corepack is unavailable on your Node.js version, install pnpm globally
   instead: `npm install -g pnpm`.

After the prerequisites are in place, install dependencies from the repository
root:

```bash
pnpm install
```

## Quickstart (SQLite)

```bash
pnpm add -D prisma
pnpm add @prisma/client
cp .env.example .env
pnpm prisma generate
pnpm prisma migrate dev --name init
pnpm ts-node ./prisma/seed.ts

> **Using npm instead of pnpm?** Run the equivalent scripts with `npm run`, or
> call the Prisma CLI directly: `npx prisma generate` and `npx prisma migrate
> dev`. Note the space between `prisma` and the command (for example,
> `prisma generate`) when using `npx`.

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

## Attachment storage

- Attachments are stored on disk underneath the directory defined by the
  `ATTACHMENTS_DIR` environment variable. If it is not set, the application
  defaults to a local `storage/` folder in the project root.
- `npm install` / `pnpm install` automatically run `scripts/init-storage.cjs` to
  create the attachment root and top-level folders for each business (Sterling
  Tool and Die, C and R Machining, Powder Coating).
- Attachments are saved using slugified directory names in the format
  `<business>/<customer>/<reference>/`. For example, an order for "Acme Co" with
  reference `PO-1234` under Sterling Tool and Die will live at
  `storage/sterling-tool-and-die/acme-co/po-1234/` by default.
- Override `ATTACHMENTS_DIR` at runtime or during installation to point to a
  different root location, and rerun `node scripts/init-storage.cjs`
  if you need to recreate the initial structure manually.

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
- Models and enums exactly cover: User, Customer, Material, Vendor, Addon, Order, OrderPart, OrderChecklist, TimeLog, StatusHistory, Attachment, Note; Role, Priority, Status, TimePhase.
