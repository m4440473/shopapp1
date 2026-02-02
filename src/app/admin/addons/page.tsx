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
      <h1 className="text-xl font-semibold mb-3">Add-ons</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Configure hourly or flat-rate services that can be attached to quotes and orders. Rates are only visible to admins.
      </p>
      <ToastProvider>
        <Client initial={initial} />
      </ToastProvider>
    </div>
  );
}
