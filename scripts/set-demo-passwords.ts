/**
 * One-time script to set bcrypt password hashes for demo users.
 * Usage:
 *   pnpm ts-node scripts/set-demo-passwords.ts
 */
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

type DemoUser = {
  email: string;
  password: string;
  role: 'ADMIN' | 'MACHINIST' | 'VIEWER';
  name: string;
};

async function main() {
  const users: DemoUser[] = [
    { email: 'admin@example.com', password: 'admin123', role: 'ADMIN', name: 'Admin' },
    { email: 'mach1@example.com', password: 'mach123', role: 'MACHINIST', name: 'Machinist One' },
    { email: 'mach2@example.com', password: 'mach123', role: 'MACHINIST', name: 'Machinist Two' },
    { email: 'viewer@example.com', password: 'viewer123', role: 'VIEWER', name: 'Viewer' },
  ];

  for (const user of users) {
    const passwordHash = await hash(user.password, 10);
    await prisma.user
      .upsert({
        where: { email: user.email },
        update: { passwordHash, role: user.role, active: true },
        create: {
          email: user.email,
          name: user.name,
          passwordHash,
          role: user.role,
          active: true,
        },
      })
      .then(() => {
        console.log(`Password hash synced for ${user.email}`);
      });
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
