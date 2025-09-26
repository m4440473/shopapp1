import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';

import { ToastProvider } from '@/components/ui/Toast';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { canAccessAdmin } from '@/lib/rbac';
import QuoteEditor from '../../QuoteEditor';

export const dynamic = 'force-dynamic';

export default async function EditQuotePage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !canAccessAdmin((session.user as any)?.role)) {
    redirect('/');
  }

  const quote = await prisma.quote.findUnique({
    where: { id: params.id },
    include: {
      customer: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      parts: true,
      vendorItems: true,
      addonSelections: {
        include: { addon: { select: { id: true, name: true, rateType: true, rateCents: true } } },
      },
      attachments: true,
    },
  });

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
