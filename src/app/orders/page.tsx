"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpDown,
  CalendarDays,
  Clock,
  Users,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const SORT_KEYS = ['dueDate', 'priority', 'status'] as const;
const UNASSIGNED_VALUE = '__unassigned__';

const statusColors: Record<string, string> = {
  RECEIVED: 'hsl(215 90% 65%)',
  PROGRAMMING: 'hsl(199 89% 48%)',
  SETUP: 'hsl(190 80% 65%)',
  RUNNING: 'hsl(152 76% 46%)',
  FINISHING: 'hsl(38 92% 60%)',
  DONE_MACHINING: 'hsl(262 83% 74%)',
  INSPECTION: 'hsl(27 96% 61%)',
  SHIPPING: 'hsl(48 96% 53%)',
  CLOSED: 'hsl(160 83% 45%)',
};

function formatDate(input?: string | null) {
  if (!input) return 'TBD';
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return 'TBD';
  return date.toLocaleDateString();
}

export default function OrdersPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<string>('dueDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [machinists, setMachinists] = useState<any[]>([]);

  async function load(cursor?: string, append = false) {
    try {
      setLoading(true);
      const qs = new URLSearchParams();
      qs.set('take', '20');
      if (cursor) qs.set('cursor', cursor);
      const res = await fetch('/api/orders?' + qs.toString(), {
        credentials: 'include',
      });
      if (!res.ok) throw res;
      const data = await res.json();
      setItems((prev) => (append ? [...prev, ...(data.items ?? [])] : data.items ?? []));
      setNextCursor(data.nextCursor ?? null);
      setError(null);
    } catch (err: any) {
      try {
        if (typeof err.json === 'function') {
          const j = await err.json();
          setError(typeof j === 'string' ? j : JSON.stringify(j));
        } else if (typeof err.text === 'function') {
          const txt = await err.text();
          setError(txt || 'Failed to load orders');
        } else {
          setError('Failed to load orders');
        }
      } catch {
        setError('Failed to load orders');
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    fetch('/api/admin/users?role=MACHINIST&take=100', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.resolve({ items: [] })))
      .then((d) => setMachinists(d.items ?? []))
      .catch(() => setMachinists([]));
  }, []);

  const sorted = useMemo(() => {
    const arr = [...items];
    if (!SORT_KEYS.includes(sortKey as any)) return arr;
    arr.sort((a, b) => {
      const A = a[sortKey];
      const B = b[sortKey];
      if (!A && !B) return 0;
      if (!A) return 1;
      if (!B) return -1;
      if (sortKey === 'dueDate')
        return (
          (new Date(A).getTime() - new Date(B).getTime()) * (sortDir === 'asc' ? 1 : -1)
        );
      return String(A).localeCompare(String(B)) * (sortDir === 'asc' ? 1 : -1);
    });
    return arr;
  }, [items, sortKey, sortDir]);

  const activeOrders = sorted.filter((order) => order.status !== 'CLOSED');
  const dueSoon = sorted.filter((order) => {
    if (!order.dueDate) return false;
    const due = new Date(order.dueDate).getTime();
    if (Number.isNaN(due)) return false;
    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    return due - now < sevenDays && due >= now;
  });

  async function assign(orderId: string, machinistId: string | null) {
    const res = await fetch(`/api/orders/${orderId}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ machinistId }),
      credentials: 'include',
    });
    if (res.ok) {
      const j = await res.json();
      setItems((prev) =>
        prev.map((it) =>
          it.id === j.item.id
            ? {
                ...it,
                assignedMachinist: j.item.assignedMachinist,
                assignedMachinistId: j.item.assignedMachinistId,
              }
            : it
        )
      );
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Orders</h1>
          <p className="text-muted-foreground">
            Monitor production, assign machinists, and track every status change from a single view.
          </p>
        </div>
        <Button asChild>
          <Link href="/orders/new">Create order</Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Open orders</CardDescription>
            <CardTitle className="text-3xl">{activeOrders.length}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Orders that are currently in progress.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Due within 7 days</CardDescription>
            <CardTitle className="text-3xl">{dueSoon.length}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Keep an eye on parts that need to ship soon.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total loaded</CardDescription>
            <CardTitle className="text-3xl">{sorted.length}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Showing the latest batch of orders from the API.
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="flex flex-col gap-4 border-b border-border/60 bg-card/80 backdrop-blur md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-xl">Active orders</CardTitle>
            <CardDescription>Sort and assign work to keep the floor moving.</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Label htmlFor="sortKey" className="text-xs uppercase tracking-wide text-muted-foreground">
                Sort by
              </Label>
              <Select value={sortKey} onValueChange={(value) => setSortKey(value)}>
                <SelectTrigger id="sortKey" className="w-[160px]">
                  <SelectValue placeholder="Select a column" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dueDate">Due date</SelectItem>
                  <SelectItem value="priority">Priority</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="inline-flex items-center gap-1"
              onClick={() => setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'))}
            >
              <ArrowUpDown className="h-4 w-4" />
              {sortDir === 'asc' ? 'Ascending' : 'Descending'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading && (
            <div className="text-sm text-muted-foreground">Loading orders…</div>
          )}
          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sorted.map((order) => (
              <Card key={order.id} className="border-border/60 bg-card/70 backdrop-blur">
                <CardHeader className="flex flex-col gap-3 pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <Link
                        href={`/orders/${order.id}`}
                        className="text-lg font-semibold text-primary transition-colors hover:underline"
                      >
                        {order.orderNumber}
                      </Link>
                      <CardDescription>
                        {order.customer?.name ?? 'Unknown customer'}
                      </CardDescription>
                    </div>
                    <Badge
                      variant="secondary"
                      style={{
                        backgroundColor: statusColors[order.status] ?? 'hsl(var(--accent))',
                        color: 'black',
                      }}
                      className="font-semibold"
                    >
                      {order.status.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-4 text-sm text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 font-medium text-foreground">
                      <CalendarDays className="h-4 w-4 text-muted-foreground" /> Due
                    </span>
                    <span>{formatDate(order.dueDate)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 font-medium text-foreground">
                      <Clock className="h-4 w-4 text-muted-foreground" /> Priority
                    </span>
                    <span className="uppercase">{order.priority}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 font-medium text-foreground">
                      <Users className="h-4 w-4 text-muted-foreground" /> Machinist
                    </span>
                    <span>
                      {order.assignedMachinist?.name || order.assignedMachinist?.email || 'Unassigned'}
                    </span>
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-3 border-t border-border/60 bg-muted/10 p-4">
                  <Select
                    value={order.assignedMachinist?.id ?? UNASSIGNED_VALUE}
                    onValueChange={(value) =>
                      assign(order.id, value === UNASSIGNED_VALUE ? null : value)
                    }
                  >
                    <SelectTrigger className="w-full text-left text-sm">
                      <SelectValue placeholder="Assign machinist" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNASSIGNED_VALUE}>Unassigned</SelectItem>
                      {machinists.map((m: any) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name || m.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button asChild variant="ghost" size="sm" className="self-end">
                    <Link href={`/orders/${order.id}`}>View details</Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
          {!loading && sorted.length === 0 && !error && (
            <div className="rounded-lg border border-dashed border-muted-foreground/40 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
              No orders found. Create a new order to get started.
            </div>
          )}
        </CardContent>
        {nextCursor && (
          <CardFooter className="border-t border-border/60 bg-card/80 backdrop-blur">
            <Button variant="outline" onClick={() => load(nextCursor, true)} disabled={loading}>
              Load more
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
