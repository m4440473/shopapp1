import { redirect } from 'next/navigation';
import { getServerAuthSession } from '@/lib/auth-session';
import { buildSignInRedirectPath } from '@/lib/auth-redirect';

import { listCustomerDashboardCards } from '@/modules/customers/customers.service';
import { CustomerDashboard } from '@/modules/customers/customer-dashboard.ui';
import { Badge } from '@/components/ui/badge';

export default async function CustomersPage() {
  const session = await getServerAuthSession();
  if (!session) {
    redirect(buildSignInRedirectPath('/customers'));
  }

  const customers = await listCustomerDashboardCards();

  return (
    <div className="shop-floor-glass relative space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.4em] text-primary/70">Customers</p>
          <h1 className="text-4xl font-semibold text-foreground">Customer relationships</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Review the partners that keep the spindles turning, see active work, and jump into their order history in a tap.
          </p>
        </div>
        <Badge className="self-start rounded-full bg-primary/10 text-primary lg:self-auto">{customers.length} customers</Badge>
      </div>
      <CustomerDashboard customers={customers} />
    </div>
  );
}
