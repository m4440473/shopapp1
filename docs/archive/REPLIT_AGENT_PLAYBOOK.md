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

## Replit Publishing / Production Rules

### 1) The #1 Replit Production Rule: never hardcode the port

Replit Publishing assigns the listening port at runtime. Always read it from
`process.env.PORT` and keep the default for local dev only.

✅ Good:

```js
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Listening on ${PORT}`);
});
```

❌ Bad:

- `app.listen(5000)`
- `PORT=5000`
- `app.listen(PORT, "localhost")`

Common failure symptoms:

- `EADDRNOTAVAIL` or server won’t start in Publishing.
- Logs show a hardcoded port (like 5000).

### 2) Bind address: 0.0.0.0 (not localhost)

In hosted environments, binding to localhost makes the server unreachable from
outside.

✅ Good:

```js
app.listen(PORT, "0.0.0.0");
```

❌ Bad:

```js
app.listen(PORT, "127.0.0.1");
app.listen(PORT, "localhost");
```

### 3) Production start command: keep it boring

Replit Publishing expects a single `start` entry point.

**Next.js (no custom server)**

```json
{
  "scripts": {
    "build": "next build",
    "start": "next start -p $PORT -H 0.0.0.0"
  }
}
```

**Express**

```json
{
  "scripts": {
    "start": "node server.js"
  }
}
```

### 4) Next.js specifics (common Replit gotchas)

- **No custom server:** use `next start -p $PORT -H 0.0.0.0`.
- **Custom server (Express + Next):** ensure `server.listen` uses
  `process.env.PORT` and `0.0.0.0`.

```js
const port = process.env.PORT || 3000;
server.listen(port, "0.0.0.0", () => console.log(`Ready on ${port}`));
```

### 5) Environment variables

Replit Publishing uses environment variables for secrets. Do not bake secrets
into code. Provide safe defaults only for non-secret values.

```js
if (!process.env.DATABASE_URL) {
  throw new Error("Missing DATABASE_URL");
}
```

### 6) Prisma / DB notes (if applicable)

Publishing builds in a clean environment. Safe script patterns:

```json
{
  "scripts": {
    "postinstall": "prisma generate",
    "build": "prisma generate && next build",
    "start": "next start -p $PORT -H 0.0.0.0"
  }
}
```

If migrations are needed, prefer running them manually or in a controlled step.
Avoid auto-migrating in production unless you intend it.

### 7) The “baseline-browser-mapping is old” warning

Usually harmless and does not block deploys. Optional update:

```bash
npm i baseline-browser-mapping@latest -D
```

### 8) Debug checklist when Publishing fails

Check logs for:

- `EADDRNOTAVAIL` → wrong port/bind.
- `EADDRINUSE` → port conflict (usually still hardcoding).
- `Cannot find module` → missing dependency / wrong start command.
- `Prisma Client not generated` → missing `prisma generate`.

Quick fixes:

1. Confirm the server listens on `process.env.PORT` and host `0.0.0.0`.
2. Confirm `start` runs the correct entry point.
3. Confirm build output exists (Next build ran).

### 9) Minimal “known good” templates

**Express minimal**

```js
import express from "express";
const app = express();

app.get("/", (req, res) => res.send("ok"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => console.log(`Listening on ${PORT}`));
```

**Next start minimal (no custom server)**

```json
{
  "scripts": {
    "build": "next build",
    "start": "next start -p $PORT -H 0.0.0.0"
  }
}
```

### 10) Non-negotiables (sticky notes)

- No hardcoded ports.
- Always use `process.env.PORT`.
- Bind `0.0.0.0`.
- Simple start command.
- Secrets via env vars.

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
