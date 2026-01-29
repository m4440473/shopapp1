# Auth & RBAC Slice

This adds NextAuth (Credentials) with bcrypt password hashing, JWT sessions, RBAC helpers, protected routes, and a demo sign-in page.

## Install

```bash
pnpm add next-auth
pnpm add @prisma/client
pnpm add -D prisma typescript ts-node
pnpm add bcryptjs
cp .env.example .env
```

Generate Prisma client (uses Agent 1 schema):
```bash
pnpm prisma generate
```

Set demo passwords:
```bash
pnpm ts-node scripts/set-demo-passwords.ts
```

Run dev:
```bash
pnpm dev
```

Open http://localhost:3000/auth/signin and sign in with:
- admin@example.com / admin123 (ADMIN)
- mach1@example.com / mach123 (MACHINIST)
- mach2@example.com / mach123 (MACHINIST)
- viewer@example.com / viewer123 (VIEWER)

### Sharing on your local network

If teammates need to hit the app from another machine, update the three base URL
values in `.env` (and `.env.example` if you check that in):

```
APP_BASE_URL="http://<your-machine-ip>:3000"
NEXTAUTH_URL="http://<your-machine-ip>:3000"
NEXT_PUBLIC_BASE_URL="http://<your-machine-ip>:3000"
```

Replace `<your-machine-ip>` with the IP address or hostname other devices use
to reach your computer (for example, `192.168.1.25`). Restart the dev server
after updating the `.env` file so Next.js and NextAuth pick up the new settings.

With these values set, the sign-in redirect and sign-out endpoint will stay on
the shared host instead of jumping back to `localhost`.

## Protected Routes

`/middleware.ts` guards everything except `/api/auth/*` and the signin page.
- Example probe: `GET /api/whoami` returns `{ email, role }` for authenticated users.

## RBAC

See `src/lib/rbac.ts`:
- `canAccessAdmin(role)` — admin-only.
- `canMoveStatusBackward(role)` — admin-only.
- `isMachinist(role)`, `isViewer(role)` — convenience checks.
- `requireRole(role, predicate)` — throws `Response(403)` when denied.

## Notes

- Session strategy is JWT to work nicely with middleware.
- Passwords are hashed with bcrypt (cost 10). The one-time script sets known demo passwords; rotate before prod.
