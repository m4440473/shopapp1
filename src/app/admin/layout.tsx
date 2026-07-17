import { redirect } from 'next/navigation';

import { getServerAuthSession } from '@/lib/auth-session';
import { canAccessAdmin } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerAuthSession();

  if (!session) {
    redirect('/auth/signin');
  }

  const userAccess = session.user as typeof session.user & { role?: string; admin?: boolean };
  if (!canAccessAdmin(userAccess)) {
    redirect('/403');
  }

  return children;
}
