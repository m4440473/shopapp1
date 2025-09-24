import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatDistanceToNow, format } from 'date-fns';
import {
  BadgeCheck,
  BarChart3,
  ClipboardList,
  Clock3,
  FolderOpen,
  History,
  LineChart,
} from 'lucide-react';

import { prisma } from '@/lib/prisma';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/Button';

const TRACKED_STATUS_SET = new Set(['PROGRAMMING', 'RUNNING', 'READY_FOR_ADDONS']);

function formatDuration(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return 'Not enough data';
  const minutes = ms / 60000;
  if (minutes < 1) return 'Less than a minute';
  if (minutes < 60) return `${minutes.toFixed(1)} minutes`;
  const hours = minutes / 60;
  if (hours < 24) return `${hours.toFixed(1)} hours`;
  const days = hours / 24;
  if (days < 30) return `${days.toFixed(1)} days`;
  const months = days / 30;
  if (months < 12) return `${months.toFixed(1)} months`;
  const years = months / 12;
  return `${years.toFixed(1)} years`;
}

function formatDate(date: Date | string | null, fallback = '—') {
  if (!date) return fallback;
  try {
    return format(date instanceof Date ? date : new Date(date), 'PPP');
  } catch {
    return fallback;
  }
}

function formatDueBadge(date: Date | string | null) {
  if (!date) return null;
  const dueDate = date instanceof Date ? date : new Date(date);
  const now = new Date();
  if (Number.isNaN(dueDate.getTime())) return null;
  if (dueDate < now) {
    return <Badge className="bg-red-500/20 text-red-200">Overdue</Badge>;
  }
  const diff = dueDate.getTime() - now.getTime();
  if (diff < 72 * 60 * 60 * 1000) {
    return <Badge className="bg-amber-500/20 text-amber-200">Due soon</Badge>;
  }
  return null;
}

function formatRelative(date: Date | string | null) {
  if (!date) return 'No activity yet';
  try {
    return formatDistanceToNow(date instanceof Date ? date : new Date(date), { addSuffix: true });
  } catch {
    return 'No activity yet';
  }
}

export const dynamic = 'force-dynamic';

export default async function MachinistProfilePage({ params }: { params: { id: string } }) {
  const machinist = await prisma.user.findUnique({
    where: { id: params.id },
    include: {
      orders: {
        include: {
          customer: { select: { name: true } },
        },
        orderBy: [{ dueDate: 'asc' }],
      },
      statusHistories: {
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              status: true,
              customer: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!machinist) {
    notFound();
  }

  const openOrders = machinist.orders.filter((order) => order.status !== 'CLOSED');
  const closedOrders = machinist.orders.length - openOrders.length;

  const ordersWorkedOn = new Set<string>();
  machinist.orders.forEach((order) => ordersWorkedOn.add(order.id));
  machinist.statusHistories.forEach((entry) => {
    if (entry.orderId) ordersWorkedOn.add(entry.orderId);
  });

  const trackedStatusHistories = machinist.statusHistories.filter((entry) => {
    const nextStatus = entry.to ? String(entry.to).toUpperCase() : '';
    return TRACKED_STATUS_SET.has(nextStatus);
  });

  const trackedUpdateCount = trackedStatusHistories.length;
  let averageUpdateMs = 0;
  if (trackedUpdateCount > 1) {
    for (let i = 1; i < trackedStatusHistories.length; i += 1) {
      const prev = trackedStatusHistories[i - 1];
      const curr = trackedStatusHistories[i];
      averageUpdateMs += curr.createdAt.getTime() - prev.createdAt.getTime();
    }
    averageUpdateMs /= trackedUpdateCount - 1;
  }

  const averageUpdateText = trackedUpdateCount > 1 ? formatDuration(averageUpdateMs) : 'Not enough data';
  const lastUpdate = trackedStatusHistories.at(-1)?.createdAt ?? null;

  const statusBreakdown: Record<string, number> = {};
  machinist.orders.forEach((order) => {
    const status = order.status || 'UNKNOWN';
    statusBreakdown[status] = (statusBreakdown[status] ?? 0) + 1;
  });

  const statusEntries = Object.entries(statusBreakdown).sort((a, b) => b[1] - a[1]);

  const recentUpdates = machinist.statusHistories.slice(-6).reverse();

  const lastTouchedByOrder = new Map<string, Date>();
  machinist.statusHistories.forEach((entry) => {
    if (!entry.orderId) return;
    const current = lastTouchedByOrder.get(entry.orderId);
    if (!current || entry.createdAt > current) {
      lastTouchedByOrder.set(entry.orderId, entry.createdAt);
    }
  });

  const recentOrderHistory = [...machinist.orders]
    .sort((a, b) => new Date(b.receivedDate).getTime() - new Date(a.receivedDate).getTime())
    .slice(0, 8);

  const openOrdersSorted = [...openOrders].sort((a, b) => {
    const aTime = new Date(a.dueDate).getTime();
    const bTime = new Date(b.dueDate).getTime();
    return aTime - bTime;
  });

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.35em] text-primary/70">Machinist profile</p>
          <h1 className="text-4xl font-semibold text-foreground">{machinist.name ?? machinist.email}</h1>
          <p className="text-sm text-muted-foreground">
            Performance insights and live workload pulled from the order queue. Track how this machinist moves parts
            across the floor.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <Badge variant={machinist.active ? 'default' : 'outline'} className={cn('uppercase tracking-[0.3em]', machinist.active ? 'bg-emerald-500/20 text-emerald-200' : 'border-border/50 text-muted-foreground')}>
            {machinist.active ? 'Active' : 'Inactive'}
          </Badge>
          <span className="text-muted-foreground/70">Joined {formatDate(machinist.createdAt)}</span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-border/60 bg-card/70">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Orders in progress</CardTitle>
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-foreground">{openOrders.length}</div>
            <p className="text-xs text-muted-foreground">Assigned orders that are still moving through production.</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/70">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Orders completed</CardTitle>
            <BadgeCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-foreground">{closedOrders}</div>
            <p className="text-xs text-muted-foreground">Orders this machinist has seen through to closing.</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/70">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average status cadence</CardTitle>
            <Clock3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-foreground">{averageUpdateText}</div>
            <p className="text-xs text-muted-foreground">Average time between logged status updates.</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/70">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Orders touched</CardTitle>
            <LineChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-foreground">{ordersWorkedOn.size}</div>
            <p className="text-xs text-muted-foreground">
              Unique orders this machinist has either been assigned to or updated.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-border/60 bg-card/70 lg:col-span-2">
          <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Current open orders</CardTitle>
              <CardDescription>Live queue of assigned work with due dates and statuses.</CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href={`/orders?assignedMachinistId=${params.id}`}>
                View in orders queue
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead className="text-right">Alerts</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {openOrdersSorted.map((order) => (
                    <TableRow key={order.id} className="bg-card/60">
                      <TableCell>
                        <Link
                          href={`/orders/${order.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {order.orderNumber || 'Order #' + order.id.slice(0, 6)}
                        </Link>
                      </TableCell>
                      <TableCell>{order.customer?.name ?? '—'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-border/60">
                          {order.status ?? 'UNKNOWN'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-primary/10 text-primary">{order.priority}</Badge>
                      </TableCell>
                      <TableCell>{formatDate(order.dueDate)}</TableCell>
                      <TableCell className="text-right">{formatDueBadge(order.dueDate)}</TableCell>
                    </TableRow>
                  ))}
                  {openOrdersSorted.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                        No open orders assigned.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/70">
          <CardHeader>
            <CardTitle>Status distribution</CardTitle>
            <CardDescription>Snapshot of where assigned orders sit in the workflow.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {statusEntries.map(([status, count]) => (
              <div key={status} className="flex items-center justify-between gap-4 rounded-lg border border-border/50 bg-muted/5 px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{status}</p>
                  <p className="text-xs text-muted-foreground">{count} order{count === 1 ? '' : 's'}</p>
                </div>
                <span className="text-lg font-semibold text-primary">{count}</span>
              </div>
            ))}
            {statusEntries.length === 0 && (
              <p className="text-sm text-muted-foreground">No assigned orders to report.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-border/60 bg-card/70">
          <CardHeader>
            <CardTitle>Recent status updates</CardTitle>
            <CardDescription>Latest moves this machinist recorded across the floor.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentUpdates.map((entry) => (
              <div key={entry.id} className="rounded-lg border border-border/50 bg-muted/5 p-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">
                      {entry.order?.orderNumber ?? `Order ${entry.orderId?.slice(0, 6)}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {entry.order?.customer?.name ? `${entry.order.customer.name} • ` : ''}
                      {entry.from || '—'} → {entry.to || '—'}
                    </p>
                  </div>
                  <History className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{formatRelative(entry.createdAt)}</p>
              </div>
            ))}
            {recentUpdates.length === 0 && (
              <p className="text-sm text-muted-foreground">No status updates logged yet.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/70 lg:col-span-2">
          <CardHeader>
            <CardTitle>Order history</CardTitle>
            <CardDescription>Snapshot of the most recent orders this machinist has touched.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Received</TableHead>
                    <TableHead>Closed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentOrderHistory.map((order) => (
                    <TableRow key={order.id} className="bg-card/60">
                      <TableCell>
                        <Link href={`/orders/${order.id}`} className="font-medium text-primary hover:underline">
                          {order.orderNumber || 'Order #' + order.id.slice(0, 6)}
                        </Link>
                      </TableCell>
                      <TableCell>{order.customer?.name ?? '—'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-border/60">
                          {order.status ?? 'UNKNOWN'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-primary/10 text-primary">{order.priority}</Badge>
                      </TableCell>
                      <TableCell>{formatDate(order.receivedDate)}</TableCell>
                      <TableCell>{formatDate(lastTouchedByOrder.get(order.id) ?? null)}</TableCell>
                    </TableRow>
                  ))}
                  {recentOrderHistory.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                        No order history recorded yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-border/60 bg-card/70">
          <CardHeader>
            <CardTitle>Update velocity</CardTitle>
            <CardDescription>How frequently this machinist records changes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/5 px-3 py-2">
              <Clock3 className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-semibold text-foreground">Average cadence</p>
                <p className="text-xs text-muted-foreground">{averageUpdateText}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/5 px-3 py-2">
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-semibold text-foreground">Updates logged</p>
                <p className="text-xs text-muted-foreground">{trackedUpdateCount} total entries</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/5 px-3 py-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-semibold text-foreground">Last activity</p>
                <p className="text-xs text-muted-foreground">{formatRelative(lastUpdate)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/70 lg:col-span-2">
          <CardHeader>
            <CardTitle>Notes</CardTitle>
            <CardDescription>Use this space to capture performance notes and coaching follow-ups.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-dashed border-border/60 bg-muted/5 p-6 text-sm text-muted-foreground">
              No notes recorded yet.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
