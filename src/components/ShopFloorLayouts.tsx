"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, LayoutGrid, LayoutList, Plus, Rows3, Save, SlidersHorizontal, Trash2 } from 'lucide-react';

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
import { decorateOrder, DEFAULT_ORDER_FILTERS, formatStatusLabel, orderMatchesFilters } from '@/modules/orders/orders.shared';
import type { DepartmentFeedOrder, OrderWithMeta } from '@/modules/orders/orders.types';
import { WorkQueueOrderCard } from '@/components/work-queue/WorkQueueOrderCard';
import {
  RunningWorkersStrip,
  type RunningWorkerSummary,
} from '@/components/work-queue/RunningWorkersStrip';
import {
  compareShopFloorOrders,
  getMatchingShopFloorRule,
  translucentRuleStyle,
  type ShopFloorComparableOrder,
} from '@/modules/shop-floor/shop-floor.shared';
import type {
  ShopFloorColorRuleInput,
  ShopFloorDisplayOptionsInput,
  ShopFloorRuleFieldInput,
} from '@/modules/shop-floor/shop-floor.schema';

type LayoutOption = 'grid' | 'machinist' | 'workQueue';

type Props = {
  orders: OrderWithMeta[];
  machinists: Array<{ id: string | null; name?: string | null; email?: string | null }>;
  departments: Array<{ id: string; name: string; sortOrder?: number | null }>;
  initialDepartmentId: string | null;
  initialDepartmentFeed: DepartmentFeedOrder[];
  runningWorkers?: RunningWorkerSummary[];
  initialDisplayOptions: ShopFloorDisplayOptionsInput;
  canEditDisplay: boolean;
};

const SORT_OPTIONS = [
  ['dueDate', 'Due date'], ['daysPastDue', 'Days past due'], ['receivedDate', 'Received date'],
  ['orderNumber', 'Order number'], ['business', 'Business'], ['customer', 'Customer'], ['machinist', 'Machinist'], ['department', 'Current department'],
  ['priority', 'Priority'], ['status', 'Status'], ['quantity', 'Total quantity'],
  ['partCount', 'Part count'], ['openAddons', 'Open checklist items'], ['activeTimers', 'Active timers'],
] as const;

const RULE_FIELD_OPTIONS = [
  ['daysPastDue', 'Days past due'], ['priority', 'Priority'], ['status', 'Status'],
  ['business', 'Business'], ['customer', 'Customer'], ['machinist', 'Machinist'], ['department', 'Current department'], ['quantity', 'Total quantity'],
  ['partCount', 'Part count'], ['openAddons', 'Open checklist items'], ['activeTimers', 'Active timers'],
] as const;

const NUMERIC_RULE_FIELDS = new Set<ShopFloorRuleFieldInput>([
  'daysPastDue', 'quantity', 'partCount', 'openAddons', 'activeTimers',
]);

function comparableOrder(
  order: OrderWithMeta,
  activeTimers = 0,
  departmentNames?: Map<string, string>,
): ShopFloorComparableOrder {
  const department = Array.from(new Set(
    (order.parts ?? [])
      .map((part) => part.currentDepartmentId ? departmentNames?.get(part.currentDepartmentId) ?? part.currentDepartmentId : null)
      .filter((value): value is string => Boolean(value)),
  )).join(', ');
  return {
    orderNumber: order.orderNumber,
    business: order.business,
    dueDate: order.dueDate,
    receivedDate: order.receivedDate,
    customer: order.customer?.name,
    machinist: order.assignedMachinist?.name ?? order.assignedMachinist?.email,
    department,
    priority: order.priority,
    status: order.status,
    quantity: order.totalQuantity,
    partCount: order.parts?.length ?? 0,
    openAddons: order.openAddonCount,
    activeTimers,
  };
}

export function ShopFloorLayouts({
  orders,
  machinists,
  departments,
  initialDepartmentId,
  initialDepartmentFeed,
  runningWorkers = [],
  initialDisplayOptions,
  canEditDisplay,
}: Props) {
  const [displayOptions, setDisplayOptions] = useState(initialDisplayOptions);
  const [controlsExpanded, setControlsExpanded] = useState(true);
  const [savingDisplay, setSavingDisplay] = useState(false);
  const [displayMessage, setDisplayMessage] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'closed'>('active');
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'HOT' | 'RUSH' | 'NORMAL' | 'LOW'>('all');
  const [filters, setFilters] = useState({ ...DEFAULT_ORDER_FILTERS });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [departmentId, setDepartmentId] = useState(initialDepartmentId ?? '');
  const [departmentFeed, setDepartmentFeed] = useState(initialDepartmentFeed ?? []);
  const [departmentLoading, setDepartmentLoading] = useState(false);
  const [departmentError, setDepartmentError] = useState<string | null>(null);
  const [includeCompleted, setIncludeCompleted] = useState(false);
  const [liveRunningWorkers, setLiveRunningWorkers] = useState(runningWorkers);

  const layout: LayoutOption = displayOptions.layout;

  useEffect(() => {
    setControlsExpanded(window.localStorage.getItem('shop-floor-controls-collapsed') !== 'true');
  }, []);

  const toggleControls = () => {
    setControlsExpanded((current) => {
      window.localStorage.setItem('shop-floor-controls-collapsed', String(current));
      return !current;
    });
  };

  useEffect(() => {
    setDepartmentId(initialDepartmentId ?? '');
    setDepartmentFeed(initialDepartmentFeed ?? []);
  }, [initialDepartmentId, initialDepartmentFeed]);

  useEffect(() => {
    setLiveRunningWorkers(runningWorkers);
  }, [runningWorkers]);

  useEffect(() => {
    let cancelled = false;
    const refreshRunningWorkers = async () => {
      try {
        const res = await fetch('/api/dispatch/timers', { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data?.items)) {
          setLiveRunningWorkers(data.items);
        }
      } catch {
        // Keep the last trusted snapshot visible during a temporary network interruption.
      }
    };
    const timer = window.setInterval(refreshRunningWorkers, 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const loadDepartmentFeed = useCallback(async (nextDepartmentId: string, includeCompletedValue: boolean) => {
    if (!nextDepartmentId) return;
    setDepartmentLoading(true);
    setDepartmentError(null);
    try {
      const params = new URLSearchParams({ departmentId: nextDepartmentId, includeCompleted: String(includeCompletedValue) });
      const res = await fetch(`/api/intelligence/department-feed?${params.toString()}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        const message = await res.text();
        throw new Error(message || 'Failed to load department feed');
      }
      const data = await res.json();
      setDepartmentFeed(Array.isArray(data?.items) ? data.items : []);
    } catch (err: any) {
      setDepartmentError(err?.message ?? 'Failed to load department feed');
      setDepartmentFeed([]);
    } finally {
      setDepartmentLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!departmentId) {
      setDepartmentFeed([]);
      setDepartmentError(null);
      return;
    }
    if (departmentId === initialDepartmentId && includeCompleted === false) {
      setDepartmentFeed(initialDepartmentFeed ?? []);
      setDepartmentError(null);
      return;
    }
    loadDepartmentFeed(departmentId, includeCompleted);
  }, [departmentId, includeCompleted, initialDepartmentId, initialDepartmentFeed, loadDepartmentFeed]);

  useEffect(() => {
    if (!departmentId) return;

    let cancelled = false;
    const refreshDepartmentFeed = async () => {
      try {
        const params = new URLSearchParams({
          departmentId,
          includeCompleted: String(includeCompleted),
        });
        const res = await fetch(`/api/intelligence/department-feed?${params.toString()}`, {
          credentials: 'include',
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data?.items)) {
          setDepartmentFeed(data.items);
        }
      } catch {
        // Keep the last trusted snapshot visible during a temporary network interruption.
      }
    };

    const timer = window.setInterval(refreshDepartmentFeed, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [departmentId, includeCompleted]);

  const departmentNameById = useMemo(
    () => new Map(departments.map((department) => [department.id, department.name] as const)),
    [departments]
  );
  const firstDepartmentName = departments[0]?.name ?? 'Unassigned';

  const selectedDepartmentName = departmentNameById.get(departmentId) ?? 'Unassigned';

  const activeTimerCountsByOrder = useMemo(() => {
    const counts = new Map<string, number>();
    liveRunningWorkers.forEach((worker) => {
      counts.set(worker.orderId, (counts.get(worker.orderId) ?? 0) + 1);
    });
    return counts;
  }, [liveRunningWorkers]);

  const advancedFilterCount = useMemo(() => {
    let count = 0;
    if (filters.machinistId && filters.machinistId !== 'all') count += 1;
    if (filters.statuses?.length) count += 1;
    if (filters.createdFrom) count += 1;
    if (filters.createdTo) count += 1;
    if (filters.dueFrom) count += 1;
    if (filters.dueTo) count += 1;
    if (filters.minQty !== undefined) count += 1;
    if (filters.maxQty !== undefined) count += 1;
    if (filters.requiresAddons) count += 1;
    if (filters.staleStatus) count += 1;
    return count;
  }, [filters]);

  const filtered = useMemo(() => {
    const decoratedOrders = orders.map((order) => decorateOrder(order));
    return decoratedOrders.filter((order) =>
      orderMatchesFilters(order, { ...filters, machinistId: filters.machinistId ?? 'all' }, statusFilter, priorityFilter),
    );
  }, [orders, filters, statusFilter, priorityFilter]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => compareShopFloorOrders(
      comparableOrder(a, activeTimerCountsByOrder.get(a.id) ?? 0, departmentNameById),
      comparableOrder(b, activeTimerCountsByOrder.get(b.id) ?? 0, departmentNameById),
      displayOptions,
    ));
    return list;
  }, [activeTimerCountsByOrder, departmentNameById, displayOptions, filtered]);

  const ordersById = useMemo(() => new Map(orders.map((order) => [order.id, order] as const)), [orders]);
  const filteredOrderIds = useMemo(() => new Set(filtered.map((order) => order.id)), [filtered]);

  const sortedDepartmentFeed = useMemo(() => {
    return departmentFeed.filter((order) => {
      const fullOrder = ordersById.get(order.orderId);
      if (fullOrder) return filteredOrderIds.has(order.orderId);
      const status = String(order.status ?? '').toUpperCase();
      const matchesStatus = statusFilter === 'all'
        || (statusFilter === 'closed' ? status === 'CLOSED' : status !== 'CLOSED');
      return matchesStatus && priorityFilter === 'all' && advancedFilterCount === 0;
    }).sort((a, b) => {
      const aOrder = ordersById.get(a.orderId);
      const bOrder = ordersById.get(b.orderId);
      const aComparable = aOrder
        ? comparableOrder(aOrder, a.activeTimerCount, departmentNameById)
        : { orderNumber: a.orderNumber, dueDate: a.dueDate, customer: a.customerName, machinist: a.assignedMachinistName, status: a.status, activeTimers: a.activeTimerCount, partCount: a.parts.length, openAddons: a.openChecklistCount };
      const bComparable = bOrder
        ? comparableOrder(bOrder, b.activeTimerCount, departmentNameById)
        : { orderNumber: b.orderNumber, dueDate: b.dueDate, customer: b.customerName, machinist: b.assignedMachinistName, status: b.status, activeTimers: b.activeTimerCount, partCount: b.parts.length, openAddons: b.openChecklistCount };
      return compareShopFloorOrders(aComparable, bComparable, displayOptions);
    });
  }, [advancedFilterCount, departmentFeed, departmentNameById, displayOptions, filteredOrderIds, ordersById, priorityFilter, statusFilter]);

  const styleForOrder = useCallback((order: OrderWithMeta, activeTimers = 0) => {
    const rule = getMatchingShopFloorRule(displayOptions.colorRules, comparableOrder(order, activeTimers || activeTimerCountsByOrder.get(order.id) || 0, departmentNameById));
    return translucentRuleStyle(rule);
  }, [activeTimerCountsByOrder, departmentNameById, displayOptions.colorRules]);


  const machinistBuckets = useMemo(() => {
    const buckets: Record<string, OrderWithMeta[]> = {};
    sorted.forEach((order) => {
      const key = order.assignedMachinist?.name ?? order.assignedMachinist?.email ?? 'Unassigned';
      buckets[key] = buckets[key] ? [...buckets[key], order] : [order];
    });
    return buckets;
  }, [sorted]);

  const departmentTouchesByOrder = useMemo(() => {
    return new Map(
      sorted.map((order) => {
        const touched = new Set<string>();
        (order.checklist ?? []).forEach((item) => {
          if (item.departmentId) touched.add(item.departmentId);
        });
        (order.parts ?? []).forEach((part) => {
          if (part.currentDepartmentId) touched.add(part.currentDepartmentId);
        });
        return [order.id, touched.size] as const;
      }),
    );
  }, [sorted]);

  const currentDepartmentLabelsByOrder = useMemo(() => {
    return new Map(
      sorted.map((order) => {
        const orderIsComplete = ['COMPLETE', 'CLOSED'].includes(String(order.status ?? '').toUpperCase());
        const labels = Array.from(
          new Set(
            (order.parts ?? [])
              .map((part) => {
                if (part.currentDepartmentId) {
                  return departmentNameById.get(part.currentDepartmentId) ?? part.currentDepartmentId;
                }
                return orderIsComplete ? null : firstDepartmentName;
              })
              .filter((value): value is string => Boolean(value))
          )
        );
        return [order.id, labels] as const;
      })
    );
  }, [departmentNameById, firstDepartmentName, sorted]);

  const updateColorRule = (id: string, patch: Partial<ShopFloorColorRuleInput>) => {
    setDisplayMessage(null);
    setDisplayOptions((current) => ({
      ...current,
      colorRules: current.colorRules.map((rule) => rule.id === id ? { ...rule, ...patch } : rule),
    }));
  };

  const addColorRule = () => {
    const id = `rule-${Date.now()}`;
    setDisplayOptions((current) => ({
      ...current,
      colorRules: [...current.colorRules, {
        id,
        label: 'New tile rule',
        field: 'priority',
        operator: 'equals',
        value: 'HOT',
        color: '#f59e0b',
        opacity: 0.24,
        enabled: true,
      }],
    }));
  };

  const saveDisplayOptions = async () => {
    setSavingDisplay(true);
    setDisplayMessage(null);
    try {
      const response = await fetch('/api/shop-floor/display-options', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(displayOptions),
      });
      if (!response.ok) throw new Error(await response.text() || 'Could not save display settings.');
      const payload = await response.json();
      setDisplayOptions(payload.options);
      setDisplayMessage('Display settings saved for this shop floor.');
    } catch (error) {
      setDisplayMessage(error instanceof Error ? error.message : 'Could not save display settings.');
    } finally {
      setSavingDisplay(false);
    }
  };

  const quickViewControls = (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Status</Label>
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
            <SelectTrigger aria-label="Quick status filter" className="h-8 w-28 rounded-md border-white/10 bg-background/35 px-3 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Priority</Label>
          <Select value={priorityFilter} onValueChange={(value) => setPriorityFilter(value as typeof priorityFilter)}>
            <SelectTrigger aria-label="Quick priority filter" className="h-8 w-28 rounded-md border-white/10 bg-background/35 px-3 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem><SelectItem value="HOT">HOT</SelectItem><SelectItem value="RUSH">RUSH</SelectItem><SelectItem value="NORMAL">NORMAL</SelectItem><SelectItem value="LOW">LOW</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Sort</Label>
          <Select value={displayOptions.sortField} onValueChange={(value) => setDisplayOptions((current) => ({ ...current, sortField: value as ShopFloorDisplayOptionsInput['sortField'] }))}>
            <SelectTrigger aria-label="Quick sort field" className="h-8 w-40 rounded-md border-white/10 bg-background/35 px-3 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{SORT_OPTIONS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Direction</Label>
          <Select value={displayOptions.sortDirection} onValueChange={(value) => setDisplayOptions((current) => ({ ...current, sortDirection: value as 'asc' | 'desc' }))}>
            <SelectTrigger aria-label="Quick sort direction" className="h-8 w-32 rounded-md border-white/10 bg-background/35 px-3 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="asc">Ascending</SelectItem><SelectItem value="desc">Descending</SelectItem></SelectContent>
          </Select>
        </div>
      </div>
      <p className="pb-1 text-[0.7rem] text-muted-foreground">
        {layout === 'workQueue' ? sortedDepartmentFeed.length : sorted.length} shown · {SORT_OPTIONS.find(([value]) => value === displayOptions.sortField)?.[1]} {displayOptions.sortDirection === 'asc' ? 'ascending' : 'descending'}{advancedFilterCount ? ` · ${advancedFilterCount} advanced filter${advancedFilterCount === 1 ? '' : 's'}` : ''}
      </p>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="shop-glass overflow-hidden rounded-lg border">
        <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-primary/70">Live production controls</p>
            <h2 className="text-xl font-semibold text-foreground">Customize this shop floor</h2>
            <p className="text-sm text-muted-foreground">Layout, advanced filters, shared tile colors, and saved TV defaults.</p>
          </div>
          <Button variant="outline" size="sm" className="rounded-md" onClick={toggleControls} aria-expanded={controlsExpanded}>
            {controlsExpanded ? <ChevronUp className="mr-2 h-4 w-4" /> : <ChevronDown className="mr-2 h-4 w-4" />}
            {controlsExpanded ? 'Collapse controls' : 'Show controls'}
          </Button>
        </div>

        {controlsExpanded ? <div className="space-y-5 border-t border-white/10 px-4 py-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Display layout</p>
          <p className="text-sm text-muted-foreground">Changes preview immediately. Save when this is how the TV should stay.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={layout === 'grid' ? 'default' : 'secondary'}
            className="rounded-md"
            size="sm"
            onClick={() => setDisplayOptions((current) => ({ ...current, layout: 'grid' }))}
          >
            <LayoutGrid className="mr-2 h-4 w-4" /> Grid digest
          </Button>
          <Button
            variant={layout === 'machinist' ? 'default' : 'secondary'}
            className="rounded-md"
            size="sm"
            onClick={() => setDisplayOptions((current) => ({ ...current, layout: 'machinist' }))}
          >
            <LayoutList className="mr-2 h-4 w-4" /> By machinist
          </Button>
          <Button
            variant={layout === 'workQueue' ? 'default' : 'secondary'}
            className="rounded-md"
            size="sm"
            onClick={() => setDisplayOptions((current) => ({ ...current, layout: 'workQueue' }))}
          >
            <Rows3 className="mr-2 h-4 w-4" /> Work queue
          </Button>
          <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="rounded-md border-border/60 bg-background/60">
                <SlidersHorizontal className="mr-2 h-4 w-4" /> Filters
                {advancedFilterCount ? <Badge variant="secondary" className="ml-2 rounded-full px-2">{advancedFilterCount}</Badge> : null}
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
                          <SelectItem key={mach.id ?? mach.email ?? 'unknown'} value={mach.id ?? mach.email ?? 'unknown'}>
                            {mach.name ?? mach.email ?? 'Unassigned'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Status</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {['RECEIVED', 'IN_PROGRESS', 'COMPLETE', 'CLOSED'].map((status) => {
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
                  <div className="flex items-center gap-4">
                    <Checkbox
                      id="sfi-requires-addons"
                      checked={filters.requiresAddons}
                      onCheckedChange={(checked) => setFilters((prev) => ({ ...prev, requiresAddons: Boolean(checked) }))}
                    />
                    <Label htmlFor="sfi-requires-addons" className="text-sm text-muted-foreground">
                      Requires addons
                    </Label>
                  </div>
                  <div className="flex items-center gap-4">
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

      {layout === 'workQueue' ? (
        <div className="shop-glass-soft space-y-3 rounded-lg border p-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Work queue department</p>
              <p className="text-sm text-muted-foreground">Choose which department owns the tile view.</p>
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Checkbox checked={includeCompleted} onCheckedChange={(value) => setIncludeCompleted(value === true)} />
              Show completed items
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            {departments.map((department) => (
              <Button key={department.id} size="sm" className="rounded-md" variant={departmentId === department.id ? 'default' : 'secondary'} onClick={() => setDepartmentId(department.id)}>
                {department.name}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Conditional tile colors</p>
            <p className="text-sm text-muted-foreground">Rules run top to bottom; the first match controls the translucent tile color.</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addColorRule} disabled={displayOptions.colorRules.length >= 12}>
            <Plus className="mr-2 h-4 w-4" /> Add color rule
          </Button>
        </div>
        <div className="space-y-3">
          {displayOptions.colorRules.map((rule) => {
            const numeric = NUMERIC_RULE_FIELDS.has(rule.field);
            return (
              <div key={rule.id} className="shop-glass-soft grid gap-3 rounded-md border p-3 lg:grid-cols-[auto_1.3fr_1fr_0.8fr_1fr_auto_auto] lg:items-end">
                <div className="flex h-10 items-center gap-2">
                  <Checkbox id={`rule-${rule.id}`} checked={rule.enabled} onCheckedChange={(checked) => updateColorRule(rule.id, { enabled: checked === true })} />
                  <Label htmlFor={`rule-${rule.id}`} className="text-xs">On</Label>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Rule name</Label>
                  <Input value={rule.label} onChange={(event) => updateColorRule(rule.id, { label: event.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Field</Label>
                  <Select value={rule.field} onValueChange={(value) => {
                    const field = value as ShopFloorRuleFieldInput;
                    updateColorRule(rule.id, { field, operator: NUMERIC_RULE_FIELDS.has(field) ? 'gte' : 'equals' });
                  }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{RULE_FIELD_OPTIONS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Match</Label>
                  <Select value={rule.operator} onValueChange={(value) => updateColorRule(rule.id, { operator: value as ShopFloorColorRuleInput['operator'] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {numeric ? <><SelectItem value="gte">At least</SelectItem><SelectItem value="lte">At most</SelectItem><SelectItem value="equals">Exactly</SelectItem></> : <><SelectItem value="equals">Equals</SelectItem><SelectItem value="contains">Contains</SelectItem></>}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Value</Label>
                  <Input type={numeric ? 'number' : 'text'} value={rule.value} onChange={(event) => updateColorRule(rule.id, { value: event.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Color</Label>
                  <Input className="h-10 w-16 p-1" type="color" value={rule.color} onChange={(event) => updateColorRule(rule.id, { color: event.target.value })} aria-label={`${rule.label} color`} />
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => setDisplayOptions((current) => ({ ...current, colorRules: current.colorRules.filter((item) => item.id !== rule.id) }))} aria-label={`Delete ${rule.label}`}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
          {!displayOptions.colorRules.length ? <p className="rounded-lg border border-dashed border-border/60 p-4 text-sm text-muted-foreground">No tile-color rules. Add one to highlight orders that need attention.</p> : null}
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {canEditDisplay ? (displayMessage ?? 'Your changes are previewed live on this page.') : 'Only an administrator can permanently save shop-floor display settings.'}
        </p>
        <Button type="button" onClick={saveDisplayOptions} disabled={!canEditDisplay || savingDisplay}>
          <Save className="mr-2 h-4 w-4" /> {savingDisplay ? 'Saving…' : 'Save for shop floor'}
        </Button>
      </div>
        </div> : null}
      </div>

      <RunningWorkersStrip workers={liveRunningWorkers} />

      {layout === 'workQueue' && (
        <div className="space-y-3 rounded-lg bg-transparent p-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{selectedDepartmentName} work queue</p>
            <p className="text-sm text-foreground">Orders currently owned by this department.</p>
          </div>
          {quickViewControls}
          {departmentError ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {departmentError}
            </div>
          ) : null}
          {departmentLoading ? (
            <p className="text-sm text-muted-foreground">Loading department feed…</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {sortedDepartmentFeed.map((order) => (
                <WorkQueueOrderCard
                  key={order.orderId}
                  order={order}
                  selectedDepartmentName={selectedDepartmentName}
                  style={ordersById.get(order.orderId) ? styleForOrder(ordersById.get(order.orderId)!, order.activeTimerCount) : undefined}
                />
              ))}
              {!departmentFeed.length && !departmentError && (
                <p className="col-span-full text-sm text-muted-foreground">No parts are currently assigned to {selectedDepartmentName}.</p>
              )}
            </div>
          )}
        </div>
      )}

      {layout === 'grid' && (
        <div className="space-y-3 rounded-lg bg-transparent p-4">
          {quickViewControls}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {sorted.map((order) => (
            <div
              key={order.id}
              className="shop-glass flex flex-col gap-3 rounded-lg border p-4 transition duration-300 hover:-translate-y-0.5 hover:border-white/25"
              style={styleForOrder(order)}
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
                    {order.assignedMachinist?.name ?? order.assignedMachinist?.email ?? 'Unassigned'}
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
                  <p className="text-xs uppercase tracking-wide">Parts</p>
                  <p className="text-foreground">{order.parts?.length ?? 0}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide">Checklist</p>
                  <p className="text-foreground">
                    {order.checklist?.length ? `${order.checklist.length - (order.openAddonCount ?? 0)}/${order.checklist.length} done` : 'None'}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide">Current department</p>
                  <p className="text-foreground">
                    {(() => {
                      const labels = currentDepartmentLabelsByOrder.get(order.id) ?? [];
                      if (!labels.length) return 'Unassigned';
                      if (labels.length === 1) return labels[0];
                      return `Mixed: ${labels.join(', ')}`;
                    })()}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide">Departments</p>
                  <p className="text-foreground">{departmentTouchesByOrder.get(order.id) ?? 0} touched</p>
                </div>
              </div>
            </div>
          ))}
          {!sorted.length && <p className="col-span-full text-sm text-muted-foreground">No orders match the filters.</p>}
          </div>
        </div>
      )}

      {layout === 'machinist' && (
        <div className="space-y-4 rounded-lg bg-transparent p-4">
          {quickViewControls}
          {Object.entries(machinistBuckets).map(([name, bucket]) => (
            <div key={name} className="shop-glass space-y-2 rounded-lg border p-4">
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
                      <TableRow key={order.id} className="border-border/60" style={styleForOrder(order)}>
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
    </div>
  );
}
