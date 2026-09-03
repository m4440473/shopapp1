# ShopApp1

ShopApp1 is a part-centered operations system for a working machine shop. It connects quoting, order intake, drawings, material readiness, shop-floor execution, time tracking, repeat work, and administrative setup in one locally hosted application.

The core model is deliberate:

- Orders hold customer, commercial, and delivery context.
- Parts are the units of work.
- Operations and time belong to parts.
- Time is recorded as auditable start, pause, resume, and stop intervals.

Read [CANON.md](CANON.md) before changing those rules.

## What the app currently does

- Creates quotes and converts approved work into orders.
- Creates and edits orders with multiple parts, drawings, quantities, materials, finishes, departments, due dates, and required-reading instructions.
- Imports PDF, ZIP, and phone-photo drawings, splitting multi-page packets and extracting per-page part data for human review.
- Reuses prior parts across customers and businesses, and supports repeat-order templates.
- Tracks each part's material state from not reviewed through ordering, arrival, in-stock, or not required.
- Provides a Shop Floor view with work queues, department visibility, timers, operator accountability, and instruction acknowledgements.
- Calculates part-level time, charges, and order/quote print views.
- Includes customer, user, vendor, material, add-on, custom-field, template, AI-routing, and system-health administration.
- Includes a Haas VF-2SS-oriented feeds-and-speeds starting-value tool.

## Technology

- Next.js 15 App Router and React 18
- TypeScript, Tailwind CSS, and Radix UI
- Prisma 5 with SQLite
- NextAuth
- Vitest and ESLint
- OpenAI Responses API for drawing interpretation
- PDF.js, Sharp, Canvas, Tesseract, ZIP, and XLSX utilities

Domain code belongs in `src/modules/<domain>/`:

```text
<domain>.repo.ts      database access
<domain>.service.ts   business rules
<domain>.schema.ts    validation
<domain>.types.ts     shared types
<domain>.ui.tsx       domain UI, when applicable
```

Routes call services, services call repositories, and UI does not access Prisma directly. See [AGENTS.md](AGENTS.md) and [docs/AGENT_CONTEXT.md](docs/AGENT_CONTEXT.md) before development work.

## Prerequisites

- Node.js 20 LTS recommended
- npm with the committed `package-lock.json`
- Docker and Docker Compose only when using the optional container target
- An OpenAI API key only when drawing interpretation is enabled

## Local setup

### Installer

From the repository root in a Bash-capable environment:

```bash
bash scripts/install.sh --target local --seed basic
```

Options:

- `--target local|docker`
- `--seed basic|demo`
- `--start` for a local development server

### Manual setup

```bash
npm ci
cp .env.example .env
npm run prisma:generate
npx prisma migrate deploy
npm run seed:basic
npm run dev -- --hostname 0.0.0.0 --port 3000
```

Use `npm run seed:demo` instead of the basic seed for populated development data. `npm run set-demo-passwords` prepares the demo accounts defined by the seed scripts. Never run seed commands against the production database.

Generate a unique `NEXTAUTH_SECRET`, set the application URLs to the address users actually open, and provide environment-specific database, attachment, and OpenAI settings. Do not commit `.env`, API keys, passwords, customer data, drawings, or production databases.

## Useful commands

```bash
npm run dev
npm run test
npm run build
npm run prisma:generate
npx prisma migrate deploy
```

Run focused tests and lint for the code you change, then run a clean production build when the affected path requires it.

## LAN use

Bind the development server to all interfaces and use the real LAN origin in the URL settings:

```env
APP_BASE_URL="http://192.168.1.25:3000"
NEXTAUTH_URL="http://192.168.1.25:3000"
NEXT_PUBLIC_BASE_URL="http://192.168.1.25:3000"
```

Restart the app after environment changes. Keep production access restricted to the trusted LAN unless a separate security review explicitly approves broader exposure.

## Data and attachments

- SQLite is the application database; `DATABASE_URL` selects its location.
- Attachments default to `storage/` and can be moved with `ATTACHMENTS_DIR`.
- `node scripts/init-storage.cjs` creates the storage scaffold.
- The database and attachment tree are both required for a complete backup.
- Drawing imports may contain customer-controlled manufacturing information; treat them as sensitive operational data.

## Production operations

The current Windows deployment separates application code, configuration, persistent data, attachments, logs, and backups under `C:\ShopApp`. It runs the standalone Next.js build through Windows Scheduled Tasks and has a separate health monitor.

Production changes should follow the server runbook in [docs/AGENT_CONTEXT.md](docs/AGENT_CONTEXT.md): back up the exact source and `.next` build, stop the monitor and application, deploy the scoped change, build, restart, verify `/api/health`, verify the scheduled task/monitor state, and retain a rollback directory. Never overwrite the production database or attachment store with development data.

## Drawing interpretation

Drawing import is intentionally review-first. Model output populates editable fields; it is not authoritative manufacturing data. Operators must inspect the original page and confirm part number, description, revision, quantity, material, finish, overall dimensions, and thickness before creating quote or order parts.

AI model and fallback behavior are controlled through Admin settings and server configuration. Keep cost-routing decisions out of UI components, do not expose API keys, and preserve the image-versus-PDF processing paths unless a verified change requires otherwise.

## Project guidance

- [CANON.md](CANON.md): product constitution and non-negotiable model
- [ROADMAP.md](ROADMAP.md): planned architecture and product sequence
- [AGENTS.md](AGENTS.md): contribution rules and required workflow
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): compact map of the code and production structure as it exists now
- [docs/AGENT_CONTEXT.md](docs/AGENT_CONTEXT.md): current invariants, decisions, and production runbook
- [PROGRESS_LOG.md](PROGRESS_LOG.md): chronological implementation evidence
- [docs/AGENT_HANDOFF.md](docs/AGENT_HANDOFF.md): latest session handoffs
- [docs/DRAWING_ORDER_IMPORT_WORKFLOW.md](docs/DRAWING_ORDER_IMPORT_WORKFLOW.md): drawing-import workflow
- [docs/QUOTE_FIRST_WORKFLOW.md](docs/QUOTE_FIRST_WORKFLOW.md): quote-first workflow

## Troubleshooting

- After resetting or reseeding local data, sign out and back in so the session does not reference a deleted user.
- If Prisma generation or seeding fails, run `npm run prisma:generate`, apply migrations, then retry the selected seed.
- If attachments are missing, verify both `ATTACHMENTS_DIR` and the persisted application setting resolve to the intended absolute directory.
- For production problems, check `/api/health`, the ShopApp scheduled tasks, and the application logs before rebuilding or reprocessing work.
