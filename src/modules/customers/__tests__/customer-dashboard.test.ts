import { describe, expect, it } from 'vitest';

import { buildCustomerDashboardRecords } from '../customer-dashboard';
import {
  filterAndSortCustomers,
  type CustomerDashboardQuery,
  type CustomerDashboardRecord,
  type CustomerSortField,
} from '../customer-dashboard.shared';

function record(overrides: Partial<CustomerDashboardRecord> & Pick<CustomerDashboardRecord, 'id' | 'name'>): CustomerDashboardRecord {
  return {
    primaryContact: null,
    contactCount: 0,
    contactSummary: '',
    businessCodes: [],
    businessNames: [],
    totalOrders: 0,
    activeOrders: 0,
    partQuantity: 0,
    orderFrequencyPerMonth: 0,
    laborSeconds: 0,
    lastWorkAt: null,
    searchText: overrides.name.toLocaleLowerCase(),
    ...overrides,
  };
}

const baseQuery: CustomerDashboardQuery = {
  search: '',
  business: 'all',
  activity: 'all',
  sortField: 'name',
  sortDirection: 'asc',
  nowMs: new Date('2026-08-26T12:00:00Z').getTime(),
};

describe('customer dashboard metrics', () => {
  it('derives order, part, frequency, active-work, labor, contact, and latest-work metrics', () => {
    const [customer] = buildCustomerDashboardRecords([{
      id: 'toyota',
      name: 'Toyota Motor Manufacturing',
      city: 'Georgetown',
      contacts: [
        { name: 'Buyer One', title: 'Buyer', phone: '555-0100', email: 'buyer@toyota.test', isPrimary: true },
        { name: 'Engineer Two', title: null, phone: null, email: null, isPrimary: false },
      ],
      businesses: [{ businessCode: 'STD' }, { businessCode: 'CRM' }],
      orders: [
        {
          status: 'IN_PROGRESS',
          receivedDate: new Date('2026-06-01T12:00:00Z'),
          createdAt: new Date('2026-06-01T12:00:00Z'),
          parts: [{ quantity: 3 }, { quantity: 2 }],
          timeEntries: [
            { startedAt: new Date('2026-08-26T09:00:00Z'), endedAt: new Date('2026-08-26T10:30:00Z') },
            { startedAt: new Date('2026-08-26T11:00:00Z'), endedAt: null },
          ],
        },
        {
          status: 'CLOSED',
          receivedDate: new Date('2026-08-01T12:00:00Z'),
          createdAt: new Date('2026-08-01T12:00:00Z'),
          parts: [{ quantity: 4 }],
          timeEntries: [],
        },
      ],
    }], new Date('2026-08-26T12:00:00Z'));

    expect(customer).toMatchObject({
      primaryContact: 'Buyer One',
      contactCount: 2,
      businessCodes: ['STD', 'CRM'],
      totalOrders: 2,
      activeOrders: 1,
      partQuantity: 9,
      laborSeconds: 9_000,
      lastWorkAt: '2026-08-26T11:00:00.000Z',
    });
    expect(customer.orderFrequencyPerMonth).toBeCloseTo(1, 1);
    expect(customer.searchText).toContain('georgetown');
    expect(customer.searchText).toContain('buyer@toyota.test');
    expect(customer.searchText).toContain('sterling tool and die');
  });

  it('ignores invalid or backwards time intervals', () => {
    const [customer] = buildCustomerDashboardRecords([{
      id: 'invalid-time',
      name: 'Invalid Time',
      contacts: [],
      businesses: [],
      orders: [{
        status: 'CLOSED',
        receivedDate: new Date('2026-08-01T12:00:00Z'),
        createdAt: new Date('2026-08-01T12:00:00Z'),
        parts: [],
        timeEntries: [{
          startedAt: new Date('2026-08-01T14:00:00Z'),
          endedAt: new Date('2026-08-01T13:00:00Z'),
        }],
      }],
    }]);

    expect(customer.laborSeconds).toBe(0);
  });
});
describe('customer dashboard query', () => {
  const customers = [
    record({ id: 'a', name: 'Alpha', searchText: 'alpha amy lexington', businessCodes: ['STD'], totalOrders: 2, activeOrders: 1, partQuantity: 20, orderFrequencyPerMonth: 0.5, laborSeconds: 3600, lastWorkAt: '2026-08-20T12:00:00Z' }),
    record({ id: 'b', name: 'Bravo', searchText: 'bravo bob nicholasville', businessCodes: ['CRM'], totalOrders: 5, partQuantity: 10, orderFrequencyPerMonth: 2, laborSeconds: 7200, lastWorkAt: '2025-01-01T12:00:00Z' }),
    record({ id: 'c', name: 'Charlie', searchText: 'charlie', businessCodes: ['STD'], totalOrders: 0 }),
  ];

  it('searches customer details and combines business and activity filters', () => {
    expect(filterAndSortCustomers(customers, { ...baseQuery, search: 'lexington' }).map((item) => item.id)).toEqual(['a']);
    expect(filterAndSortCustomers(customers, { ...baseQuery, business: 'STD', activity: 'active' }).map((item) => item.id)).toEqual(['a']);
    expect(filterAndSortCustomers(customers, { ...baseQuery, activity: 'recent' }).map((item) => item.id)).toEqual(['a']);
    expect(filterAndSortCustomers(customers, { ...baseQuery, activity: 'never' }).map((item) => item.id)).toEqual(['c']);
  });

  it.each<[CustomerSortField, string]>([
    ['orders', 'b'],
    ['parts', 'a'],
    ['frequency', 'b'],
    ['labor', 'b'],
    ['activeOrders', 'a'],
    ['recentWork', 'a'],
  ])('sorts %s descending', (sortField, expectedFirst) => {
    expect(filterAndSortCustomers(customers, { ...baseQuery, sortField, sortDirection: 'desc' })[0]?.id).toBe(expectedFirst);
  });

  it('sorts customer names in both directions and keeps missing work dates last', () => {
    expect(filterAndSortCustomers(customers, baseQuery).map((item) => item.name)).toEqual(['Alpha', 'Bravo', 'Charlie']);
    expect(filterAndSortCustomers(customers, { ...baseQuery, sortDirection: 'desc' }).map((item) => item.name)).toEqual(['Charlie', 'Bravo', 'Alpha']);
    expect(filterAndSortCustomers(customers, { ...baseQuery, sortField: 'recentWork', sortDirection: 'asc' }).map((item) => item.id)).toEqual(['b', 'a', 'c']);
  });
});
