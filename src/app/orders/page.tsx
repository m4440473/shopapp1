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
  SlidersHorizontal,
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/Input';
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
import { decorateOrder, DEFAULT_ORDER_FILTERS, formatStatusLabel, orderMatchesFilters } from '@/lib/order-filtering';

const SORT_KEYS = ['dueDate', 'receivedDate', 'priority', 'status', 'quantity', 'lastChange'] as const;
const PRIORITY_FILTERS = ['all', 'HOT', 'RUSH', 'NORMAL', 'LOW'] as const;
const STATUS_FILTERS = ['all', 'active', 'closed'] as const;
const UNASSIGNED_VALUE = '__unassigned__';
const STATUS_OPTIONS = [
  'RECEIVED',
  'PROGRAMMING',
  'SETUP',
  'RUNNING',
  'FINISHING',
  'DONE_MACHINING',
  'INSPECTION',
  'SHIPPING',
  'CLOSED',
] as const;

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

function formatDate(input?: string | Date | null) {
  if (!input) return 'TBD';
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return 'TBD';
  return date.toLocaleDateString();
}

function SortableHeader({
  label,
  column,
  current,
  dir,
  onChange,
}: {
  label: string;
  column: (typeof SORT_KEYS)[number];
  current: string;
  dir: 'asc' | 'desc';
  onChange: (column: (typeof SORT_KEYS)[number]) => void;
}) {
  const active = current === column;
  return (
    <button
      className={`flex items-center gap-1 text-left text-xs font-medium uppercase tracking-wide transition hover:text-primary ${active ? 'text-primary' : 'text-muted-foreground'}`}
      onClick={() => onChange(column)}
    >
      <ArrowUpDown className="h-3.5 w-3.5" />
      {label} {active ? (dir === 'asc' ? '↑' : '↓') : ''}
    </button>
  );
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
  const [advancedFilters, setAdvancedFilters] = useState({ ...DEFAULT_ORDER_FILTERS });
  const [filtersOpen, setFiltersOpen] = useState(false);

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

  const decorated = useMemo(() => items.map((order) => decorateOrder(order)), [items]);

  const sorted = useMemo(() => {
    const arr: any[] = [...decorated];
    if (!SORT_KEYS.includes(sortKey as any)) return arr;
    arr.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      if (sortKey === 'dueDate' || sortKey === 'receivedDate') {
        const timeA = new Date(a[sortKey] as any).getTime();
        const timeB = new Date(b[sortKey] as any).getTime();
        if (Number.isNaN(timeA) && Number.isNaN(timeB)) return 0;
        if (Number.isNaN(timeA)) return 1;
        if (Number.isNaN(timeB)) return -1;
        return (timeA - timeB) * dir;
      }
      if (sortKey === 'quantity') {
        return (a.totalQuantity - b.totalQuantity) * dir;
      }
      if (sortKey === 'lastChange') {
        const timeA = a.lastStatusChange ? a.lastStatusChange.getTime() : 0;
        const timeB = b.lastStatusChange ? b.lastStatusChange.getTime() : 0;
        return (timeA - timeB) * dir;
      }
      return String(a[sortKey]).localeCompare(String(b[sortKey])) * dir;
    });
    return arr;
  }, [decorated, sortKey, sortDir]);

  const filtered = useMemo(() => {
    const withAssigned = sorted.map((order) => ({
      ...order,
      assignedMachinistId: order.assignedMachinist?.id ?? null,
    }));
    return withAssigned.filter((order) =>
      orderMatchesFilters(order as any, { ...advancedFilters, machinistId: machinistFilter }, statusFilter, priorityFilter),
    );
  }, [sorted, statusFilter, priorityFilter, machinistFilter, advancedFilters]);

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
  const unassignedCount = sorted.filter((order) => !order.assignedMachinist?.id).length;

  const handleSortChange = (column: (typeof SORT_KEYS)[number]) => {
    setSortKey((prev) => {
      if (prev === column) {
        setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortDir('asc');
      return column;
    });
  };

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
            <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="inline-flex items-center gap-2 rounded-full border-border/60 bg-background/60">
                  <SlidersHorizontal className="h-4 w-4" />
                  More filters
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl">
                <DialogHeader>
                  <DialogTitle>Advanced filters</DialogTitle>
                  <DialogDescription>Layer additional filters to zero in on exactly what you need.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-3 rounded-lg border border-border/60 bg-secondary/30 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</p>
                    <div className="grid grid-cols-2 gap-2">
                      {STATUS_OPTIONS.map((status) => {
                        const active = advancedFilters.statuses.includes(status);
                        return (
                          <button
                            key={status}
                            className={`flex items-center justify-between rounded-md border px-3 py-2 text-xs uppercase tracking-wide transition hover:border-primary/60 hover:text-primary ${active ? 'border-primary/60 bg-primary/10 text-primary' : 'border-border/60 text-muted-foreground'}`}
                            onClick={() =>
                              setAdvancedFilters((prev) => ({
                                ...prev,
                                statuses: active
                                  ? prev.statuses.filter((s) => s !== status)
                                  : [...prev.statuses, status],
                              }))
                            }
                          >
                            <span>{status.replace(/_/g, ' ')}</span>
                            <Checkbox checked={active} className="pointer-events-none h-4 w-4" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="space-y-3 rounded-lg border border-border/60 bg-secondary/30 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Priority</p>
                    <div className="grid grid-cols-2 gap-2">
                      {['HOT', 'RUSH', 'NORMAL', 'LOW'].map((priority) => {
                        const active = advancedFilters.priorities.includes(priority);
                        return (
                          <button
                            key={priority}
                            className={`flex items-center justify-between rounded-md border px-3 py-2 text-xs uppercase tracking-wide transition hover:border-primary/60 hover:text-primary ${active ? 'border-primary/60 bg-primary/10 text-primary' : 'border-border/60 text-muted-foreground'}`}
                            onClick={() =>
                              setAdvancedFilters((prev) => ({
                                ...prev,
                                priorities: active
                                  ? prev.priorities.filter((p) => p !== priority)
                                  : [...prev.priorities, priority],
                              }))
                            }
                          >
                            <span>{priority}</span>
                            <Checkbox checked={active} className="pointer-events-none h-4 w-4" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="space-y-3 rounded-lg border border-border/60 bg-secondary/30 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dates</p>
                    <div className="grid grid-cols-2 gap-3 text-sm text-muted-foreground">
                      <div className="space-y-1">
                        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Created from</Label>
                        <Input
                          type="date"
                          value={advancedFilters.createdFrom ?? ''}
                          onChange={(e) => setAdvancedFilters((prev) => ({ ...prev, createdFrom: e.target.value }))}
                          className="border-border/60 bg-background/80"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Created to</Label>
                        <Input
                          type="date"
                          value={advancedFilters.createdTo ?? ''}
                          onChange={(e) => setAdvancedFilters((prev) => ({ ...prev, createdTo: e.target.value }))}
                          className="border-border/60 bg-background/80"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Due from</Label>
                        <Input
                          type="date"
                          value={advancedFilters.dueFrom ?? ''}
                          onChange={(e) => setAdvancedFilters((prev) => ({ ...prev, dueFrom: e.target.value }))}
                          className="border-border/60 bg-background/80"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Due to</Label>
                        <Input
                          type="date"
                          value={advancedFilters.dueTo ?? ''}
                          onChange={(e) => setAdvancedFilters((prev) => ({ ...prev, dueTo: e.target.value }))}
                          className="border-border/60 bg-background/80"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3 rounded-lg border border-border/60 bg-secondary/30 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Part & addon details</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Min qty</Label>
                        <Input
                          type="number"
                          min={0}
                          value={advancedFilters.minQty ?? ''}
                          onChange={(e) =>
                            setAdvancedFilters((prev) => ({
                              ...prev,
                              minQty: e.target.value ? Number(e.target.value) : undefined,
                            }))
                          }
                          className="border-border/60 bg-background/80"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Max qty</Label>
                        <Input
                          type="number"
                          min={0}
                          value={advancedFilters.maxQty ?? ''}
                          onChange={(e) =>
                            setAdvancedFilters((prev) => ({
                              ...prev,
                              maxQty: e.target.value ? Number(e.target.value) : undefined,
                            }))
                          }
                          className="border-border/60 bg-background/80"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="requires-addons"
                        checked={advancedFilters.requiresAddons}
                        onCheckedChange={(checked) => setAdvancedFilters((prev) => ({ ...prev, requiresAddons: Boolean(checked) }))}
                      />
                      <Label htmlFor="requires-addons" className="text-sm text-muted-foreground">
                        Requires addons
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="stale-status"
                        checked={advancedFilters.staleStatus}
                        onCheckedChange={(checked) => setAdvancedFilters((prev) => ({ ...prev, staleStatus: Boolean(checked) }))}
                      />
                      <Label htmlFor="stale-status" className="text-sm text-muted-foreground">
                        No recent status change (30+ days)
                      </Label>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border/60 bg-background/60 px-4 py-3 text-sm text-muted-foreground">
                  <span>Filters combine with the top bar and machinist picker.</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setAdvancedFilters({ ...DEFAULT_ORDER_FILTERS })}
                    className="rounded-full"
                  >
                    Reset
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
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
                    <SelectItem value="receivedDate">Creation date</SelectItem>
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
                  <TableHead className="w-[140px]">
                    <SortableHeader label="Order" column="receivedDate" current={sortKey} dir={sortDir} onChange={handleSortChange} />
                  </TableHead>
                  <TableHead>Business</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>
                    <SortableHeader label="Status" column="status" current={sortKey} dir={sortDir} onChange={handleSortChange} />
                  </TableHead>
                  <TableHead>
                    <SortableHeader label="Due" column="dueDate" current={sortKey} dir={sortDir} onChange={handleSortChange} />
                  </TableHead>
                  <TableHead>
                    <SortableHeader label="Priority" column="priority" current={sortKey} dir={sortDir} onChange={handleSortChange} />
                  </TableHead>
                  <TableHead>
                    <SortableHeader label="Qty" column="quantity" current={sortKey} dir={sortDir} onChange={handleSortChange} />
                  </TableHead>
                  <TableHead>
                    <SortableHeader label="Last change" column="lastChange" current={sortKey} dir={sortDir} onChange={handleSortChange} />
                  </TableHead>
                  <TableHead>Machinist</TableHead>
                  <TableHead>Addons</TableHead>
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
                        {formatStatusLabel(order.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(order.dueDate)}</TableCell>
                    <TableCell className="text-sm font-semibold uppercase text-muted-foreground">
                      {order.priority}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{order.totalQuantity ?? 0}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {order.lastStatusChange ? formatDate(order.lastStatusChange) : '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {order.assignedMachinist?.name ?? order.assignedMachinist?.email ?? 'Unassigned'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {order.checklist?.length ? (
                        <div className="flex flex-col gap-1">
                          <span className="font-semibold text-foreground">
                            {order.checklist.length - (order.openAddonCount ?? 0)}/{order.checklist.length} done
                          </span>
                          {order.openAddonCount ? (
                            <span className="text-xs text-amber-500">
                              {order.openAddonCount} addon{order.openAddonCount === 1 ? '' : 's'} open
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">All clear</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">None</span>
                      )}
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
