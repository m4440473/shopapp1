export const CUSTOMER_ACTIVITY_FILTERS = ['all', 'active', 'recent', 'inactive', 'never'] as const;
export const CUSTOMER_SORT_FIELDS = [
  'name',
  'recentWork',
  'orders',
  'parts',
  'frequency',
  'labor',
  'activeOrders',
] as const;

export type CustomerActivityFilter = (typeof CUSTOMER_ACTIVITY_FILTERS)[number];
export type CustomerSortField = (typeof CUSTOMER_SORT_FIELDS)[number];
export type CustomerSortDirection = 'asc' | 'desc';

export type CustomerDashboardRecord = {
  id: string;
  name: string;
  primaryContact: string | null;
  contactCount: number;
  contactSummary: string;
  businessCodes: string[];
  businessNames: string[];
  totalOrders: number;
  activeOrders: number;
  partQuantity: number;
  orderFrequencyPerMonth: number;
  laborSeconds: number;
  lastWorkAt: string | null;
  searchText: string;
};

export type CustomerDashboardQuery = {
  search: string;
  business: string;
  activity: CustomerActivityFilter;
  sortField: CustomerSortField;
  sortDirection: CustomerSortDirection;
  nowMs?: number;
};

const RECENT_WORK_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;

function compareText(left: string, right: string) {
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
}
function compareNullableDate(left: string | null, right: string | null, direction: CustomerSortDirection) {
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  const result = new Date(left).getTime() - new Date(right).getTime();
  return direction === 'asc' ? result : -result;
}

function matchesActivity(customer: CustomerDashboardRecord, activity: CustomerActivityFilter, nowMs: number) {
  if (activity === 'active') return customer.activeOrders > 0;
  if (activity === 'inactive') return customer.totalOrders > 0 && customer.activeOrders === 0;
  if (activity === 'never') return customer.totalOrders === 0;
  if (activity === 'recent') {
    if (!customer.lastWorkAt) return false;
    const lastWorkMs = new Date(customer.lastWorkAt).getTime();
    return Number.isFinite(lastWorkMs) && nowMs - lastWorkMs <= RECENT_WORK_WINDOW_MS;
  }
  return true;
}

export function filterAndSortCustomers(
  customers: CustomerDashboardRecord[],
  query: CustomerDashboardQuery,
) {
  const normalizedSearch = query.search.trim().toLocaleLowerCase();
  const nowMs = query.nowMs ?? Date.now();
  const filtered = customers.filter((customer) => {
    if (normalizedSearch && !customer.searchText.includes(normalizedSearch)) return false;
    if (query.business !== 'all' && !customer.businessCodes.includes(query.business)) return false;
    return matchesActivity(customer, query.activity, nowMs);
  });

  return [...filtered].sort((left, right) => {
    let result = 0;
    switch (query.sortField) {
      case 'recentWork':
        result = compareNullableDate(left.lastWorkAt, right.lastWorkAt, query.sortDirection);
        break;
      case 'orders':
        result = left.totalOrders - right.totalOrders;
        break;
      case 'parts':
        result = left.partQuantity - right.partQuantity;
        break;
      case 'frequency':
        result = left.orderFrequencyPerMonth - right.orderFrequencyPerMonth;
        break;
      case 'labor':
        result = left.laborSeconds - right.laborSeconds;
        break;
      case 'activeOrders':
        result = left.activeOrders - right.activeOrders;
        break;
      case 'name':
      default:
        result = compareText(left.name, right.name);
        break;
    }

    if (query.sortField !== 'recentWork' && query.sortDirection === 'desc') result *= -1;
    return result || compareText(left.name, right.name);
  });
}
