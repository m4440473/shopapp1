import { businessNameFromCode } from '@/lib/businesses';
import type { CustomerDashboardRecord } from './customer-dashboard.shared';

type DashboardContact = {
  name: string;
  title?: string | null;
  phone?: string | null;
  email?: string | null;
  isPrimary: boolean;
};

type DashboardTimeEntry = {
  startedAt: Date;
  endedAt: Date | null;
};

type DashboardOrder = {
  status: string;
  receivedDate: Date;
  createdAt: Date;
  parts: Array<{ quantity: number }>;
  timeEntries: DashboardTimeEntry[];
};

type DashboardCustomer = {
  id: string;
  name: string;
  contact?: string | null;
  phone?: string | null;
  fax?: string | null;
  email?: string | null;
  address?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  stateProvince?: string | null;
  postalCode?: string | null;
  country?: string | null;
  contacts: DashboardContact[];
  businesses: Array<{ businessCode: string }>;
  orders: DashboardOrder[];
};

const MONTH_MS = 30.4375 * 24 * 60 * 60 * 1000;

function validTimestamp(date: Date | null | undefined) {
  const timestamp = date?.getTime() ?? Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : null;
}
function intervalSeconds(entry: DashboardTimeEntry, nowMs: number) {
  const startedAt = validTimestamp(entry.startedAt);
  const endedAt = entry.endedAt ? validTimestamp(entry.endedAt) : nowMs;
  if (startedAt === null || endedAt === null || endedAt <= startedAt) return 0;
  return Math.floor((endedAt - startedAt) / 1000);
}

export function buildCustomerDashboardRecords(
  customers: DashboardCustomer[],
  now = new Date(),
): CustomerDashboardRecord[] {
  const nowMs = now.getTime();
  return customers.map((customer) => {
    const primaryContact = customer.contacts.find((contact) => contact.isPrimary) ?? customer.contacts[0] ?? null;
    const orderDates = customer.orders
      .map((order) => validTimestamp(order.receivedDate) ?? validTimestamp(order.createdAt))
      .filter((date): date is number => date !== null);
    const activityDates = customer.orders.flatMap((order) => [
      validTimestamp(order.receivedDate),
      validTimestamp(order.createdAt),
      ...order.timeEntries.flatMap((entry) => [validTimestamp(entry.startedAt), validTimestamp(entry.endedAt)]),
    ]).filter((date): date is number => date !== null);
    const earliestOrderAt = orderDates.length ? Math.min(...orderDates) : null;
    const latestOrderAt = orderDates.length ? Math.max(...orderDates) : null;
    const activeMonths = earliestOrderAt === null || latestOrderAt === null
      ? 0
      : Math.max(1, (latestOrderAt - earliestOrderAt) / MONTH_MS);
    const businessCodes = customer.businesses.map((business) => business.businessCode);
    const businessNames = businessCodes.map((code) => businessNameFromCode(code));
    const totalOrders = customer.orders.length;
    const contactSummary = customer.contacts
      .flatMap((contact) => [contact.name, contact.title, contact.phone, contact.email])
      .filter(Boolean)
      .join(' ');
    const searchText = [
      customer.name,
      customer.contact,
      customer.phone,
      customer.fax,
      customer.email,
      customer.address,
      customer.addressLine1,
      customer.addressLine2,
      customer.city,
      customer.stateProvince,
      customer.postalCode,
      customer.country,
      contactSummary,
      ...businessCodes,
      ...businessNames,
    ].filter(Boolean).join(' ').toLocaleLowerCase();

    return {
      id: customer.id,
      name: customer.name,
      primaryContact: primaryContact?.name ?? customer.contact ?? null,
      contactCount: customer.contacts.length || (customer.contact ? 1 : 0),
      contactSummary,
      businessCodes,
      businessNames,
      totalOrders,
      activeOrders: customer.orders.filter((order) => order.status !== 'CLOSED').length,
      partQuantity: customer.orders.reduce(
        (orderTotal, order) => orderTotal + order.parts.reduce((partTotal, part) => partTotal + Math.max(0, part.quantity), 0),
        0,
      ),
      orderFrequencyPerMonth: totalOrders && activeMonths ? totalOrders / activeMonths : 0,
      laborSeconds: customer.orders.reduce(
        (orderTotal, order) => orderTotal + order.timeEntries.reduce(
          (entryTotal, entry) => entryTotal + intervalSeconds(entry, nowMs),
          0,
        ),
        0,
      ),
      lastWorkAt: activityDates.length ? new Date(Math.max(...activityDates)).toISOString() : null,
      searchText,
    };
  });
}
