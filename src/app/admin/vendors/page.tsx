import NavTabs from '@/components/Admin/NavTabs';
import { ToastProvider } from '@/components/ui/Toast';
import Client from './client';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const pageSize = 20;
  const [items, totalCount] = await Promise.all([
    prisma.vendor.findMany({ orderBy: { id: 'asc' }, take: pageSize }),
    prisma.vendor.count(),
  ]);
  const initial = { items, totalCount, page: 1, pageSize };
  return (
    <div className="p-4 text-neutral-100">
      <NavTabs />
      <h1 className="text-xl font-semibold mb-3">Vendors</h1>
      <ToastProvider>
        <Client initial={initial} />
      </ToastProvider>
    </div>
  );
}
