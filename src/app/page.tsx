import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Activity, ArrowUpRight, CalendarDays, CircleCheck, Users } from 'lucide-react';
import { getServerAuthSession } from '@/lib/auth-session';

import { RecentOrdersTable } from '@/components/RecentOrdersTable';
import { ShopFloorLayouts } from '@/components/ShopFloorLayouts';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import {
  decorateOrder,
  getDepartmentsOrdered,
  getOrderDepartmentFeed,
  ORDER_STATUS_LABELS,
  type DepartmentFeedOrder,
} from '@/modules/orders/orders.service';
import { getInitials } from '@/lib/get-initials';
import { prisma } from '@/lib/prisma';
import { cn } from '@/lib/utils';

export default async function Home() {
  const session = await getServerAuthSession();
  if (!session) {
    redirect('/auth/signin?callbackUrl=/');
  }

  const now = new Date();
  const soon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [totalOrders, closedOrders, activeOrders, recentOrders] = await Promise.all([
    prisma.order.count(),
    prisma.order.count({ where: { status: 'CLOSED' } }),
    prisma.order.findMany({
      where: { status: { not: 'CLOSED' } },
      include: {
        customer: { select: { name: true } },
        assignedMachinist: { select: { id: true, name: true, email: true } },
        parts: { select: { quantity: true } },
        checklist: { select: { completed: true, addon: { select: { name: true } } } },
        statusHistory: { select: { createdAt: true }, orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: [{ dueDate: 'asc' }, { orderNumber: 'asc' }],
      take: 50,
    }),
    prisma.order.findMany({
      include: {
        customer: { select: { name: true } },
        assignedMachinist: { select: { name: true } },
      },
      orderBy: [{ receivedDate: 'desc' }],
      take: 8,
    }),
  ]);
  const departmentsResult = await getDepartmentsOrdered();
  const departments = departmentsResult.ok ? departmentsResult.data.items : [];
  const initialDepartmentId = departments[0]?.id ?? null;
  const departmentFeedResult = initialDepartmentId ? await getOrderDepartmentFeed(initialDepartmentId) : null;
  const departmentFeedItems: DepartmentFeedOrder[] = departmentFeedResult?.ok ? departmentFeedResult.data.items : [];

  const dueSoon = activeOrders.filter((order) => {
    const due = new Date(order.dueDate).getTime();
    return due >= now.getTime() && due <= soon.getTime();
  }).length;
  const unassigned = activeOrders.filter((order) => !order.assignedMachinistId).length;

  const statusBreakdown = activeOrders.reduce((acc, order) => {
    const key = order.status;
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const machinistWorkload = activeOrders.reduce((acc, order) => {
    const id = order.assignedMachinistId;
    if (!id) return acc;
    if (!acc[id]) {
      acc[id] = { name: order.assignedMachinist?.name ?? 'Unassigned', count: 0 };
    }
    acc[id].count += 1;
    return acc;
  }, {} as Record<string, { name: string; count: number }>);

  const workloadList = (Object.values(machinistWorkload) as Array<{ name: string; count: number }>)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const decoratedActiveOrders = activeOrders.map((order) => decorateOrder(order as any));
  const machinistList = activeOrders
    .map((order) => order.assignedMachinist)
    .filter(Boolean)
    .reduce((acc: Array<{ id: string | null; name?: string | null; email?: string | null }>, item) => {
      if (!item) return acc;
      if (!acc.find((m) => m.id === (item as any).id)) {
        acc.push({ id: (item as any).id ?? null, name: item.name ?? null, email: (item as any).email ?? null });
      }
      return acc;
    }, []);
  machinistList.unshift({ id: null, name: 'Unassigned', email: null });

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.4em] text-primary/70">Overview</p>
          <h1 className="text-4xl font-semibold text-foreground">Shop floor intelligence</h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Track every order, deadline, and machinist assignment in one navy-drenched control center built entirely with shadcn blocks.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button asChild variant="secondary" className="rounded-full border border-primary/40 bg-primary/15 text-primary">
            <Link href="/orders/new">Schedule work</Link>
          </Button>
          <Button asChild className="rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/40">
            <Link href="/orders">View all orders</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active orders</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{activeOrders.length}</div>
            <p className="text-xs text-muted-foreground">{totalOrders} total records in the shop</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Due within 7 days</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{dueSoon}</div>
            <p className="text-xs text-muted-foreground">Stay ahead of the hot jobs</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unassigned tickets</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{unassigned}</div>
            <p className="text-xs text-muted-foreground">Waiting for a machinist</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed jobs</CardTitle>
            <CircleCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{closedOrders}</div>
            <p className="text-xs text-muted-foreground">Orders closed out historically</p>
          </CardContent>
        </Card>
      </div>

      <ShopFloorLayouts
        orders={decoratedActiveOrders}
        machinists={machinistList}
        departments={departments}
        initialDepartmentId={initialDepartmentId}
        initialDepartmentFeed={departmentFeedItems}
      />

      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-row items-center">
            <div className="grid gap-1">
              <CardTitle className="text-lg">Orders overview</CardTitle>
              <CardDescription>Latest order activity pulled straight from the floor.</CardDescription>
            </div>
            <Button asChild size="sm" className="ml-auto gap-1 rounded-full bg-primary/90 text-primary-foreground">
              <Link href="/orders">
                View all
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <RecentOrdersTable orders={recentOrders} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Machinist workload</CardTitle>
            <CardDescription>Top assignments across active jobs.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            {workloadList.length ? (
              workloadList.map((machinist) => (
                <div key={machinist.name} className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border border-primary/40 bg-secondary/40">
                      <AvatarFallback>{getInitials(machinist.name)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium leading-none">{machinist.name}</p>
                      <p className="text-xs text-muted-foreground">{machinist.count} active order(s)</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="rounded-full border border-primary/30 bg-primary/10 text-primary">
                    {Math.round((machinist.count / Math.max(activeOrders.length, 1)) * 100)}%
                  </Badge>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No machinists assigned just yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status pulse</CardTitle>
            <CardDescription>Where every open job sits in the pipeline.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {(Object.entries(statusBreakdown) as Array<[string, number]>)
              .sort((a, b) => b[1] - a[1])
              .map(([status, count]) => {
                const pct = Math.round((count / Math.max(activeOrders.length, 1)) * 100);
                return (
                  <div key={status} className="space-y-2">
                    <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
                      <span>{ORDER_STATUS_LABELS[status] ?? status}</span>
                      <span>{count}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-secondary/50">
                      <div
                        className={cn('h-full rounded-full bg-primary/80 transition-all')}
                        style={{ width: `${pct}%` }}
                        aria-hidden="true"
                      />
                    </div>
                  </div>
                );
              })}
            {!Object.keys(statusBreakdown).length && (
              <p className="text-sm text-muted-foreground">No active orders to visualize right now.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
