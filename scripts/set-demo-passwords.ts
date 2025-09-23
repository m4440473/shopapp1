/**
 * One-time script to set bcrypt password hashes for demo users.
 * Usage:
 *   pnpm ts-node scripts/set-demo-passwords.ts
 */
import { prisma } from '../src/lib/prisma';
import { hash } from 'bcryptjs';

async function main() {
  const users = [
    { email: 'admin@example.com', password: 'admin123' },
    { email: 'mach1@example.com', password: 'mach123' },
    { email: 'mach2@example.com', password: 'mach123' },
    { email: 'viewer@example.com', password: 'viewer123' },
  ];

  for (const u of users) {
    const passwordHash = await hash(u.password, 10);
    try {
      await prisma.user.update({
        where: { email: u.email },
        data: { passwordHash },
      });
      console.log(`Updated password for ${u.email}`);
    } catch (err) {
      // If update fails (user doesn't exist), create the user
      await prisma.user.create({
        data: {
          email: u.email,
          name: u.email.split('@')[0],
          passwordHash,
          role: 'MACHINIST',
          active: true,
        },
      });
      console.log(`Created user and set password for ${u.email}`);
    }
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
