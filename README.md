# ShopApp1

ShopApp1 is a Next.js + Prisma shop operations app (orders, parts, checklist, quotes, and time tracking).

## Prerequisites

- Node.js 18+ (Node 20 LTS recommended)
- npm (project uses `package-lock.json`)
- Docker + Docker Compose (optional, only for container install target)

## One-script installers (recommended)

From repo root:

```bash
bash scripts/install.sh --target local --seed basic
```

Installer options:

- `--target local|docker`
- `--seed basic|demo`
- `--start` (local target only; starts `npm run dev` after setup)

Examples:

```bash
# Local machine with minimal functional data
bash scripts/install.sh --target local --seed basic

# Local machine with full demo data
bash scripts/install.sh --target local --seed demo

# Docker install with demo data
bash scripts/install.sh --target docker --seed demo
```

## Seed profiles

- **Basic seed** (`npm run seed:basic`): foundational data only (core users/materials/vendors/departments/add-ons/customer) for functionality and smoke-testing.
- **Demo seed** (`npm run seed:demo`): full pre-populated dataset with multiple orders, quotes, custom fields/templates, and richer workflow content.

For demo accounts to sign in, run:

```bash
npm run set-demo-passwords
```

## Manual local install + first run

1. Install dependencies:

   ```bash
   npm ci
   ```

2. Create your env file:

   ```bash
   cp .env.example .env
   ```

3. Generate Prisma client and apply migrations:

   ```bash
   npm run prisma:generate
   npx prisma migrate deploy
   ```

4. Seed data:

   ```bash
   npm run seed:basic   # or npm run seed:demo
   ```

5. (Optional, recommended for demo data) set demo passwords:

   ```bash
   npm run set-demo-passwords
   ```

6. Start the app:

   ```bash
   npm run dev -- --hostname 0.0.0.0 --port 3000
   ```

## Demo users

After `npm run set-demo-passwords`:

- `admin@example.com`
- `mach1@example.com`
- `mach2@example.com`
- `viewer@example.com`

(Passwords are set by `scripts/set-demo-passwords.js`.)

## Local-network access (LAN)

If you want to open the dev server from another device on your network:

1. Start Next on all interfaces:

   ```bash
   npm run dev -- --hostname 0.0.0.0 --port 3000
   ```

2. Set the base URL env vars in `.env` to the exact LAN origin you will open in the browser, for example:

   ```env
   APP_BASE_URL="http://192.168.1.25:3000"
   NEXTAUTH_URL="http://192.168.1.25:3000"
   NEXT_PUBLIC_BASE_URL="http://192.168.1.25:3000"
   ```

3. Re-start the dev server after changing `.env`.

Note: the app now falls back to the incoming request host when those env vars still point at `localhost`, but setting them to the real LAN IP is still the most reliable option for sign-in and sign-out redirects.

## Troubleshooting

### Timer start fails with a foreign key error

This usually means your auth session references a stale user id (commonly after resetting/reseeding a database).

- Sign out, then sign back in.
- Retry starting the timer.

### Seed script appears to fail

Use this sequence from the repo root:

```bash
npm run prisma:generate
npx prisma migrate deploy
npm run seed:demo
npm run set-demo-passwords
```

## Attachment storage

- Attachments default to `storage/` in project root.
- Override with `ATTACHMENTS_DIR`.
- Recreate the storage directory scaffold manually with:

  ```bash
  node scripts/init-storage.cjs
  ```
