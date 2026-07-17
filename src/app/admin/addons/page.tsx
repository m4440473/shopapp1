import { redirect } from 'next/navigation';
import { getServerAuthSession } from '@/lib/auth-session';

import NavTabs from '@/components/Admin/NavTabs';
import { ToastProvider } from '@/components/ui/Toast';
import { prisma } from '@/lib/prisma';
import { canAccessAdmin } from '@/lib/rbac';
import Client from './client';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const session = await getServerAuthSession();
  if (!session || !canAccessAdmin(session.user as any)) {
    redirect('/');
  }

  const items = await prisma.addon.findMany({
    orderBy: { name: 'asc' },
    take: 50,
    include: { department: true },
  });
  const initial = { items, nextCursor: null };

  return (
    <div className="p-4 text-neutral-100">
      <NavTabs />
      <h1 className="mb-3 text-xl font-semibold">Work Steps</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Set up the tasks used to estimate a quote and guide work in the shop. Pricing remains visible only to admins.
      </p>
      <ToastProvider>
        <Client initial={initial} />
      </ToastProvider>
    </div>
  );
}
