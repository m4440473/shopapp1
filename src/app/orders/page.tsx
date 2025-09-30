"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowUpDown,
  CalendarDays,
  Filter,
  Loader2,
  Package,
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BUSINESS_OPTIONS } from '@/lib/businesses';

const SORT_KEYS = ['dueDate', 'priority', 'status'] as const;
const PRIORITY_FILTERS = ['all', 'HOT', 'RUSH', 'NORMAL', 'LOW'] as const;
const STATUS_FILTERS = ['all', 'active', 'closed'] as const;
const UNASSIGNED_VALUE = '__unassigned__';

const STATUS_STYLES: Record<string, string> = {
  RECEIVED: 'border-primary/40 bg-primary/10 text-primary',
  PROGRAMMING: 'border-blue-400/40 bg-blue-400/15 text-blue-200',
  SETUP: 'border-sky-400/40 bg-sky-400/15 text-sky-200',
  RUNNING: 'border-emerald-400/40 bg-emerald-400/15 text-emerald-200',
  FINISHING: 'border-amber-400/40 bg-amber-400/15 text-amber-100',
  DONE_MACHINING: 'border-violet-400/40 bg-violet-400/15 text-violet-200',
  INSPECTION: 'border-orange-400/40 bg-orange-400/15 text-orange-100',
  SHIPPING: 'border-cyan-400/40 bg-cyan-400/15 text-cyan-100',
  CLOSED: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200',
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
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>('all');
  const [priorityFilter, setPriorityFilter] = useState<(typeof PRIORITY_FILTERS)[number]>('all');
  const [machinistFilter, setMachinistFilter] = useState<string>('all');

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
        return (new Date(A).getTime() - new Date(B).getTime()) * (sortDir === 'asc' ? 1 : -1);
      return String(A).localeCompare(String(B)) * (sortDir === 'asc' ? 1 : -1);
    });
    return arr;
  }, [items, sortKey, sortDir]);

  const filtered = useMemo(() => {
    return sorted.filter((order) => {
      if (statusFilter === 'active' && order.status === 'CLOSED') return false;
      if (statusFilter === 'closed' && order.status !== 'CLOSED') return false;
      if (priorityFilter !== 'all' && order.priority !== priorityFilter) return false;
      if (machinistFilter !== 'all') {
        if (machinistFilter === UNASSIGNED_VALUE) {
          if (order.assignedMachinistId) return false;
        } else if (order.assignedMachinistId !== machinistFilter) {
          return false;
        }
      }
      return true;
    });
  }, [sorted, statusFilter, priorityFilter, machinistFilter]);

  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;

  const openOrders = sorted.filter((order) => order.status !== 'CLOSED');
  const dueSoon = sorted.filter((order) => {
    if (!order.dueDate) return false;
    const due = new Date(order.dueDate).getTime();
    if (Number.isNaN(due)) return false;
    return due - now < sevenDays && due >= now;
  }).length;
  const awaitingMaterial = sorted.filter((order) => order.materialNeeded && !order.materialOrdered).length;
  const unassignedCount = sorted.filter((order) => !order.assignedMachinistId).length;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.4em] text-primary/70">Orders</p>
          <h1 className="text-4xl font-semibold text-foreground">Overview & assignment hub</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Slice the queue by status, priority, or machinist and keep the navy control panel humming.
          </p>
        </div>
        <Button asChild className="rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/40">
          <Link href="/orders/new">Create order</Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open orders</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{openOrders.length}</div>
            <p className="text-xs text-muted-foreground">Currently in play on the floor</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Due within 7 days</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{dueSoon}</div>
            <p className="text-xs text-muted-foreground">Make sure deadlines stay ahead</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Awaiting material</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{awaitingMaterial}</div>
            <p className="text-xs text-muted-foreground">Orders still waiting on stock</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unassigned</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{unassignedCount}</div>
            <p className="text-xs text-muted-foreground">Waiting for a machinist</p>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="flex flex-col gap-4 border-b border-border/60 bg-card/80 backdrop-blur lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">Orders overview</CardTitle>
            <CardDescription>Filter, sort, and assign without leaving the table.</CardDescription>
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex items-center gap-3">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <RadioGroup
                className="flex items-center gap-2"
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}
              >
                {STATUS_FILTERS.map((value) => (
                  <Label
                    key={value}
                    className={`flex cursor-pointer items-center gap-2 rounded-full border border-border/60 bg-background/60 px-3 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground transition-colors hover:text-primary ${
                      statusFilter === value ? 'border-primary/60 text-primary' : ''
                    }`}
                  >
                    <RadioGroupItem value={value} className="sr-only" />
                    {value === 'all' ? 'All' : value === 'active' ? 'Active' : 'Closed'}
                  </Label>
                ))}
              </RadioGroup>
            </div>
            <div className="flex items-center gap-3">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Priority</Label>
              <RadioGroup
                className="flex items-center gap-2"
                value={priorityFilter}
                onValueChange={(value) => setPriorityFilter(value as typeof priorityFilter)}
              >
                {PRIORITY_FILTERS.map((value) => (
                  <Label
                    key={value}
                    className={`flex cursor-pointer items-center gap-2 rounded-full border border-border/60 bg-background/60 px-3 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground transition-colors hover:text-primary ${
                      priorityFilter === value ? 'border-primary/60 text-primary' : ''
                    }`}
                  >
                    <RadioGroupItem value={value} className="sr-only" />
                    {value === 'all' ? 'All' : value}
                  </Label>
                ))}
              </RadioGroup>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Label htmlFor="sortKey" className="text-xs uppercase tracking-wide text-muted-foreground">
                  Sort by
                </Label>
                <Select value={sortKey} onValueChange={(value) => setSortKey(value)}>
                  <SelectTrigger id="sortKey" className="w-[160px] border-border/60 bg-background/80">
                    <SelectValue placeholder="Sort column" />
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
                className="inline-flex items-center gap-1 rounded-full border-border/60 bg-background/60"
                onClick={() => setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'))}
              >
                <ArrowUpDown className="h-4 w-4" />
                {sortDir === 'asc' ? 'Ascending' : 'Descending'}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Machinist</Label>
              <Select value={machinistFilter} onValueChange={(value) => setMachinistFilter(value)}>
                <SelectTrigger className="w-[200px] border-border/60 bg-background/80">
                  <SelectValue placeholder="All machinists" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All machinists</SelectItem>
                  <SelectItem value={UNASSIGNED_VALUE}>Unassigned</SelectItem>
                  {machinists.map((mach: any) => (
                    <SelectItem key={mach.id} value={mach.id}>
                      {mach.name || mach.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-border/50 bg-background/60 shadow-lg shadow-primary/5">
            <Table>
              <TableHeader>
                <TableRow className="border-border/60">
                  <TableHead className="w-[140px]">Order</TableHead>
                  <TableHead>Business</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Machinist</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((order) => (
                  <TableRow key={order.id} className="border-border/60">
                    <TableCell className="font-semibold text-primary">
                      <Link href={`/orders/${order.id}`} className="hover:underline">
                        #{order.orderNumber}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const option = BUSINESS_OPTIONS.find((item) => item.code === order.business);
                        if (!option) {
                          return <Badge variant="outline">{order.business ?? 'N/A'}</Badge>;
                        }
                        return (
                          <div className="flex flex-col gap-1">
                            <Badge variant="outline" className="w-fit font-mono text-xs uppercase">
                              {option.prefix}
                            </Badge>
                            <span className="text-xs text-muted-foreground">{option.name}</span>
                          </div>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {order.customer?.name ?? 'Unknown customer'}
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
                    <TableCell className="text-sm text-muted-foreground">{formatDate(order.dueDate)}</TableCell>
                    <TableCell className="text-sm font-semibold uppercase text-muted-foreground">
                      {order.priority}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {order.assignedMachinist?.name ?? order.assignedMachinist?.email ?? 'Unassigned'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="ghost" className="text-primary hover:text-primary">
                        <Link href={`/orders/${order.id}`}>View</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {loading && (
              <div className="flex items-center justify-center gap-2 border-t border-border/60 py-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading orders…
              </div>
            )}
            {!loading && !filtered.length && !error && (
              <div className="border-t border-border/60 py-6 text-center text-sm text-muted-foreground">
                No orders match the current filters.
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="border-t border-border/60 bg-card/80 backdrop-blur">
          {nextCursor ? (
            <Button
              variant="outline"
              onClick={() => load(nextCursor, true)}
              disabled={loading}
              className="rounded-full border-border/60 bg-background/60"
            >
              Load more
            </Button>
          ) : (
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">End of queue</p>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}

