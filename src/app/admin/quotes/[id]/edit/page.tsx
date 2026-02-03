import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getServerAuthSession } from '@/lib/auth-session';

import { ToastProvider } from '@/components/ui/Toast';
import { canAccessAdmin } from '@/lib/rbac';
import QuoteEditor from '../../QuoteEditor';

export const dynamic = 'force-dynamic';

export default async function EditQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerAuthSession();
  if (!session || !canAccessAdmin(session.user as any)) {
    redirect('/');
  }

  const { id } = await params;
  const headerStore = await headers();
  const host = headerStore.get('x-forwarded-host') ?? headerStore.get('host');
  const protocol = headerStore.get('x-forwarded-proto') ?? 'https';
  const baseUrl = host ? `${protocol}://${host}` : '';
  const cookie = headerStore.get('cookie') ?? '';

  const response = await fetch(`${baseUrl}/api/admin/quotes/${id}`, {
    headers: { cookie },
    cache: 'no-store',
  });
  if (!response.ok) {
    redirect('/admin/quotes');
  }
  const payload = await response.json();
  const quote = payload?.item ?? null;

  if (!quote) {
    redirect('/admin/quotes');
  }

  return (
    <div className="p-4 text-neutral-100 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Edit quote {quote.quoteNumber}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Update pricing, purchased items, or labor before sharing with the customer.
        </p>
      </div>
      <ToastProvider>
        <QuoteEditor mode="edit" initialQuote={quote as any} />
      </ToastProvider>
    </div>
  );
}
