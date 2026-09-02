import { redirect } from 'next/navigation';
import { getServerAuthSession } from '@/lib/auth-session';
import { buildSignInRedirectPath } from '@/lib/auth-redirect';

import { ShopFloorLayouts } from '@/components/ShopFloorLayouts';
import {
  decorateOrder,
  getDepartmentsOrdered,
  getHomeDashboardData,
  getOrderDepartmentFeed,
  type DepartmentFeedOrder,
} from '@/modules/orders/orders.service';
import { getRunningWorkerSummary } from '@/modules/time/time.service';
import { canAccessAdmin } from '@/lib/rbac';
import { getShopFloorDisplayOptions, getShopFloorSummary } from '@/modules/shop-floor/shop-floor.service';

export default async function Home() {
  const session = await getServerAuthSession();
  if (!session) {
    redirect(buildSignInRedirectPath('/'));
  }

  const now = new Date();
  const soon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const dashboardResult = await getHomeDashboardData();
  if (dashboardResult.ok === false) {
    throw new Error(String(dashboardResult.error));
  }

  const { totalOrders, activeOrders } = dashboardResult.data;
  const runningWorkersResult = await getRunningWorkerSummary();
  const runningWorkers = runningWorkersResult.ok ? runningWorkersResult.data.items : [];
  const displayOptions = await getShopFloorDisplayOptions();
  const shopFloorSummary = await getShopFloorSummary();
  const departmentsResult = await getDepartmentsOrdered();
  const departments = departmentsResult.ok ? departmentsResult.data.items : [];
  const initialDepartmentId = departments[0]?.id ?? null;
  const departmentFeedResult = initialDepartmentId ? await getOrderDepartmentFeed(initialDepartmentId) : null;
  const departmentFeedItems: DepartmentFeedOrder[] = departmentFeedResult?.ok ? departmentFeedResult.data.items : [];

  const dueSoon = activeOrders.filter((order) => {
    const due = new Date(order.dueDate).getTime();
    return due >= now.getTime() && due <= soon.getTime();
  }).length;
  const decoratedActiveOrders = activeOrders.map((order) => decorateOrder(order as any));
  const unassigned = decoratedActiveOrders.filter(
    (order) => !order.assignedMachinist?.id && !order.assignedWorkers.length,
  ).length;

  const machinistWorkload = decoratedActiveOrders.reduce((acc, order) => {
    const assignees = order.assignedMachinist?.id
      ? [{
          id: String(order.assignedMachinist.id),
          name: order.assignedMachinist.name ?? order.assignedMachinist.email ?? 'Unnamed worker',
        }]
      : order.assignedWorkers;
    assignees.forEach((assignee) => {
      if (!acc[assignee.id]) acc[assignee.id] = { name: assignee.name, count: 0 };
      acc[assignee.id].count += 1;
    });
    return acc;
  }, {} as Record<string, { name: string; count: number }>);

  const workloadList = (Object.values(machinistWorkload) as Array<{ name: string; count: number }>)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const machinistList = activeOrders
    .flatMap((order: any) => [
      ...(order.assignedMachinist ? [order.assignedMachinist] : []),
      ...(order.parts ?? []).flatMap((part: any) => (part.assignments ?? []).map((assignment: any) => assignment.user)),
    ])
    .filter((item: any) => item?.active !== false)
    .reduce((acc: Array<{ id: string | null; name?: string | null; email?: string | null }>, item) => {
      if (!item) return acc;
      if (!acc.find((m) => m.id === (item as any).id)) {
        acc.push({ id: (item as any).id ?? null, name: item.name ?? null, email: (item as any).email ?? null });
      }
      return acc;
    }, []);
  return (
    <div className="shop-floor-glass relative flex flex-col gap-6 px-1 py-2 sm:px-2">
      <ShopFloorLayouts
        orders={decoratedActiveOrders}
        machinists={machinistList}
        departments={departments}
        initialDepartmentId={initialDepartmentId}
        initialDepartmentFeed={departmentFeedItems}
        runningWorkers={runningWorkers}
        initialDisplayOptions={displayOptions}
        initialSummary={shopFloorSummary}
        canEditDisplay={canAccessAdmin(session.user as any)}
        listSummary={{
          activeOrders: activeOrders.length,
          totalOrders,
          dueSoon,
          unassigned,
          machinistWorkload: workloadList,
        }}
      />
    </div>
  );
}
