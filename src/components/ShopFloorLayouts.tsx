"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Activity, CalendarDays, ChevronDown, ChevronUp, Flame, LayoutGrid, LayoutList, MoreVertical, PackageCheck, Plus, Save, SlidersHorizontal, Trash2, Users } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { BUSINESS_OPTIONS } from '@/lib/businesses';
import { decorateOrder, DEFAULT_ORDER_FILTERS, formatStatusLabel, getOrderMachinistLabel, orderMatchesFilters } from '@/modules/orders/orders.shared';
import type { DepartmentFeedOrder, OrderWithMeta } from '@/modules/orders/orders.types';
import { WorkQueueOrderCard } from '@/components/work-queue/WorkQueueOrderCard';
import {
  RunningWorkersStrip,
  type RunningWorkerSummary,
} from '@/components/work-queue/RunningWorkersStrip';
import {
  compareShopFloorOrders,
  getMatchingShopFloorRule,
  matchesShopFloorBusiness,
  translucentRuleStyle,
  type ShopFloorComparableOrder,
} from '@/modules/shop-floor/shop-floor.shared';
import type {
  ShopFloorColorRuleInput,
  ShopFloorDisplayOptionsInput,
  ShopFloorRuleFieldInput,
} from '@/modules/shop-floor/shop-floor.schema';
import type { ShopFloorSummary } from '@/modules/shop-floor/shop-floor.service';

type LayoutOption = 'grid' | 'machinist' | 'workQueue';

type Props = {
  orders: OrderWithMeta[];
  machinists: Array<{ id: string | null; name?: string | null; email?: string | null }>;
  departments: Array<{ id: string; name: string; sortOrder?: number | null }>;
  initialDepartmentId: string | null;
  initialDepartmentFeed: DepartmentFeedOrder[];
  runningWorkers?: RunningWorkerSummary[];
  initialDisplayOptions: ShopFloorDisplayOptionsInput;
  initialSummary: ShopFloorSummary;
  canEditDisplay: boolean;
  listSummary: {
    activeOrders: number;
    totalOrders: number;
    dueSoon: number;
    unassigned: number;
    machinistWorkload: Array<{ name: string; count: number }>;
  };
};

const SORT_OPTIONS = [
  ['createdAt', 'Created date'], ['dueDate', 'Due date'], ['daysPastDue', 'Days past due'], ['receivedDate', 'Received date'],
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
    createdAt: order.createdAt,
    business: order.business,
    dueDate: order.dueDate,
    receivedDate: order.receivedDate,
    customer: order.customer?.name,
    machinist: getOrderMachinistLabel(order),
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
  initialSummary,
  canEditDisplay,
  listSummary,
}: Props) {
  const router = useRouter();
  const [displayOptions, setDisplayOptions] = useState<ShopFloorDisplayOptionsInput>({
    ...initialDisplayOptions,
    layout: 'grid',
  });
  const [timersExpanded, setTimersExpanded] = useState(false);
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const [moreExpanded, setMoreExpanded] = useState(false);
  const [liveSummary, setLiveSummary] = useState(initialSummary);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [savingDisplay, setSavingDisplay] = useState(false);
  const [displayMessage, setDisplayMessage] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'closed'>('active');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [businessFilter, setBusinessFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'HOT' | 'RUSH' | 'NORMAL' | 'LOW'>('all');
  const [filters, setFilters] = useState({ ...DEFAULT_ORDER_FILTERS });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [departmentId, setDepartmentId] = useState(initialDepartmentId ?? '');
  const [departmentFeed, setDepartmentFeed] = useState(initialDepartmentFeed ?? []);
  const [departmentLoading, setDepartmentLoading] = useState(false);
  const [departmentError, setDepartmentError] = useState<string | null>(null);
  const [includeCompleted, setIncludeCompleted] = useState(false);
  const [liveRunningWorkers, setLiveRunningWorkers] = useState(runningWorkers);
  const [adminMachinists, setAdminMachinists] = useState(machinists);
  const [tileEditor, setTileEditor] = useState({
    open: false,
    orderId: '',
    priority: 'NORMAL',
    status: 'RECEIVED',
    machinistId: '',
    reason: '',
    saving: false,
    error: null as string | null,
  });

  const layout: LayoutOption = displayOptions.layout;

  useEffect(() => {
    setDepartmentId(initialDepartmentId ?? '');
    setDepartmentFeed(initialDepartmentFeed ?? []);
  }, [initialDepartmentId, initialDepartmentFeed]);

  useEffect(() => {
    setLiveRunningWorkers(runningWorkers);
  }, [runningWorkers]);

  useEffect(() => {
    setLiveSummary(initialSummary);
  }, [initialSummary]);

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const response = await fetch('/api/shop-floor/summary', { credentials: 'include' });
      if (!response.ok) throw new Error('Could not refresh the shop floor summary.');
      const payload = await response.json();
      if (payload?.summary) setLiveSummary(payload.summary);
      setSummaryError(null);
    } catch (error) {
      setSummaryError(error instanceof Error ? error.message : 'Could not refresh the shop floor summary.');
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!summaryExpanded) return;
    void loadSummary();
    const timer = window.setInterval(() => void loadSummary(), 30_000);
    return () => window.clearInterval(timer);
  }, [loadSummary, summaryExpanded]);

  useEffect(() => {
    if (!canEditDisplay) return;
    let active = true;
    const loadMachinists = async () => {
      try {
        const res = await fetch('/api/admin/users?role=MACHINIST&take=100', { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        const raw = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
        if (!active) return;
        setAdminMachinists(
          raw
            .map((user: any) => ({
              id: String(user?.id ?? ''),
              name: typeof user?.name === 'string' ? user.name : null,
              email: typeof user?.email === 'string' ? user.email : null,
            }))
            .filter((user: { id: string }) => user.id.length > 0),
        );
      } catch {
        if (active) setAdminMachinists(machinists);
      }
    };
    void loadMachinists();
    return () => {
      active = false;
    };
  }, [canEditDisplay, machinists]);

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
    const firstDepartmentId = departments[0]?.id ?? null;
    return decoratedOrders.filter((order) => {
      if (!orderMatchesFilters(order, { ...filters, machinistId: filters.machinistId ?? 'all' }, statusFilter, priorityFilter)) {
        return false;
      }
      if (!matchesShopFloorBusiness(order.business, businessFilter)) return false;
      if (departmentFilter === 'all') return true;

      const orderIsComplete = ['COMPLETE', 'CLOSED'].includes(String(order.status ?? '').toUpperCase());
      const currentDepartmentIds = new Set(
        (order.parts ?? [])
          .map((part) => part.currentDepartmentId ?? (!orderIsComplete ? firstDepartmentId : null))
          .filter((value): value is string => Boolean(value)),
      );
      if (departmentFilter === '__unassigned__') return currentDepartmentIds.size === 0;
      return currentDepartmentIds.has(departmentFilter);
    });
  }, [businessFilter, departmentFilter, departments, filters, orders, priorityFilter, statusFilter]);

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

  const openTileEditor = (order: OrderWithMeta) => {
    setTileEditor({
      open: true,
      orderId: order.id,
      priority: order.priority ?? 'NORMAL',
      status: order.status ?? 'RECEIVED',
      machinistId: order.assignedMachinist?.id ?? '',
      reason: '',
      saving: false,
      error: null,
    });
  };

  const saveTileEditor = async () => {
    const original = orders.find((order) => order.id === tileEditor.orderId);
    if (!original || tileEditor.saving) return;
    const statusChanged = tileEditor.status !== original.status;
    if (statusChanged && !tileEditor.reason.trim()) {
      setTileEditor((current) => ({ ...current, error: 'A reason is required when changing status.' }));
      return;
    }
    setTileEditor((current) => ({ ...current, saving: true, error: null }));
    try {
      if (tileEditor.priority !== original.priority) {
        const response = await fetch(`/api/orders/${original.id}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ priority: tileEditor.priority }),
        });
        if (!response.ok) throw new Error('Could not update priority.');
      }
      if ((tileEditor.machinistId || '') !== (original.assignedMachinist?.id || '')) {
        const response = await fetch(`/api/orders/${original.id}/assign`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ machinistId: tileEditor.machinistId }),
        });
        if (!response.ok) throw new Error('Could not update assigned machinist.');
      }
      if (statusChanged) {
        const response = await fetch(`/api/orders/${original.id}/status`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: tileEditor.status, reason: tileEditor.reason.trim() }),
        });
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(typeof body?.error === 'string' ? body.error : 'Could not update status.');
        }
      }
      setTileEditor((current) => ({ ...current, open: false, saving: false, error: null }));
      router.refresh();
    } catch (error) {
      setTileEditor((current) => ({
        ...current,
        saving: false,
        error: error instanceof Error ? error.message : 'Could not update this order.',
      }));
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
          <Label className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Department</Label>
          <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
            <SelectTrigger aria-label="Quick department filter" className="h-8 w-36 rounded-md border-white/10 bg-background/35 px-3 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="__unassigned__">Unassigned</SelectItem>
              {departments.map((department) => (
                <SelectItem key={department.id} value={department.id}>{department.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Business</Label>
          <Select value={businessFilter} onValueChange={setBusinessFilter}>
            <SelectTrigger aria-label="Quick business filter" className="h-8 w-40 rounded-md border-white/10 bg-background/35 px-3 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {BUSINESS_OPTIONS.map((business) => (
                <SelectItem key={business.code} value={business.code}>{business.name}</SelectItem>
              ))}
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
        <div className="space-y-1">
          <Label className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">View</Label>
          <div className="flex h-8 overflow-hidden rounded-md border border-white/10 bg-background/35" role="group" aria-label="Shop floor view">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={`h-8 rounded-none border-r border-white/10 px-3 text-xs ${layout === 'grid' ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground' : ''}`}
              onClick={() => setDisplayOptions((current) => ({ ...current, layout: 'grid' }))}
              aria-pressed={layout === 'grid'}
            >
              <LayoutGrid className="mr-1.5 h-3.5 w-3.5" /> Tiles
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={`h-8 rounded-none border-r border-white/10 px-3 text-xs ${layout === 'machinist' ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground' : ''}`}
              onClick={() => setDisplayOptions((current) => ({ ...current, layout: 'machinist' }))}
              aria-pressed={layout === 'machinist'}
            >
              <LayoutList className="mr-1.5 h-3.5 w-3.5" /> List
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={`h-8 rounded-none border-r border-white/10 px-3 text-xs ${timersExpanded ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground' : ''}`}
              onClick={() => setTimersExpanded((current) => !current)}
              aria-expanded={timersExpanded}
              aria-controls="shop-floor-timers"
            >
              <Activity className="mr-1.5 h-3.5 w-3.5" /> Timers
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={`h-8 rounded-none border-r border-white/10 px-3 text-xs ${summaryExpanded ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground' : ''}`}
              onClick={() => setSummaryExpanded((current) => !current)}
              aria-expanded={summaryExpanded}
              aria-controls="shop-floor-summary"
            >
              <PackageCheck className="mr-1.5 h-3.5 w-3.5" /> Summary
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={`h-8 rounded-none px-3 text-xs ${moreExpanded ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground' : ''}`}
              onClick={() => setMoreExpanded((current) => !current)}
              aria-expanded={moreExpanded}
              aria-controls="shop-floor-more"
            >
              More {moreExpanded ? <ChevronUp className="ml-1.5 h-3.5 w-3.5" /> : <ChevronDown className="ml-1.5 h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      </div>
      <p className="pb-1 text-[0.7rem] text-muted-foreground">
        {sorted.length} shown · {SORT_OPTIONS.find(([value]) => value === displayOptions.sortField)?.[1]} {displayOptions.sortDirection === 'asc' ? 'ascending' : 'descending'}{advancedFilterCount ? ` · ${advancedFilterCount} advanced filter${advancedFilterCount === 1 ? '' : 's'}` : ''}
      </p>
    </div>
  );

  return (
    <div className="space-y-4">
      {quickViewControls}

      <Dialog
        open={tileEditor.open}
        onOpenChange={(open) => setTileEditor((current) => ({ ...current, open, error: null }))}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Manage order</DialogTitle>
            <DialogDescription>
              Admin tile actions update priority, workflow status, and the order coordinator.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="tile-order-priority">Priority</Label>
                <Select value={tileEditor.priority} onValueChange={(priority) => setTileEditor((current) => ({ ...current, priority, error: null }))}>
                  <SelectTrigger id="tile-order-priority"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="NORMAL">Normal</SelectItem>
                    <SelectItem value="RUSH">Rush</SelectItem>
                    <SelectItem value="HOT">Hot</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="tile-order-status">Status</Label>
                <Select value={tileEditor.status} onValueChange={(status) => setTileEditor((current) => ({ ...current, status, error: null }))}>
                  <SelectTrigger id="tile-order-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RECEIVED">Received</SelectItem>
                    <SelectItem value="IN_PROGRESS">In progress</SelectItem>
                    <SelectItem value="COMPLETE">Complete</SelectItem>
                    <SelectItem value="CLOSED">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tile-order-machinist">Assigned machinist</Label>
              <Select value={tileEditor.machinistId || '__none__'} onValueChange={(machinistId) => setTileEditor((current) => ({ ...current, machinistId: machinistId === '__none__' ? '' : machinistId, error: null }))}>
                <SelectTrigger id="tile-order-machinist"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Unassigned</SelectItem>
                  {adminMachinists.map((machinist) => (
                    <SelectItem key={machinist.id} value={machinist.id}>
                      {machinist.name ?? machinist.email ?? 'Unnamed machinist'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {orders.find((order) => order.id === tileEditor.orderId)?.status !== tileEditor.status ? (
              <div className="grid gap-2">
                <Label htmlFor="tile-order-status-reason">Reason for status change</Label>
                <Input
                  id="tile-order-status-reason"
                  value={tileEditor.reason}
                  onChange={(event) => setTileEditor((current) => ({ ...current, reason: event.target.value, error: null }))}
                  placeholder="Required for the order history"
                />
              </div>
            ) : null}
            {tileEditor.error ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{tileEditor.error}</div>
            ) : null}
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setTileEditor((current) => ({ ...current, open: false, error: null }))} disabled={tileEditor.saving}>Cancel</Button>
            <Button
              type="button"
              onClick={() => void saveTileEditor()}
              disabled={
                tileEditor.saving ||
                (orders.find((order) => order.id === tileEditor.orderId)?.status !== tileEditor.status && !tileEditor.reason.trim())
              }
            >
              {tileEditor.saving ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {timersExpanded ? (
        <div id="shop-floor-timers">
          <RunningWorkersStrip workers={liveRunningWorkers} />
        </div>
      ) : null}

      {summaryExpanded ? (
        <section id="shop-floor-summary" className="shop-glass overflow-hidden rounded-lg border" aria-label="Recent shop floor summary">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-primary/70">Recent shop movement</p>
              <h2 className="text-lg font-semibold text-foreground">Shop Floor summary</h2>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{liveSummary.waitingStock.count} waiting on stock</span>
              <Button type="button" variant="outline" size="sm" onClick={() => void loadSummary()} disabled={summaryLoading}>
                {summaryLoading ? 'Refreshing…' : 'Refresh'}
              </Button>
            </div>
          </div>
          {summaryError ? (
            <div className="border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">{summaryError}</div>
          ) : null}
          <div className="grid gap-0 lg:grid-cols-[minmax(18rem,0.8fr)_minmax(24rem,1.2fr)]">
            <div className="border-b border-white/10 p-4 lg:border-b-0 lg:border-r">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-foreground">Waiting on stock to arrive</h3>
                <Badge variant="outline" className="border-amber-400/40 bg-amber-400/10 text-amber-100">{liveSummary.waitingStock.count}</Badge>
              </div>
              <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                {liveSummary.waitingStock.items.map((part) => (
                  <Link
                    key={part.partId}
                    href={`/orders/${part.orderId}?part=${part.partId}`}
                    className="shop-glass-soft block rounded-md border p-3 transition hover:border-amber-300/40"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">#{part.orderNumber} · {part.partNumber}</p>
                        <p className="truncate text-xs text-muted-foreground">{part.partName || part.customerName || 'Unnamed part'}</p>
                      </div>
                      <span className="shrink-0 text-[0.68rem] text-amber-100">{part.vendorName || 'Vendor not set'}</span>
                    </div>
                    <p className="mt-2 text-[0.68rem] text-muted-foreground">
                      {part.dueDate ? `Due ${new Date(part.dueDate).toLocaleDateString()}` : 'No due date'}
                    </p>
                  </Link>
                ))}
                {!liveSummary.waitingStock.items.length ? (
                  <p className="rounded-md border border-dashed border-white/10 px-3 py-5 text-center text-sm text-muted-foreground">No active parts are waiting on stock.</p>
                ) : null}
                {liveSummary.waitingStock.count > liveSummary.waitingStock.items.length ? (
                  <p className="text-center text-xs text-muted-foreground">
                    Showing {liveSummary.waitingStock.items.length} of {liveSummary.waitingStock.count}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="p-4">
              <h3 className="mb-3 text-sm font-semibold text-foreground">Department changes and material arrivals</h3>
              <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                {liveSummary.recentChanges.map((change) => (
                  <Link
                    key={change.id}
                    href={`/orders/${change.orderId}?part=${change.partId}`}
                    className="shop-glass-soft flex flex-col gap-2 rounded-md border p-3 transition hover:border-primary/40 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={change.kind === 'MATERIAL_ARRIVED' ? 'bg-emerald-500/15 text-emerald-100' : 'bg-primary/15 text-primary-foreground'}>
                          {change.kind === 'MATERIAL_ARRIVED' ? 'Stock arrived' : 'Department'}
                        </Badge>
                        <span className="text-sm font-semibold text-foreground">#{change.orderNumber} · {change.partNumber}</span>
                      </div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {change.fromLabel} → {change.toLabel}
                        {change.kind === 'MATERIAL_ARRIVED' && change.vendorName ? ` · ${change.vendorName}` : ''}
                      </p>
                    </div>
                    <div className="shrink-0 text-left text-[0.68rem] text-muted-foreground sm:text-right">
                      <p>{change.actorName}</p>
                      <p>{new Date(change.createdAt).toLocaleString()}</p>
                    </div>
                  </Link>
                ))}
                {!liveSummary.recentChanges.length ? (
                  <p className="rounded-md border border-dashed border-white/10 px-3 py-5 text-center text-sm text-muted-foreground">No department changes or stock arrivals in the last seven days.</p>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {moreExpanded ? <div id="shop-floor-more" className="space-y-4">
      <div className="shop-glass overflow-hidden rounded-lg border">
        <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-primary/70">Live production controls</p>
            <h2 className="text-xl font-semibold text-foreground">Customize this shop floor</h2>
            <p className="text-sm text-muted-foreground">Advanced filters, shared tile colors, and saved TV defaults.</p>
          </div>
        </div>

        <div className="space-y-5 border-t border-white/10 px-4 py-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Advanced display</p>
          <p className="text-sm text-muted-foreground">Filters and color changes preview immediately. Save when this is how the TV should stay.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
                <span>Filters combine with the quick status, department, and priority pickers.</span>
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
        </div>
      </div>
      </div> : null}

      {layout === 'workQueue' && (
        <div className="space-y-3 rounded-lg bg-transparent p-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{selectedDepartmentName} work queue</p>
            <p className="text-sm text-foreground">Orders currently owned by this department.</p>
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
                <div className="flex items-center gap-2">
                  {order.priority === 'HOT' ? (
                    <Flame className="h-5 w-5 fill-orange-500/25 text-orange-400" aria-label="Hot priority" />
                  ) : null}
                  <Badge variant="outline" className="rounded-full px-3 py-1 text-[0.7rem] uppercase tracking-wide">
                    {formatStatusLabel(order.status)}
                  </Badge>
                  {canEditDisplay ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 rounded-md p-0 text-muted-foreground hover:text-foreground"
                      onClick={() => openTileEditor(order)}
                      aria-label={`Manage order ${order.orderNumber}`}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                <div>
                  <p className="text-xs uppercase tracking-wide">Customer</p>
                  <p className="text-foreground">{order.customer?.name ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide">Machinist</p>
                  <p className="text-foreground">{getOrderMachinistLabel(order)}</p>
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
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Card className="shop-glass h-full min-h-[7rem] rounded-lg">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 pb-1 pt-3">
                <CardTitle className="text-xs font-medium">Active orders</CardTitle>
                <Activity className="h-3.5 w-3.5 text-muted-foreground" />
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <div className="text-xl font-semibold">{listSummary.activeOrders}</div>
                <p className="text-[0.7rem] leading-4 text-muted-foreground">{listSummary.totalOrders} total records in the shop</p>
              </CardContent>
            </Card>
            <Card className="shop-glass h-full min-h-[7rem] rounded-lg">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 pb-1 pt-3">
                <CardTitle className="text-xs font-medium">Due within 7 days</CardTitle>
                <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <div className="text-xl font-semibold">{listSummary.dueSoon}</div>
                <p className="text-[0.7rem] leading-4 text-muted-foreground">Stay ahead of the hot jobs</p>
              </CardContent>
            </Card>
            <Card className="shop-glass h-full min-h-[7rem] rounded-lg">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 pb-1 pt-3">
                <CardTitle className="text-xs font-medium">Unassigned tickets</CardTitle>
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <div className="text-xl font-semibold">{listSummary.unassigned}</div>
                <p className="text-[0.7rem] leading-4 text-muted-foreground">Waiting for a machinist</p>
              </CardContent>
            </Card>
            <Card className="shop-glass h-full min-h-[7rem] rounded-lg">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 pb-1 pt-3">
                <CardTitle className="text-xs font-medium">Machinist workload</CardTitle>
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
              </CardHeader>
              <CardContent className="space-y-0.5 px-4 pb-3">
                {listSummary.machinistWorkload.slice(0, 3).map((machinist) => (
                  <div key={machinist.name} className="flex items-center justify-between gap-3 text-[0.7rem] leading-4">
                    <span className="truncate text-muted-foreground">{machinist.name}</span>
                    <span className="shrink-0 font-semibold text-foreground">{machinist.count}</span>
                  </div>
                ))}
                {!listSummary.machinistWorkload.length ? (
                  <p className="text-[0.7rem] leading-4 text-muted-foreground">No assigned work</p>
                ) : null}
              </CardContent>
            </Card>
          </div>

          <div className="shop-glass overflow-x-auto rounded-lg border">
            <Table>
            <TableHeader>
              <TableRow className="border-white/10">
                <TableHead>Order</TableHead>
                <TableHead className="hidden md:table-cell">Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden lg:table-cell">Machinist</TableHead>
                <TableHead className="hidden xl:table-cell">Priority</TableHead>
                <TableHead className="text-right">Due</TableHead>
                <TableHead className="hidden sm:table-cell text-right">Qty</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((order) => (
                <TableRow key={order.id} className="border-white/10 transition hover:bg-white/[0.045]" style={styleForOrder(order)}>
                  <TableCell>
                    <div className="flex flex-col">
                      <Link href={`/orders/${order.id}`} className="text-sm font-semibold text-primary hover:underline">
                        #{order.orderNumber}
                      </Link>
                      <span className="text-xs text-muted-foreground">
                        Received {order.receivedDate ? new Date(order.receivedDate).toLocaleDateString() : 'TBD'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{order.customer?.name ?? '—'}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="border-primary/40 bg-primary/10 text-[0.7rem] uppercase tracking-wide">
                      {formatStatusLabel(order.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                    {getOrderMachinistLabel(order)}
                  </TableCell>
                  <TableCell className="hidden xl:table-cell text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      {order.priority === 'HOT' ? <Flame className="h-4 w-4 fill-orange-500/25 text-orange-400" aria-label="Hot priority" /> : null}
                      {order.priority}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {order.dueDate ? new Date(order.dueDate).toLocaleDateString() : 'TBD'}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-right text-sm text-muted-foreground">{order.totalQuantity ?? 0}</TableCell>
                </TableRow>
              ))}
              {!sorted.length ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">No orders match the filters.</TableCell>
                </TableRow>
              ) : null}
            </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
