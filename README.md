# Shop Orders — Database Layer

npm is the canonical install path (package-lock.json is authoritative).

This package contains the Prisma schema and seed for the Shop Orders app.

## Replit deployment playbook

See [`docs/archive/REPLIT_AGENT_PLAYBOOK.md`](./docs/archive/REPLIT_AGENT_PLAYBOOK.md) for historical Replit environment variables, build/start steps, and troubleshooting tips.

## Prerequisites

1. Install **Node.js 18** or newer. The easiest cross-platform approach is to
   use [nvm](https://github.com/nvm-sh/nvm#installing-and-updating). Once nvm is
   installed, run:

   ```bash
   nvm install --lts
   nvm use --lts
   ```

   This installs Node.js and its accompanying `npm` CLI.
2. Use the npm CLI that ships with Node.js for installs and scripts.

After the prerequisites are in place, install dependencies from the repository
root:

```bash
npm ci
```

## Quickstart (SQLite)

```bash
npm install -D prisma
npm install @prisma/client
cp .env.example .env
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run seed

If ts-node isn’t available:

npm install -D ts-node typescript

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
- `npm install` automatically runs `scripts/init-storage.cjs` to
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

npm run prisma:generate
npm run prisma:migrate -- --name init_mysql
npm run seed

Hand-off to Agent 2+
	•	Agent 2 (Auth/RBAC) can rely on User.passwordHash being nullable.
	•	API can assume relational integrity and indexes are in place.

---

## Acceptance criteria (hard)
- `grep -R "\.\.\."` matches **zero** files.
- `prisma/schema.prisma` compiles; `npm run prisma:generate` succeeds.
- `npm run prisma:migrate -- --name init` creates a valid SQLite DB.
- `npm run seed` runs without error and creates at least 3 orders with child rows.
- All relations enforce sensible `onDelete` behaviors (Orders cascade parts, notes, timelogs, attachments, checklist; Users set-null on history/notes/attachments; Materials/Vendors set-null on parts/orders).
- Models and enums exactly cover: User, Customer, Material, Vendor, Addon, Order, OrderPart, OrderChecklist, TimeLog, StatusHistory, Attachment, Note; Role, Priority, Status, TimePhase.
