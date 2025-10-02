"use client";

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getInitials } from '@/lib/get-initials';
import { ORDER_STATUS_LABELS } from '@/lib/order-status-labels';

type SortOption = 'dueDate' | 'receivedDate';

type RecentOrder = {
  id: string;
  orderNumber: string;
  dueDate: string | Date | null;
  receivedDate: string | Date | null;
  status: string;
  customer?: { name?: string | null } | null;
  assignedMachinist?: { name?: string | null } | null;
};

const SORT_LABELS: Record<SortOption, string> = {
  dueDate: 'Due date',
  receivedDate: 'Creation date',
};

function parseDate(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function RecentOrdersTable({ orders }: { orders: RecentOrder[] }) {
  const [sortKey, setSortKey] = useState<SortOption>('dueDate');

  const sortedOrders = useMemo(() => {
    const list = Array.from(orders);
    return list.sort((a, b) => {
      const dateA = parseDate(a[sortKey]);
      const dateB = parseDate(b[sortKey]);

      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;

      if (sortKey === 'dueDate') {
        return dateA.getTime() - dateB.getTime();
      }

      return dateB.getTime() - dateA.getTime();
    });
  }, [orders, sortKey]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-3">
        <Label htmlFor="recent-orders-sort" className="text-xs uppercase tracking-wide text-muted-foreground">
          Sort by
        </Label>
        <Select value={sortKey} onValueChange={(value) => setSortKey(value as SortOption)}>
          <SelectTrigger
            id="recent-orders-sort"
            className="w-[180px] border-border/60 bg-background/80"
            aria-label="Sort recent orders"
          >
            <SelectValue placeholder="Sort column" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(SORT_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Order</TableHead>
            <TableHead className="hidden lg:table-cell">Customer</TableHead>
            <TableHead className="hidden xl:table-cell">Status</TableHead>
            <TableHead className="hidden xl:table-cell">Machinist</TableHead>
            <TableHead className="text-right">Due</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedOrders.map((order) => {
            const dueDate = parseDate(order.dueDate);
            const receivedDate = parseDate(order.receivedDate);

            return (
              <TableRow key={order.id} className="border-border/60">
                <TableCell className="font-medium">
                  <div className="flex flex-col">
                    <Link href={`/orders/${order.id}`} className="text-sm font-semibold text-primary hover:underline">
                      #{order.orderNumber}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {receivedDate ? format(receivedDate, 'MMM d, yyyy') : 'TBD'}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                  {order.customer?.name ?? '—'}
                </TableCell>
                <TableCell className="hidden xl:table-cell">
                  <Badge variant="outline" className="border-primary/40 bg-primary/10 text-[0.7rem] uppercase tracking-wide">
                    {ORDER_STATUS_LABELS[order.status] ?? order.status}
                  </Badge>
                </TableCell>
                <TableCell className="hidden xl:table-cell">
                  <div className="flex items-center gap-2">
                    {order.assignedMachinist?.name ? (
                      <Avatar className="h-8 w-8 border border-primary/40 bg-secondary/40">
                        <AvatarFallback>{getInitials(order.assignedMachinist.name)}</AvatarFallback>
                      </Avatar>
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full border border-primary/30 bg-secondary/30 text-xs uppercase text-muted-foreground">
                        NA
                      </div>
                    )}
                    <span className="text-sm text-muted-foreground">
                      {order.assignedMachinist?.name ?? 'Unassigned'}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">
                  {dueDate ? format(dueDate, 'MMM d') : 'TBD'}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
