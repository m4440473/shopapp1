import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Plus } from 'lucide-react';
import { getServerAuthSession } from '@/lib/auth-session';
import { buildSignInRedirectPath } from '@/lib/auth-redirect';
import { ShopFloorLayouts } from '@/components/ShopFloorLayouts';
import { Button } from '@/components/ui/Button';
import { getDepartmentsOrdered, getOrderDepartmentFeed, type DepartmentFeedOrder } from '@/modules/orders/orders.service';

export default async function Home() {
  const session = await getServerAuthSession();
  if (!session) redirect(buildSignInRedirectPath('/'));

  const departmentsResult = await getDepartmentsOrdered();
  const departments = departmentsResult.ok ? departmentsResult.data.items : [];
  const initialDepartmentId = departments[0]?.id ?? null;
  const departmentFeedResult = initialDepartmentId ? await getOrderDepartmentFeed(initialDepartmentId, false) : null;
  const departmentFeedItems: DepartmentFeedOrder[] = departmentFeedResult?.ok ? departmentFeedResult.data.items : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Work Queue</h1>
          <p className="text-sm text-muted-foreground">Department-driven queue with orders grouped as work folders.</p>
        </div>
        <Button asChild>
          <Link href="/orders/new"><Plus className="mr-2 h-4 w-4" />New Order</Link>
        </Button>
      </div>

      <ShopFloorLayouts
        departments={departments}
        initialDepartmentId={initialDepartmentId}
        initialDepartmentFeed={departmentFeedItems}
      />
    </div>
  );
}
