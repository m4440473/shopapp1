import Link from 'next/link';
import { redirect } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { getServerAuthSession } from '@/lib/auth-session';
import { Users, ClipboardList, Timer, Layers } from 'lucide-react';

import { prisma } from '@/lib/prisma';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';

function formatRelative(date: Date | null) {
  if (!date) return 'No orders yet';
  try {
    return `${formatDistanceToNow(date, { addSuffix: true })}`;
  } catch {
    return date.toLocaleDateString();
  }
}

export default async function CustomersPage() {
  const session = await getServerAuthSession();
  if (!session) {
    redirect('/auth/signin?callbackUrl=/customers');
  }

  const customers = await prisma.customer.findMany({
    orderBy: { name: 'asc' },
    include: {
      orders: {
        include: { parts: { select: { quantity: true } } },
        orderBy: [{ receivedDate: 'desc' }],
      },
    },
  });

  const metrics = customers.map((customer) => {
    const totalOrders = customer.orders.length;
    const activeOrders = customer.orders.filter((order) => order.status !== 'CLOSED').length;
    const totalParts = customer.orders.reduce((acc, order) => {
      const orderParts = order.parts?.reduce((sum, part) => sum + (part.quantity ?? 0), 0) ?? 0;
      return acc + orderParts;
    }, 0);
    const mostRecentOrder = customer.orders[0] ?? null;
    const recentDate = mostRecentOrder?.receivedDate ? new Date(mostRecentOrder.receivedDate) : null;
    return {
      id: customer.id,
      name: customer.name,
      contact: customer.contact ?? '',
      totalOrders,
      activeOrders,
      totalParts,
      recentDate,
    };
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.4em] text-primary/70">Customers</p>
          <h1 className="text-4xl font-semibold text-foreground">Customer relationships</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Review the partners that keep the spindles turning, see active work, and jump into their order history in a tap.
          </p>
        </div>
        <Badge className="rounded-full bg-primary/10 text-primary">{metrics.length} active customers</Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {metrics.map((customer) => (
          <Link key={customer.id} href={`/customers/${customer.id}`} className="group h-full">
            <Card className="h-full border-border/60 bg-card/70 transition hover:border-primary/60 hover:shadow-lg hover:shadow-primary/10">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-lg">
                  <span>{customer.name}</span>
                  {customer.activeOrders > 0 ? (
                    <Badge className="bg-emerald-500/10 text-emerald-200">
                      {customer.activeOrders} active
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">
                      No active orders
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {customer.contact ? `Primary contact: ${customer.contact}` : 'No contact on file'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/10 px-3 py-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">Total orders</p>
                      <p className="text-base font-semibold">{customer.totalOrders}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/10 px-3 py-2">
                    <ClipboardList className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">Active queue</p>
                      <p className="text-base font-semibold">{customer.activeOrders}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/10 px-3 py-2">
                    <Layers className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">Parts shipped</p>
                      <p className="text-base font-semibold">{customer.totalParts}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/10 px-3 py-2">
                    <Timer className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">Last work</p>
                      <p className="text-base font-semibold">{formatRelative(customer.recentDate)}</p>
                    </div>
                  </div>
                </div>
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground transition group-hover:text-primary">
                  View orders ↗
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
        {!metrics.length && (
          <Card className="col-span-full border-dashed border-border/60 bg-muted/5">
            <CardHeader>
              <CardTitle>No customers yet</CardTitle>
              <CardDescription>
                Add a customer while creating a new order and they will appear here with workload stats.
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>
    </div>
  );
}
