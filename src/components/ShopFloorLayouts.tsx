"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowUpDown, LayoutGrid, LayoutList, MonitorPlay, SlidersHorizontal } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { decorateOrder, DEFAULT_ORDER_FILTERS, formatStatusLabel, orderMatchesFilters, type OrderWithMeta } from '@/lib/order-ui-utils';

type LayoutOption = 'grid' | 'handoff' | 'machinist';

type Props = {
  orders: OrderWithMeta[];
  machinists: Array<{ id: string | null; name?: string | null; email?: string | null }>;
  departments: Array<{ id: string; name: string; sortOrder?: number | null }>;
  initialDepartmentId: string | null;
  initialDepartmentFeed: Array<{
    orderId: string;
    orderNumber: string;
    customerName: string | null;
    dueDate: string | Date | null;
    status: string;
    totalParts: number;
    readyParts: Array<{ id: string; partNumber: string | null; quantity: number | null }>;
    readyPartsCount: number;
  }>;
};

const SORT_KEYS = ['dueDate', 'priority', 'status', 'quantity'] as const;

function SortButton({
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
      onClick={() => onChange(column)}
      className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs uppercase tracking-wide transition hover:text-primary ${active ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}
    >
      <ArrowUpDown className="h-3.5 w-3.5" />
      {label} {active ? (dir === 'asc' ? '↑' : '↓') : ''}
    </button>
  );
}

export function ShopFloorLayouts({
  orders,
  machinists,
  departments,
  initialDepartmentId,
  initialDepartmentFeed,
}: Props) {
  const [layout, setLayout] = useState<LayoutOption>('grid');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'closed'>('active');
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'HOT' | 'RUSH' | 'NORMAL' | 'LOW'>('all');
  const [filters, setFilters] = useState({ ...DEFAULT_ORDER_FILTERS });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortKey, setSortKey] = useState<(typeof SORT_KEYS)[number]>('dueDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [departmentId, setDepartmentId] = useState(initialDepartmentId ?? '');
  const [departmentFeed, setDepartmentFeed] = useState(initialDepartmentFeed ?? []);
  const [departmentLoading, setDepartmentLoading] = useState(false);
  const [departmentError, setDepartmentError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  useEffect(() => {
    setDepartmentId(initialDepartmentId ?? '');
    setDepartmentFeed(initialDepartmentFeed ?? []);
  }, [initialDepartmentId, initialDepartmentFeed]);

  const loadDepartmentFeed = useCallback(async (nextDepartmentId: string) => {
    if (!nextDepartmentId) return;
    setDepartmentLoading(true);
    setDepartmentError(null);
    try {
      const res = await fetch(`/api/intelligence/department-feed?departmentId=${encodeURIComponent(nextDepartmentId)}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        const message = await res.text();
        throw new Error(message || 'Failed to load department feed');
      }
      const data = await res.json();
      setDepartmentFeed(Array.isArray(data?.items) ? data.items : []);
      setLastRefresh(new Date());
    } catch (err: any) {
      setDepartmentError(err?.message ?? 'Failed to load department feed');
      setDepartmentFeed([]);
    } finally {
      setDepartmentLoading(false);
    }
  }, []);

  // Auto-refresh department feed every 30 seconds when in handoff mode
  useEffect(() => {
    if (layout !== 'handoff' || !departmentId) return;

    const interval = setInterval(() => {
      loadDepartmentFeed(departmentId);
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [layout, departmentId, loadDepartmentFeed]);

  useEffect(() => {
    if (!departmentId) {
      setDepartmentFeed([]);
      setDepartmentError(null);
      return;
    }
    if (departmentId === initialDepartmentId) {
      setDepartmentFeed(initialDepartmentFeed ?? []);
      setDepartmentError(null);
      return;
    }
    loadDepartmentFeed(departmentId);
  }, [departmentId, initialDepartmentId, initialDepartmentFeed, loadDepartmentFeed]);

  const filtered = useMemo(() => {
    const decoratedOrders = orders.map((order) => decorateOrder(order));
    return decoratedOrders.filter((order) =>
      orderMatchesFilters(order, { ...filters, machinistId: filters.machinistId ?? 'all' }, statusFilter, priorityFilter),
    );
  }, [orders, filters, statusFilter, priorityFilter]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      if (sortKey === 'dueDate') {
        const aDue = a.dueDate ? new Date(a.dueDate).getTime() : 0;
        const bDue = b.dueDate ? new Date(b.dueDate).getTime() : 0;
        return (aDue - bDue) * dir;
      }
      if (sortKey === 'quantity') {
        return ((a.totalQuantity ?? 0) - (b.totalQuantity ?? 0)) * dir;
      }
      return String(a[sortKey]).localeCompare(String(b[sortKey])) * dir;
    });
    return list;
  }, [filtered, sortKey, sortDir]);

  const handoffOrders = sorted.filter((order) => order.status === 'COMPLETE' && (order.openAddonCount ?? 0) > 0);

  const machinistBuckets = useMemo(() => {
    const buckets: Record<string, OrderWithMeta[]> = {};
    sorted.forEach((order) => {
      const key = order.assignedMachinist?.name ?? order.assignedMachinist?.id ?? 'Unassigned';
      buckets[key] = buckets[key] ? [...buckets[key], order] : [order];
    });
    return buckets;
  }, [sorted]);

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

  const formatReadyPartLabel = (part: { id: string; partNumber: string | null }) => {
    const partNumber = part.partNumber?.trim();
    if (partNumber) return partNumber;
    return `#${part.id.slice(0, 6)}`;
  };

  return (
    <div className="space-y-4 rounded-xl border border-border/60 bg-card/70 p-4 backdrop-blur">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-primary/70">Displays</p>
          <h2 className="text-xl font-semibold text-foreground">Shop floor layouts</h2>
          <p className="text-sm text-muted-foreground">Tune filters and switch layouts to match the TV on the floor.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={layout === 'grid' ? 'default' : 'secondary'}
            className="rounded-full"
            size="sm"
            onClick={() => setLayout('grid')}
          >
            <LayoutGrid className="mr-2 h-4 w-4" /> Grid digest
          </Button>
          <Button
            variant={layout === 'machinist' ? 'default' : 'secondary'}
            className="rounded-full"
            size="sm"
            onClick={() => setLayout('machinist')}
          >
            <LayoutList className="mr-2 h-4 w-4" /> By machinist
          </Button>
          <Button
            variant={layout === 'handoff' ? 'default' : 'secondary'}
            className="rounded-full"
            size="sm"
            onClick={() => setLayout('handoff')}
          >
            <MonitorPlay className="mr-2 h-4 w-4" /> Ready for fab
          </Button>
          <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="rounded-full border-border/60 bg-background/60">
                <SlidersHorizontal className="mr-2 h-4 w-4" /> Filters
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>Queue filters</DialogTitle>
                <DialogDescription>Target orders by machinist, status, dates, quantities, and addon readiness.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-3 rounded-lg border border-border/60 bg-secondary/30 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Assignment</p>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Machinist</Label>
                    <Select
                      value={filters.machinistId ?? 'all'}
                      onValueChange={(value) => setFilters((prev) => ({ ...prev, machinistId: value }))}
                    >
                      <SelectTrigger className="border-border/60 bg-background/80">
                        <SelectValue placeholder="All machinists" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="__unassigned__">Unassigned</SelectItem>
                        {machinists.map((mach) => (
                          <SelectItem key={mach.id ?? 'unknown'} value={mach.id ?? 'unknown'}>
                            {mach.name ?? mach.email ?? 'Unknown'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Status</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {['RECEIVED', 'PROGRAMMING', 'SETUP', 'RUNNING', 'FINISHING', 'DONE_MACHINING', 'INSPECTION', 'SHIPPING', 'CLOSED'].map((status) => {
                        const active = filters.statuses?.includes(status);
                        return (
                          <button
                            key={status}
                            className={`rounded-md border px-3 py-2 text-[0.7rem] uppercase tracking-wide transition hover:border-primary/60 hover:text-primary ${active ? 'border-primary/60 bg-primary/10 text-primary' : 'border-border/60 text-muted-foreground'}`}
                            onClick={() =>
                              setFilters((prev) => ({
                                ...prev,
                                statuses: active
                                  ? (prev.statuses ?? []).filter((s) => s !== status)
                                  : [...(prev.statuses ?? []), status],
                              }))
                            }
                          >
                            {status.replace(/_/g, ' ')}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div className="space-y-3 rounded-lg border border-border/60 bg-secondary/30 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dates & quantities</p>
                  <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                    <div className="space-y-1">
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Created from</Label>
                      <Input
                        type="date"
                        value={filters.createdFrom ?? ''}
                        onChange={(e) => setFilters((prev) => ({ ...prev, createdFrom: e.target.value }))}
                        className="border-border/60 bg-background/80"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Created to</Label>
                      <Input
                        type="date"
                        value={filters.createdTo ?? ''}
                        onChange={(e) => setFilters((prev) => ({ ...prev, createdTo: e.target.value }))}
                        className="border-border/60 bg-background/80"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Due from</Label>
                      <Input
                        type="date"
                        value={filters.dueFrom ?? ''}
                        onChange={(e) => setFilters((prev) => ({ ...prev, dueFrom: e.target.value }))}
                        className="border-border/60 bg-background/80"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Due to</Label>
                      <Input
                        type="date"
                        value={filters.dueTo ?? ''}
                        onChange={(e) => setFilters((prev) => ({ ...prev, dueTo: e.target.value }))}
                        className="border-border/60 bg-background/80"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Min qty</Label>
                      <Input
                        type="number"
                        min={0}
                        value={filters.minQty ?? ''}
                        onChange={(e) =>
                          setFilters((prev) => ({ ...prev, minQty: e.target.value ? Number(e.target.value) : undefined }))
                        }
                        className="border-border/60 bg-background/80"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Max qty</Label>
                      <Input
                        type="number"
                        min={0}
                        value={filters.maxQty ?? ''}
                        onChange={(e) =>
                          setFilters((prev) => ({ ...prev, maxQty: e.target.value ? Number(e.target.value) : undefined }))
                        }
                        className="border-border/60 bg-background/80"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="sfi-requires-addons"
                      checked={filters.requiresAddons}
                      onCheckedChange={(checked) => setFilters((prev) => ({ ...prev, requiresAddons: Boolean(checked) }))}
                    />
                    <Label htmlFor="sfi-requires-addons" className="text-sm text-muted-foreground">
                      Requires addons
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="sfi-stale-status"
                      checked={filters.staleStatus}
                      onCheckedChange={(checked) => setFilters((prev) => ({ ...prev, staleStatus: Boolean(checked) }))}
                    />
                    <Label htmlFor="sfi-stale-status" className="text-sm text-muted-foreground">
                      No status change in 30 days
                    </Label>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border/60 bg-background/60 px-4 py-3 text-sm text-muted-foreground">
                <span>Filters combine with the quick status and priority pickers.</span>
                <Button variant="ghost" size="sm" onClick={() => setFilters({ ...DEFAULT_ORDER_FILTERS })}>
                  Reset all
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-border/60 bg-background/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Department feed</p>
            <p className="text-sm text-foreground">Focus the shop queue by the department in charge.</p>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Department</Label>
            <Select
              value={departmentId}
              onValueChange={(value) => setDepartmentId(value)}
              disabled={!departments.length}
            >
              <SelectTrigger className="w-[200px] border-border/60 bg-background/80">
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((department) => (
                  <SelectItem key={department.id} value={department.id}>
                    {department.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {departmentId && (
              <span className="text-xs text-muted-foreground">
                Last updated: {lastRefresh.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
        {departmentError ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {departmentError}
          </div>
        ) : null}
        {departmentLoading ? (
          <p className="text-sm text-muted-foreground">Loading department feed…</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {departmentFeed.map((order) => {
              const preview = order.readyParts.slice(0, 3);
              const remaining = Math.max(order.readyPartsCount - preview.length, 0);
              return (
                <div
                  key={order.orderId}
                  className="flex flex-col gap-3 rounded-lg border border-border/60 bg-muted/10 p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Link href={`/orders/${order.orderId}`} className="text-base font-semibold text-primary hover:underline">
                      #{order.orderNumber}
                    </Link>
                    <Badge variant="outline" className="rounded-full px-3 py-1 text-[0.7rem] uppercase tracking-wide">
                      {formatStatusLabel(order.status)}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {order.customerName ?? 'Unknown customer'} •{' '}
                    {order.dueDate ? new Date(order.dueDate).toLocaleDateString() : 'No due date'}
                  </div>
                  <div className="grid gap-1 text-xs uppercase tracking-wide text-muted-foreground">
                    <span>Contains {order.totalParts} parts</span>
                    <span className="text-foreground">Ready now: {order.readyPartsCount} parts</span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {preview.map((part) => (
                      <span key={part.id} className="rounded-full border border-border/60 bg-background/70 px-2 py-1">
                        {formatReadyPartLabel(part)}
                      </span>
                    ))}
                    {remaining > 0 ? <span className="text-xs text-muted-foreground">+{remaining} more</span> : null}
                  </div>
                </div>
              );
            })}
            {!departmentFeed.length && !departmentError && (
              <p className="col-span-full text-sm text-muted-foreground">
                No parts are ready for the selected department.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Status</Label>
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
          <SelectTrigger className="w-[160px] border-border/60 bg-background/80">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Priority</Label>
        <Select value={priorityFilter} onValueChange={(value) => setPriorityFilter(value as typeof priorityFilter)}>
          <SelectTrigger className="w-[160px] border-border/60 bg-background/80">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="HOT">HOT</SelectItem>
            <SelectItem value="RUSH">RUSH</SelectItem>
            <SelectItem value="NORMAL">NORMAL</SelectItem>
            <SelectItem value="LOW">LOW</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex flex-wrap items-center gap-2">
          <SortButton label="Due" column="dueDate" current={sortKey} dir={sortDir} onChange={handleSortChange} />
          <SortButton label="Priority" column="priority" current={sortKey} dir={sortDir} onChange={handleSortChange} />
          <SortButton label="Status" column="status" current={sortKey} dir={sortDir} onChange={handleSortChange} />
          <SortButton label="Qty" column="quantity" current={sortKey} dir={sortDir} onChange={handleSortChange} />
        </div>
      </div>

      {layout === 'grid' && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {sorted.map((order) => (
            <div
              key={order.id}
              className="flex flex-col gap-3 rounded-lg border border-border/60 bg-background/70 p-4 shadow-sm shadow-primary/5"
            >
              <div className="flex items-center justify-between gap-3">
                <Link href={`/orders/${order.id}`} className="text-lg font-semibold text-primary hover:underline">
                  #{order.orderNumber}
                </Link>
                <Badge variant="outline" className="rounded-full px-3 py-1 text-[0.7rem] uppercase tracking-wide">
                  {formatStatusLabel(order.status)}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                <div>
                  <p className="text-xs uppercase tracking-wide">Customer</p>
                  <p className="text-foreground">{order.customer?.name ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide">Machinist</p>
                  <p className="text-foreground">
                    {order.assignedMachinist?.name ?? 'Unassigned'}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide">Due</p>
                  <p className="text-foreground">{order.dueDate ? new Date(order.dueDate).toLocaleDateString() : 'TBD'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide">Priority</p>
                  <p className="text-foreground">{order.priority}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide">Quantity</p>
                  <p className="text-foreground">{order.totalQuantity ?? 0}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide">Addons</p>
                  <p className="text-foreground">
                    {order.checklist?.length ? `${order.checklist.length - (order.openAddonCount ?? 0)}/${order.checklist.length} done` : 'None'}
                  </p>
                </div>
              </div>
            </div>
          ))}
          {!sorted.length && <p className="col-span-full text-sm text-muted-foreground">No orders match the filters.</p>}
        </div>
      )}

      {layout === 'machinist' && (
        <div className="space-y-4">
          {Object.entries(machinistBuckets).map(([name, bucket]) => (
            <div key={name} className="space-y-2 rounded-lg border border-border/60 bg-background/70 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full border border-primary/40 bg-secondary/40" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{name}</p>
                    <p className="text-xs text-muted-foreground">{bucket.length} order(s)</p>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/60">
                      <TableHead>Order</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Due</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Addons</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bucket.map((order) => (
                      <TableRow key={order.id} className="border-border/60">
                        <TableCell className="font-semibold text-primary">
                          <Link href={`/orders/${order.id}`} className="hover:underline">
                            #{order.orderNumber}
                          </Link>
                        </TableCell>
                        <TableCell className="text-xs uppercase text-muted-foreground">{formatStatusLabel(order.status)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {order.dueDate ? new Date(order.dueDate).toLocaleDateString() : 'TBD'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{order.totalQuantity ?? 0}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {order.checklist?.length
                            ? `${order.checklist.length - (order.openAddonCount ?? 0)}/${order.checklist.length} complete`
                            : 'None'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ))}
          {!Object.keys(machinistBuckets).length && <p className="text-sm text-muted-foreground">No assignments to display.</p>}
        </div>
      )}

      {layout === 'handoff' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Running/complete but addons open</p>
              <p className="text-xs text-muted-foreground">
                Use this for the fabrication crew to grab parts that are ready for the next step.
              </p>
            </div>
            <Badge variant="secondary" className="rounded-full border border-lime-300/60 bg-lime-300/15 text-lime-100">
              {handoffOrders.length} highlighted
            </Badge>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {handoffOrders.map((order) => (
              <div
                key={order.id}
                className="space-y-2 rounded-lg border border-lime-300/60 bg-lime-500/10 p-4 shadow-sm shadow-lime-400/20"
              >
                <div className="flex items-center justify-between">
                  <Link href={`/orders/${order.id}`} className="text-lg font-semibold text-lime-100 hover:underline">
                    #{order.orderNumber}
                  </Link>
                  <Badge variant="outline" className="border-lime-300/60 bg-lime-300/20 text-lime-50">
                    {formatStatusLabel(order.status)}
                  </Badge>
                </div>
                <p className="text-sm text-lime-100">
                  {order.customer?.name ?? 'Unknown customer'} •{' '}
                  {order.assignedMachinist?.name ?? 'Unassigned'}
                </p>
                <p className="text-xs font-medium uppercase tracking-wide text-lime-200">
                  {order.openAddonCount} addon{order.openAddonCount === 1 ? '' : 's'} remaining
                </p>
              </div>
            ))}
            {!handoffOrders.length && (
              <p className="col-span-full text-sm text-muted-foreground">No running/completed orders with addons outstanding.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
