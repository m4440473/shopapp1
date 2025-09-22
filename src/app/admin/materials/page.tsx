import NavTabs from '@/components/Admin/NavTabs';
import { ToastProvider } from '@/components/ui/Toast';
import Client from './client';

export const dynamic = 'force-dynamic';

async function fetchInitial() {
  const res = await fetch('/api/admin/materials?take=20', { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to load');
  return res.json();
}

export default async function Page() {
  const initial = await fetchInitial();
  return (
    <div className="p-4 text-neutral-100">
      <NavTabs />
      <h1 className="text-xl font-semibold mb-3">Materials</h1>
      <ToastProvider>
        <Client initial={initial} />
      </ToastProvider>
    </div>
  );
}
