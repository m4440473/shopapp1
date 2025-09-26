import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';

import NavTabs from '@/components/Admin/NavTabs';
import { ToastProvider } from '@/components/ui/Toast';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { canAccessAdmin } from '@/lib/rbac';
import Client from './client';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const session = await getServerSession(authOptions);
  if (!session || !canAccessAdmin((session.user as any)?.role)) {
    redirect('/');
  }

  const items = await prisma.quote.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: {
      customer: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });

  const initial = { items, nextCursor: null };

  return (
    <div className="p-4 text-neutral-100">
      <NavTabs />
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Quotes</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Draft and send quotes for customers. Totals and cost breakdowns are only visible to administrators.
        </p>
      </div>
      <ToastProvider>
        <Client initial={initial} />
      </ToastProvider>
    </div>
  );
}
