/**
 * Order UI utilities and types
 * Shared constants and helper functions for order display components
 */

export const ORDER_STATUS_LABELS: Record<string, string> = {
  NEW: 'New',
  RECEIVED: 'Received',
  PROGRAMMING: 'Programming',
  RUNNING: 'Running',
  INSPECTING: 'Inspecting',
  READY_FOR_ADDONS: 'Ready for addons',
  COMPLETE: 'Complete',
  CLOSED: 'Closed',
  SETUP: 'Setup',
  FINISHING: 'Finishing',
  DONE_MACHINING: 'Machining Done',
  INSPECTION: 'Inspection',
  SHIPPING: 'Shipping',
};

export const STALE_STATUS_MS = 30 * 24 * 60 * 60 * 1000;

export interface OrderFilterState {
  statuses: string[];
  priorities: string[];
  machinistId: string;
  requiresAddons: boolean;
  staleStatus: boolean;
  createdFrom?: string;
  createdTo?: string;
  dueFrom?: string;
  dueTo?: string;
  minQty?: number;
  maxQty?: number;
}

export const DEFAULT_ORDER_FILTERS: OrderFilterState = {
  statuses: [],
  priorities: [],
  machinistId: 'all',
  requiresAddons: false,
  staleStatus: false,
};

type OrderListItem = {
  id: string;
  orderNumber: string;
  status: string;
  priority: string;
  receivedDate: string | Date | null;
  dueDate: string | Date | null;
  customer?: { name?: string | null } | null;
  assignedMachinist?: { id?: string | null; name?: string | null } | null;
  parts?: Array<{ quantity?: number | null }> | null;
  checklist?: Array<{ completed?: boolean | null }> | null;
  statusHistory?: Array<{ createdAt: string | Date | null }> | null;
};

export type OrderWithMeta = OrderListItem & {
  totalQuantity: number;
  addonCount: number;
  openAddonCount: number;
  hasAddons: boolean;
  lastStatusChange: Date | null;
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
    if (!order.lastStatusChange) return false;
    const now = Date.now();
    const elapsed = now - order.lastStatusChange.getTime();
    if (elapsed < STALE_STATUS_MS) return false;
  }

  return true;
}
