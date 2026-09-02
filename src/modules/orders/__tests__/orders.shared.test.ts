import { describe, expect, it } from 'vitest';

import { DEFAULT_ORDER_FILTERS, decorateOrder, getOrderMachinistLabel, orderMatchesFilters } from '../orders.shared';

function orderWithAssignments() {
  return decorateOrder({
    id: 'order-1',
    orderNumber: 'STD-1001',
    status: 'IN_PROGRESS',
    priority: 'NORMAL',
    receivedDate: new Date('2026-08-25T12:00:00Z'),
    dueDate: null,
    assignedMachinist: null,
    checklist: [],
    statusHistory: [],
    parts: [
      {
        quantity: 1,
        assignments: [{ user: { id: 'worker-1', name: 'Jane Worker', email: 'jane@example.com', active: true } }],
      },
      {
        quantity: 2,
        assignments: [{ user: { id: 'worker-1', name: 'Jane Worker', email: 'jane@example.com', active: true } }],
      },
    ],
  } as any);
}

describe('shop floor assignee projection', () => {
  it('deduplicates active part assignees and uses them when no coordinator exists', () => {
    const order = orderWithAssignments();
    expect(order.assignedWorkers).toEqual([{ id: 'worker-1', name: 'Jane Worker' }]);
    expect(getOrderMachinistLabel(order)).toBe('Jane Worker');
  });

  it('uses the coordinator label when one exists', () => {
    const order = { ...orderWithAssignments(), assignedMachinist: { id: 'lead-1', name: 'Shop Lead', email: null } };
    expect(getOrderMachinistLabel(order)).toBe('Shop Lead');
  });

  it('matches worker filters and does not classify assigned work as unassigned', () => {
    const order = orderWithAssignments();
    expect(orderMatchesFilters(order, { ...DEFAULT_ORDER_FILTERS, machinistId: 'worker-1' }, 'all', 'all')).toBe(true);
    expect(orderMatchesFilters(order, { ...DEFAULT_ORDER_FILTERS, machinistId: '__unassigned__' }, 'all', 'all')).toBe(false);
  });
});
