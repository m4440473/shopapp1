# ShopApp1

ShopApp1 is a Next.js + Prisma shop operations app (orders, parts, checklist, quotes, and time tracking).

## Prerequisites

- Node.js 18+ (Node 20 LTS recommended)
- npm (project uses `package-lock.json`)

## Local install + first run

1. Install dependencies:

   ```bash
   npm ci
   ```

2. Create your env file:

   ```bash
   cp .env.example .env
   ```

3. Generate Prisma client and apply local migrations:

   ```bash
   npm run prisma:generate
   npm run prisma:migrate -- --name init
   ```

4. Seed demo data:

   ```bash
   npm run seed
   ```

5. (Optional, recommended) Set demo passwords so seeded users can sign in:

   ```bash
   npm run set-demo-passwords
   ```

   Or run both in one command:

   ```bash
   npm run demo:setup
   ```

6. Start the app:

   ```bash
   npm run dev
   ```

## Demo users

After `npm run set-demo-passwords`:

- `admin@example.com`
- `mach1@example.com`
- `mach2@example.com`
- `viewer@example.com`

(Passwords are set by `scripts/set-demo-passwords.js`.)

## Troubleshooting

### Timer start fails with a foreign key error

This usually means your auth session references a stale user id (commonly after resetting/reseeding a database).

- Sign out, then sign back in.
- Retry starting the timer.

### Seed script appears to fail

Use this sequence from the repo root:

```bash
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run seed
```

If login fails after seeding, run:

```bash
npm run set-demo-passwords
```

## Attachment storage

- Attachments default to `storage/` in project root.
- Override with `ATTACHMENTS_DIR`.
- Recreate the storage directory scaffold manually with:

  ```bash
  node scripts/init-storage.cjs
  ```
