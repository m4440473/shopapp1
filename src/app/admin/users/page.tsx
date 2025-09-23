import NavTabs from '@/components/Admin/NavTabs';
import { ToastProvider } from '@/components/ui/Toast';
import Client from './client';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function Page() {
  // Load initial data directly on the server using Prisma to avoid SSR fetch issues
  const items = await prisma.user.findMany({ orderBy: { id: 'asc' }, take: 20 });
  const initial = { items, nextCursor: null };
  return (
    <div className="p-4 text-neutral-100">
      <NavTabs />
      <h1 className="text-xl font-semibold mb-3">Users</h1>
      <ToastProvider>
        <Client initial={initial} />
      </ToastProvider>
    </div>
  );
}
