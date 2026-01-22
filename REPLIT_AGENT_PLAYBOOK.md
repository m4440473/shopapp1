# Replit Agent Playbook

## Required Replit Secrets (Environment Variables)

Set these in Replit → **Secrets**:

- `NEXTAUTH_URL=https://shopapp-1.replit.app`
- `NEXTAUTH_SECRET=<generate a strong secret>`
- `DATABASE_URL=<Postgres connection string>`
- `ATTACHMENTS_DIR=/home/runner/<your-repl>/storage` (optional override; defaults to `storage/`)
- `NEXT_PUBLIC_BASE_URL=https://shopapp-1.replit.app` (optional, mirrors `NEXTAUTH_URL`)

> **Important:** Do **not** run migrations or seed scripts at build time. Keep them as one-time/manual tasks.

## Build / Start Commands (Standalone)

This repo uses `output: 'standalone'`. For Replit, build and start like this:

```bash
npm run build
npm start
```

The scripts are configured to:

- Build the app and copy assets into the standalone bundle.
- Start the standalone server with the expected host/port.

### Standalone assets copy

If `output: 'standalone'` is enabled and the runtime is `node .next/standalone/server.js`, you **must** copy assets:

```bash
# scripts/copy-standalone-assets.sh
# copies .next/static -> .next/standalone/.next/static
# copies public -> .next/standalone/public
```

## Auth + Security Sanity Checks

- ✅ `NEXTAUTH_URL` is set to the public Replit URL (never `0.0.0.0` or `localhost`).
- ✅ `/admin/*` is guarded by middleware:
  - Logged out ⇒ redirect to `/auth/signin?callbackUrl=<original>`.
  - Logged in but not ADMIN ⇒ 403 page (“Not authorized”).
- ✅ Admin API routes still enforce server-side role checks.
- ✅ UI hides admin-only controls for non-admin users.

## Mobile Sanity Checks

Verify at **390×844** (iPhone portrait):

- Top nav shows a hamburger menu + compact logo + account button.
- Search input appears **inside** the Sheet, not in the top bar.
- `/orders` uses card rows on mobile (not a wide table).
- `/admin/materials` and other admin tables scroll horizontally and use sticky first column.

## Troubleshooting

### “No styles” / plain-text UI after deploy

This usually means `/_next/static` is missing in standalone mode.

Fix:

1. Ensure build runs the copy step:
   - `.next/static` → `.next/standalone/.next/static`
   - `public` → `.next/standalone/public`
2. Rebuild and restart:

```bash
npm run build
npm start
```

### Auth redirect goes to 0.0.0.0 or localhost

- Confirm `NEXTAUTH_URL` is set to the public Replit URL.
- Restart the repl after updating secrets.

## One-time setup (manual)

When provisioning a new environment, run these **manually** (not in build):

```bash
npm run prisma:generate
npm run prisma:push
npm run seed
```

(Use `prisma:migrate` only if you intend to manage migrations locally.)
