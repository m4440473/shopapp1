import type {
  ShopFloorColorRuleInput,
  ShopFloorDisplayOptionsInput,
  ShopFloorRuleFieldInput,
  ShopFloorSortFieldInput,
} from './shop-floor.schema';

export type ShopFloorComparableOrder = {
  orderNumber: string;
  business?: string | null;
  dueDate?: string | Date | null;
  receivedDate?: string | Date | null;
  customer?: string | null;
  machinist?: string | null;
  department?: string | null;
  priority?: string | null;
  status?: string | null;
  quantity?: number | null;
  partCount?: number | null;
  openAddons?: number | null;
  activeTimers?: number | null;
};

const NUMERIC_FIELDS = new Set<ShopFloorRuleFieldInput>([
  'daysPastDue',
  'quantity',
  'partCount',
  'openAddons',
  'activeTimers',
]);

const PRIORITY_RANK: Record<string, number> = { HOT: 0, RUSH: 1, NORMAL: 2, LOW: 3 };

function timestamp(value: string | Date | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

export function daysPastDue(order: ShopFloorComparableOrder, now = new Date()) {
  const due = timestamp(order.dueDate);
  if (due === null || due >= now.getTime()) return 0;
  return Math.floor((now.getTime() - due) / 86_400_000);
}

export function getShopFloorFieldValue(
  order: ShopFloorComparableOrder,
  field: ShopFloorSortFieldInput | ShopFloorRuleFieldInput,
  now = new Date(),
): string | number {
  switch (field) {
    case 'daysPastDue': return daysPastDue(order, now);
    case 'dueDate': return timestamp(order.dueDate) ?? Number.MAX_SAFE_INTEGER;
    case 'receivedDate': return timestamp(order.receivedDate) ?? Number.MAX_SAFE_INTEGER;
    case 'orderNumber': return order.orderNumber;
    case 'business': return order.business ?? '';
    case 'customer': return order.customer ?? '';
    case 'machinist': return order.machinist ?? '';
    case 'department': return order.department ?? '';
    case 'priority': return PRIORITY_RANK[String(order.priority ?? '').toUpperCase()] ?? 99;
    case 'status': return order.status ?? '';
    case 'quantity': return order.quantity ?? 0;
    case 'partCount': return order.partCount ?? 0;
    case 'openAddons': return order.openAddons ?? 0;
    case 'activeTimers': return order.activeTimers ?? 0;
  }
}

export function compareShopFloorOrders(
  a: ShopFloorComparableOrder,
  b: ShopFloorComparableOrder,
  options: Pick<ShopFloorDisplayOptionsInput, 'sortField' | 'sortDirection'>,
  now = new Date(),
) {
  const aValue = getShopFloorFieldValue(a, options.sortField, now);
  const bValue = getShopFloorFieldValue(b, options.sortField, now);
  const comparison = typeof aValue === 'number' && typeof bValue === 'number'
    ? aValue - bValue
    : String(aValue).localeCompare(String(bValue), undefined, { numeric: true, sensitivity: 'base' });
  return comparison * (options.sortDirection === 'asc' ? 1 : -1);
}

export function shopFloorRuleMatches(
  rule: ShopFloorColorRuleInput,
  order: ShopFloorComparableOrder,
  now = new Date(),
) {
  if (!rule.enabled) return false;
  const actual = rule.field === 'priority'
    ? order.priority ?? ''
    : getShopFloorFieldValue(order, rule.field, now);
  if (NUMERIC_FIELDS.has(rule.field)) {
    const expected = Number(rule.value);
    if (!Number.isFinite(expected) || typeof actual !== 'number') return false;
    if (rule.operator === 'gte') return actual >= expected;
    if (rule.operator === 'lte') return actual <= expected;
    return actual === expected;
  }

  const actualText = String(actual).trim().toLowerCase();
  const expectedText = rule.value.trim().toLowerCase();
  if (rule.operator === 'contains') return actualText.includes(expectedText);
  return actualText === expectedText;
}

export function getMatchingShopFloorRule(
  rules: ShopFloorColorRuleInput[],
  order: ShopFloorComparableOrder,
  now = new Date(),
) {
  return rules.find((rule) => shopFloorRuleMatches(rule, order, now)) ?? null;
}

export function translucentRuleStyle(rule: ShopFloorColorRuleInput | null) {
  if (!rule) return undefined;
  const hex = rule.color.slice(1);
  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  return {
    backgroundColor: `rgba(${red}, ${green}, ${blue}, ${rule.opacity})`,
    borderColor: `rgba(${red}, ${green}, ${blue}, ${Math.min(rule.opacity + 0.35, 0.9)})`,
  };
}
