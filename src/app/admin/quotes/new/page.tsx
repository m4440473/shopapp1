import { redirect } from 'next/navigation';
import { getServerAuthSession } from '@/lib/auth-session';

import { ToastProvider } from '@/components/ui/Toast';
import { canAccessAdmin } from '@/lib/rbac';
import QuoteEditor from '../QuoteEditor';

export const dynamic = 'force-dynamic';

export default async function NewQuotePage() {
  const session = await getServerAuthSession();
  if (!session || !canAccessAdmin(session.user as any)) {
    redirect('/');
  }

  return (
    <div className="p-4 text-neutral-100 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Create quote</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Build a quote that can be printed or emailed to the customer. Pricing details stay private to admins.
        </p>
      </div>
      <ToastProvider>
        <QuoteEditor mode="create" />
      </ToastProvider>
    </div>
  );
}
