import {
  DEFAULT_SHOP_FLOOR_DISPLAY_OPTIONS,
  LegacyShopFloorDisplayOptions,
  ShopFloorDisplayOptions,
  type ShopFloorDisplayOptionsInput,
} from './shop-floor.schema';
import {
  getShopFloorDisplayOptionsJson,
  getWaitingStockSnapshot,
  listRecentShopFloorEvents,
  listShopFloorDepartmentNames,
  saveShopFloorDisplayOptionsJson,
} from './shop-floor.repo';

export type ShopFloorSummaryChange = {
  id: string;
  kind: 'DEPARTMENT' | 'MATERIAL_ARRIVED';
  orderId: string;
  orderNumber: string;
  customerName: string | null;
  partId: string;
  partNumber: string;
  partName: string | null;
  actorName: string;
  createdAt: string;
  fromLabel: string;
  toLabel: string;
  vendorName: string | null;
  message: string;
};

export type ShopFloorWaitingStockItem = {
  partId: string;
  partNumber: string;
  partName: string | null;
  orderId: string;
  orderNumber: string;
  customerName: string | null;
  vendorName: string | null;
  dueDate: string | null;
  updatedAt: string;
};

export type ShopFloorSummary = {
  recentChanges: ShopFloorSummaryChange[];
  waitingStock: {
    count: number;
    items: ShopFloorWaitingStockItem[];
  };
};

function parseEventMeta(value: string | null): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function metaText(meta: Record<string, unknown> | null, key: string) {
  const value = meta?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function actorLabel(user: { name?: string | null; email?: string | null } | null | undefined) {
  return user?.name?.trim() || user?.email?.trim() || 'System';
}

function upgradeDefaultRuleColor(options: ShopFloorDisplayOptionsInput): ShopFloorDisplayOptionsInput {
  return {
    ...options,
    colorRules: options.colorRules.map((rule) => (
      rule.id === 'overdue-seven-days' && rule.color.toLowerCase() === '#dc2626' && rule.opacity === 0.28
        ? { ...rule, color: '#7f1d1d' }
        : rule
    )),
  };
}

function upgradeLegacyDisplayOptions(
  options: ReturnType<typeof LegacyShopFloorDisplayOptions.parse>,
): ShopFloorDisplayOptionsInput {
  const usedLegacyDefaultSort = options.sortField === 'dueDate' && options.sortDirection === 'asc';
  return upgradeDefaultRuleColor({
    ...options,
    version: 2,
    sortField: usedLegacyDefaultSort ? 'createdAt' : options.sortField,
    sortDirection: usedLegacyDefaultSort ? 'desc' : options.sortDirection,
  });
}

export async function getShopFloorDisplayOptions(): Promise<ShopFloorDisplayOptionsInput> {
  const stored = await getShopFloorDisplayOptionsJson();
  if (!stored) return DEFAULT_SHOP_FLOOR_DISPLAY_OPTIONS;
  try {
    const value = JSON.parse(stored);
    const current = ShopFloorDisplayOptions.safeParse(value);
    if (current.success) return upgradeDefaultRuleColor(current.data);
    const legacy = LegacyShopFloorDisplayOptions.safeParse(value);
    return legacy.success ? upgradeLegacyDisplayOptions(legacy.data) : DEFAULT_SHOP_FLOOR_DISPLAY_OPTIONS;
  } catch {
    return DEFAULT_SHOP_FLOOR_DISPLAY_OPTIONS;
  }
}

export async function updateShopFloorDisplayOptions(input: unknown) {
  const parsed = ShopFloorDisplayOptions.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.flatten() };
  await saveShopFloorDisplayOptionsJson(JSON.stringify(parsed.data));
  return { ok: true as const, data: parsed.data };
}

export async function getShopFloorSummary(now = new Date()): Promise<ShopFloorSummary> {
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const [events, departments, waitingStock] = await Promise.all([
    listRecentShopFloorEvents(since, 60),
    listShopFloorDepartmentNames(),
    getWaitingStockSnapshot(12),
  ]);
  const departmentNames = new Map<string, string>(
    departments.map((department) => [String(department.id), String(department.name)] as const),
  );

  const recentChanges = events.flatMap((event): ShopFloorSummaryChange[] => {
    const meta = parseEventMeta(event.meta);
    const base = {
      id: event.id,
      orderId: event.order.id,
      orderNumber: event.order.orderNumber,
      customerName: event.order.customer?.name ?? null,
      partId: event.part.id,
      partNumber: event.part.partNumber,
      partName: event.part.partName ?? null,
      actorName: actorLabel(event.user),
      createdAt: event.createdAt.toISOString(),
      vendorName: event.part.procurementVendor?.name ?? null,
      message: event.message,
    };

    if (event.type === 'MATERIAL_STATUS_CHANGED') {
      const from = metaText(meta, 'fromMaterialStatus');
      const to = metaText(meta, 'toMaterialStatus');
      if (from !== 'WAITING_ON_STOCK' || to !== 'IN_STOCK') return [];
      return [{
        ...base,
        kind: 'MATERIAL_ARRIVED',
        fromLabel: 'Waiting on stock',
        toLabel: 'Material arrived',
      }];
    }

    const fromDepartmentId = metaText(meta, 'fromDepartmentId');
    const toDepartmentId = metaText(meta, 'toDepartmentId');
    return [{
      ...base,
      kind: 'DEPARTMENT',
      fromLabel: fromDepartmentId
        ? departmentNames.get(fromDepartmentId) ?? 'Unknown department'
        : 'Unassigned',
      toLabel: toDepartmentId
        ? departmentNames.get(toDepartmentId) ?? 'Unknown department'
        : 'Completed',
    }];
  }).slice(0, 30);

  return {
    recentChanges,
    waitingStock: {
      count: waitingStock.count,
      items: waitingStock.items.map((part) => ({
        partId: part.id,
        partNumber: part.partNumber,
        partName: part.partName ?? null,
        orderId: part.order.id,
        orderNumber: part.order.orderNumber,
        customerName: part.order.customer?.name ?? null,
        vendorName: part.procurementVendor?.name ?? null,
        dueDate: part.order.dueDate?.toISOString() ?? null,
        updatedAt: part.updatedAt.toISOString(),
      })),
    },
  };
}
