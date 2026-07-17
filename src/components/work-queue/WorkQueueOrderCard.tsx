import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/Card';
import type { DepartmentFeedOrder } from '@/modules/orders/orders.types';

function formatDuration(seconds: number) {
  const clamped = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const secs = clamped % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
}

export function WorkQueueOrderCard({
  order,
  selectedDepartmentName,
}: {
  order: DepartmentFeedOrder;
  selectedDepartmentName: string;
}) {
  const latestActivityLabel = order.latestActivityAt ? new Date(order.latestActivityAt).toLocaleString() : 'No recent activity';

  return (
    <Card className="h-full border-border/60 bg-card/70 p-4 transition hover:border-primary/60 hover:shadow-lg hover:shadow-primary/10">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <Link href={`/orders/${order.orderId}`} className="text-xl font-bold text-primary hover:underline">
            #{order.orderNumber}
          </Link>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
              {selectedDepartmentName}
            </Badge>
            {order.flaggedCount > 0 ? (
              <Badge className="bg-amber-500/20 text-amber-300" title="Order has rework flagged parts">
                REWORK
              </Badge>
            ) : null}
          </div>
        </div>

        <div className="text-sm text-muted-foreground">
          <div>{order.customerName ?? 'Unknown customer'}</div>
          <div>Due {order.dueDate ? new Date(order.dueDate).toLocaleDateString() : 'TBD'}</div>
          <div>{order.assignedMachinistName ?? 'Unassigned'}</div>
        </div>

        {order.activeTimers.length ? (
          <div className="flex flex-wrap gap-2">
            {order.activeTimers.map((timer) => (
              <Link
                key={timer.id}
                href={timer.partId ? `/orders/${order.orderId}?part=${encodeURIComponent(timer.partId)}` : `/orders/${order.orderId}`}
                className="inline-flex min-h-10 items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-100 transition hover:border-emerald-400 hover:bg-emerald-500/20"
                title={
                  timer.partNumber
                    ? `${timer.userName} on ${timer.partNumber}${timer.departmentName ? ` in ${timer.departmentName}` : ''}`
                    : `${timer.userName}${timer.departmentName ? ` in ${timer.departmentName}` : ''}`
                }
              >
                {timer.userName}, {formatDuration(timer.elapsedSeconds)}
              </Link>
            ))}
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg border border-border/50 bg-muted/10 px-3 py-2">Parts here: {order.partsInDeptCount}</div>
          <div className="rounded-lg border border-border/50 bg-muted/10 px-3 py-2">Open checklist: {order.openChecklistCount}</div>
          <div className="rounded-lg border border-border/50 bg-muted/10 px-3 py-2">Flagged parts: {order.flaggedCount}</div>
          <div className="rounded-lg border border-border/50 bg-muted/10 px-3 py-2">Last activity: {latestActivityLabel}</div>
        </div>

        <div className="space-y-2 text-sm text-muted-foreground">
          {order.parts.map((part) => (
            <Link
              key={part.id}
              href={`/orders/${order.orderId}?part=${encodeURIComponent(part.id)}`}
              className="flex min-h-12 items-center justify-between gap-3 rounded-md border border-border/50 bg-background/60 px-3 py-2 transition hover:border-primary/60 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              title={part.reasonText ?? undefined}
            >
              <span className="min-w-0">
                <span className="block truncate font-semibold text-foreground">
                  {part.partNumber ?? `#${part.id.slice(0, 6)}`}{part.partName ? ` · ${part.partName}` : ''}
                </span>
                <span className="block text-xs">Qty {part.quantity ?? 0} · {part.currentDepartmentName ?? selectedDepartmentName}</span>
                <span className="mt-1 block text-xs font-medium text-primary">
                  {part.assignedWorkers.length
                    ? `Assigned: ${part.assignedWorkers.map((worker) => worker.name).join(', ')}`
                    : 'Assigned: nobody yet'}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {part.checklistDoneCount}/{part.checklistTotalCount}
                {part.flagged ? <Badge className="bg-amber-500/20 text-amber-300">REWORK</Badge> : null}
              </span>
            </Link>
          ))}
        </div>

        <div className="pt-1">
          <Link
            href={`/orders/${order.orderId}`}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Open order #{order.orderNumber}
          </Link>
        </div>
      </div>
    </Card>
  );
}
