import type { Session } from 'next-auth';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isTestMode } from '@/lib/testMode';

const TEST_MODE_EMAIL = 'test@local';

async function resolveTestModeUser() {
  return prisma.user.upsert({
    where: { email: TEST_MODE_EMAIL },
    update: {
      name: 'Test Admin',
      role: 'ADMIN',
      active: true,
    },
    create: {
      email: TEST_MODE_EMAIL,
      name: 'Test Admin',
      role: 'ADMIN',
      active: true,
    },
  });
}

export async function getServerAuthSession(): Promise<Session | null> {
  if (isTestMode()) {
    const user = await resolveTestModeUser();
    return {
      user: {
        id: user.id,
        role: 'ADMIN',
        admin: true,
        email: user.email,
        name: user.name ?? 'Test Admin',
      },
      expires: new Date(Date.now() + 3600 * 1000).toISOString(),
    } as Session;
  }
  return getServerSession(authOptions);
}

export async function requireServerAuthSession(): Promise<Session> {
  const session = await getServerAuthSession();
  if (!session) {
    throw new Error('Unauthorized');
  }
  return session;
}
