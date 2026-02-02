import type { Session } from 'next-auth';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isTestMode } from '@/lib/testMode';

export const TEST_MODE_USER = {
  id: 'test-user',
  role: 'ADMIN',
  admin: true,
  email: 'test@local',
  name: 'Test Admin',
};

export async function getServerAuthSession(): Promise<Session | null> {
  if (isTestMode()) {
    return { user: TEST_MODE_USER } as Session;
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
