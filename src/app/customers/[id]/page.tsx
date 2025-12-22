import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { format } from 'date-fns';
import { getServerSession } from 'next-auth';
import { Printer, UserCircle, Phone, Mail, MapPin, Activity, Package2 } from 'lucide-react';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { EditCustomerDialog } from '@/components/EditCustomerDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const STATUS_STYLES: Record<string, string> = {
  RECEIVED: 'border-primary/40 bg-primary/10 text-primary',
  PROGRAMMING: 'border-blue-400/40 bg-blue-400/15 text-blue-200',
  SETUP: 'border-sky-400/40 bg-sky-400/15 text-sky-200',
  RUNNING: 'border-emerald-400/40 bg-emerald-400/15 text-emerald-200',
  FINISHING: 'border-amber-400/40 bg-amber-400/15 text-amber-100',
  DONE_MACHINING: 'border-violet-400/40 bg-violet-400/15 text-violet-200',
  INSPECTION: 'border-lime-300/60 bg-lime-300/20 text-lime-100',
  SHIPPING: 'border-cyan-400/40 bg-cyan-400/15 text-cyan-100',
  CLOSED: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200',
};

function formatDate(input?: Date | string | null) {
  if (!input) return '—';
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return '—';
  return format(date, 'PP');
}

type CustomerPageProps = {
  params: { id: string };
};

export default async function CustomerDetailPage({ params }: CustomerPageProps) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect(`/auth/signin?callbackUrl=/customers/${params.id}`);
  }

  const customer = await prisma.customer.findUnique({
    where: { id: params.id },
    include: {
      orders: {
        include: {
          assignedMachinist: { select: { id: true, name: true, email: true } },
          parts: { select: { quantity: true } },
        },
        orderBy: [{ receivedDate: 'desc' }],
      },
    },
  });

  if (!customer) {
    notFound();
  }

  const activeOrders = customer.orders.filter((order) => order.status !== 'CLOSED');
  const totalParts = customer.orders.reduce((acc, order) => {
    const orderParts = order.parts?.reduce((sum, part) => sum + (part.quantity ?? 0), 0) ?? 0;
    return acc + orderParts;
  }, 0);
  const lastOrder = customer.orders[0] ?? null;
  const lastOrderDate = lastOrder?.receivedDate ? formatDate(lastOrder.receivedDate) : 'No orders yet';

  const summary = {
    totalOrders: customer.orders.length,
    activeOrders: activeOrders.length,
    closedOrders: customer.orders.filter((order) => order.status === 'CLOSED').length,
    totalParts,
    lastOrderDate,
  };

  const customerForForm = {
    id: customer.id,
    name: customer.name,
    contact: customer.contact,
    phone: customer.phone,
    email: customer.email,
    address: customer.address,
  };

  const orders = customer.orders.map((order) => ({
    ...order,
    partsCount: order.parts?.reduce((sum, part) => sum + (part.quantity ?? 0), 0) ?? 0,
  }));

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.4em] text-primary/70">Customer</p>
          <h1 className="text-4xl font-semibold text-foreground">{customer.name}</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {summary.activeOrders > 0
              ? `${summary.activeOrders} active ${summary.activeOrders === 1 ? 'order' : 'orders'} on the floor.`
              : 'No work currently in the queue for this customer.'}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <EditCustomerDialog customer={customerForForm} />
          <Button
            asChild
            className="rounded-full bg-primary text-primary-foreground shadow-md shadow-primary/30 hover:bg-primary"
          >
            <Link href={`/customers/${customer.id}/print`} target="_blank" rel="noreferrer">
              <Printer className="mr-2 h-4 w-4" /> Print summary
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <UserCircle className="h-4 w-4 text-muted-foreground" /> Contact details
              </CardTitle>
              <CardDescription>Keep sales and shipping aligned.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Primary contact</p>
                <p className="text-base text-foreground">{customer.contact ?? 'Not provided'}</p>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{customer.phone ?? 'No phone on file'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{customer.email ?? 'No email on file'}</span>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <span className="whitespace-pre-line">{customer.address ?? 'No address recorded'}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4 text-muted-foreground" /> Work summary
              </CardTitle>
              <CardDescription>Production volume at a glance.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/10 px-3 py-2">
                <span>Total orders</span>
                <span className="font-semibold text-foreground">{summary.totalOrders}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/10 px-3 py-2">
                <span>Active orders</span>
                <span className="font-semibold text-foreground">{summary.activeOrders}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/10 px-3 py-2">
                <span>Completed orders</span>
                <span className="font-semibold text-foreground">{summary.closedOrders}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/10 px-3 py-2">
                <span>Total parts delivered</span>
                <span className="font-semibold text-foreground">{summary.totalParts}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/10 px-3 py-2">
                <span>Last received order</span>
                <span className="font-semibold text-foreground">{summary.lastOrderDate}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border/60 bg-card/80 backdrop-blur">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Package2 className="h-5 w-5 text-muted-foreground" /> Order history
            </CardTitle>
            <CardDescription>Every order we&apos;ve produced for {customer.name}.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {orders.length ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/60">
                      <TableHead className="w-[140px]">Order</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Received</TableHead>
                      <TableHead>Due</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Machinist</TableHead>
                      <TableHead>Parts</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => (
                      <TableRow key={order.id} className="border-border/60">
                        <TableCell className="font-semibold text-primary">
                          <Link href={`/orders/${order.id}`} className="hover:underline">
                            #{order.orderNumber}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`rounded-full px-3 py-1 text-[0.7rem] uppercase tracking-wide ${
                              STATUS_STYLES[order.status] ?? 'border-border/60 bg-secondary/40 text-foreground'
                            }`}
                          >
                            {order.status.replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatDate(order.receivedDate)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatDate(order.dueDate)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{order.priority}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {order.assignedMachinist?.name ?? order.assignedMachinist?.email ?? 'Unassigned'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{order.partsCount}</TableCell>
                        <TableCell className="text-right text-sm">
                          <Link href={`/orders/${order.id}`} className="text-primary hover:underline">
                            View order
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="px-6 py-12 text-center text-sm text-muted-foreground">
                No orders recorded for this customer yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
