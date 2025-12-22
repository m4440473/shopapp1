import { ORDER_STATUS_LABELS } from '@/lib/order-status-labels';

export const STALE_STATUS_MS = 30 * 24 * 60 * 60 * 1000;

export type OrderListItem = {
  id: string;
  orderNumber: string;
  business: string;
  status: string;
  priority: string;
  dueDate: string | Date | null;
  receivedDate: string | Date | null;
  customer?: { name?: string | null } | null;
  assignedMachinist?: { id?: string; name?: string | null; email?: string | null } | null;
  parts?: Array<{ quantity: number | null }>;
  checklist?: Array<{ completed: boolean; addon?: { name?: string | null } | null }>;
  statusHistory?: Array<{ createdAt: string | Date }>;
};

export type OrderWithMeta = OrderListItem & {
  totalQuantity: number;
  addonCount: number;
  openAddonCount: number;
  hasAddons: boolean;
  lastStatusChange: Date | null;
};

export type OrderFilterState = {
  statuses: string[];
  priorities: string[];
  machinistId: string;
  createdFrom?: string;
  createdTo?: string;
  dueFrom?: string;
  dueTo?: string;
  minQty?: number;
  maxQty?: number;
  requiresAddons: boolean;
  staleStatus: boolean;
};

export const DEFAULT_ORDER_FILTERS: OrderFilterState = {
  statuses: [],
  priorities: [],
  machinistId: 'all',
  requiresAddons: false,
  staleStatus: false,
};

function parseDate(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function decorateOrder(order: OrderListItem): OrderWithMeta {
  const totalQuantity = (order.parts ?? []).reduce((sum, part) => sum + (part.quantity ?? 0), 0);
  const addonCount = order.checklist?.length ?? 0;
  const openAddonCount = order.checklist?.filter((item) => !item.completed).length ?? 0;
  const latestStatusHistory = order.statusHistory?.[0];
  const lastStatusChange = latestStatusHistory ? parseDate(latestStatusHistory.createdAt) : parseDate(order.receivedDate);

  return {
    ...order,
    totalQuantity,
    addonCount,
    openAddonCount,
    hasAddons: addonCount > 0,
    lastStatusChange,
  };
}

export function formatStatusLabel(status: string) {
  return ORDER_STATUS_LABELS[status] ?? status.replace(/_/g, ' ');
}

export function orderMatchesFilters(
  order: OrderWithMeta,
  filters: OrderFilterState,
  quickStatus: 'all' | 'active' | 'closed',
  priorityFilter: string,
) {
  if (quickStatus === 'active' && order.status === 'CLOSED') return false;
  if (quickStatus === 'closed' && order.status !== 'CLOSED') return false;
  if (filters.statuses.length > 0 && !filters.statuses.includes(order.status)) return false;

  if (priorityFilter !== 'all' && order.priority !== priorityFilter) return false;
  if (filters.priorities.length > 0 && !filters.priorities.includes(order.priority)) return false;

  if (filters.machinistId !== 'all') {
    if (filters.machinistId === '__unassigned__' && order.assignedMachinist?.id) return false;
    if (filters.machinistId !== '__unassigned__' && order.assignedMachinist?.id !== filters.machinistId) return false;
  }

  const created = parseDate(order.receivedDate);
  if (filters.createdFrom) {
    const fromDate = new Date(filters.createdFrom);
    if (created && created < fromDate) return false;
  }
  if (filters.createdTo) {
    const toDate = new Date(filters.createdTo);
    if (created && created > toDate) return false;
  }

  const due = parseDate(order.dueDate);
  if (filters.dueFrom) {
    const fromDate = new Date(filters.dueFrom);
    if (due && due < fromDate) return false;
  }
  if (filters.dueTo) {
    const toDate = new Date(filters.dueTo);
    if (due && due > toDate) return false;
  }

  if (typeof filters.minQty === 'number' && order.totalQuantity < filters.minQty) return false;
  if (typeof filters.maxQty === 'number' && order.totalQuantity > filters.maxQty) return false;

  if (filters.requiresAddons && !order.hasAddons) return false;

  if (filters.staleStatus) {
    const lastChange = order.lastStatusChange?.getTime();
    if (!lastChange) return false;
    if (Date.now() - lastChange < STALE_STATUS_MS) return false;
  }

  return true;
}
