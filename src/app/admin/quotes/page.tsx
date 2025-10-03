import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';

import NavTabs from '@/components/Admin/NavTabs';
import { ToastProvider } from '@/components/ui/Toast';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { canAccessAdmin, canViewQuotes } from '@/lib/rbac';
import Client from './client';
import { mergeQuoteMetadata, parseQuoteMetadata } from '@/lib/quote-metadata';
import { sanitizeQuoteSummaryPricing } from '@/lib/quote-visibility';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect('/');
  }

  const user = session.user as any;
  const role = user?.role ?? null;
  if (!canViewQuotes(user ?? role)) {
    redirect('/');
  }

  const isAdmin = canAccessAdmin(user ?? role);

  const rawItems = await prisma.quote.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: {
      customer: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });

  const items = rawItems.map((item) => {
    const enriched = {
      ...item,
      metadata: mergeQuoteMetadata(parseQuoteMetadata(item.metadata)),
    };
    return sanitizeQuoteSummaryPricing(enriched, isAdmin);
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
        <Client initial={initial} initialRole={role} initialAdmin={isAdmin} />
      </ToastProvider>
    </div>
  );
}
