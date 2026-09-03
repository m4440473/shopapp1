import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getStored, saveStored, getEvents, getDepartments, getWaiting } = vi.hoisted(() => ({
  getStored: vi.fn(),
  saveStored: vi.fn(),
  getEvents: vi.fn(),
  getDepartments: vi.fn(),
  getWaiting: vi.fn(),
}));

vi.mock('../shop-floor.repo', () => ({
  getShopFloorDisplayOptionsJson: getStored,
  saveShopFloorDisplayOptionsJson: saveStored,
  listRecentShopFloorEvents: getEvents,
  listShopFloorDepartmentNames: getDepartments,
  getWaitingStockSnapshot: getWaiting,
}));

import { DEFAULT_SHOP_FLOOR_DISPLAY_OPTIONS } from '../shop-floor.schema';
import { getShopFloorDisplayOptions, getShopFloorSummary, updateShopFloorDisplayOptions } from '../shop-floor.service';

const LEGACY_DEFAULT = {
  ...DEFAULT_SHOP_FLOOR_DISPLAY_OPTIONS,
  version: 1 as const,
  sortField: 'dueDate' as const,
  sortDirection: 'asc' as const,
};

describe('Shop Floor display settings service', () => {
  beforeEach(() => {
    getStored.mockReset();
    saveStored.mockReset();
    getEvents.mockReset();
    getDepartments.mockReset();
    getWaiting.mockReset();
  });

  it('returns safe defaults when nothing valid is stored', async () => {
    getStored.mockResolvedValue('{not-json');
    await expect(getShopFloorDisplayOptions()).resolves.toEqual(DEFAULT_SHOP_FLOOR_DISPLAY_OPTIONS);
  });

  it('validates and serializes a saved display profile', async () => {
    saveStored.mockResolvedValue({});
    const input = { ...DEFAULT_SHOP_FLOOR_DISPLAY_OPTIONS, sortField: 'customer' as const };
    const result = await updateShopFloorDisplayOptions(input);
    expect(result).toEqual({ ok: true, data: input });
    expect(saveStored).toHaveBeenCalledWith(JSON.stringify(input));
  });

  it('promotes only the untouched legacy overdue red to the deeper default', async () => {
    getStored.mockResolvedValue(JSON.stringify({
      ...LEGACY_DEFAULT,
      colorRules: [{
        ...DEFAULT_SHOP_FLOOR_DISPLAY_OPTIONS.colorRules[0],
        color: '#dc2626',
      }],
    }));
    const result = await getShopFloorDisplayOptions();
    expect(result.colorRules[0].color).toBe('#7f1d1d');
  });

  it('upgrades the legacy default sort to newest-created first', async () => {
    getStored.mockResolvedValue(JSON.stringify(LEGACY_DEFAULT));
    await expect(getShopFloorDisplayOptions()).resolves.toMatchObject({
      version: 2,
      sortField: 'createdAt',
      sortDirection: 'desc',
    });
  });

  it('preserves a legacy custom sort while upgrading its version', async () => {
    getStored.mockResolvedValue(JSON.stringify({
      ...LEGACY_DEFAULT,
      sortField: 'priority',
      sortDirection: 'asc',
    }));
    await expect(getShopFloorDisplayOptions()).resolves.toMatchObject({
      version: 2,
      sortField: 'priority',
      sortDirection: 'asc',
    });
  });

  it('preserves an explicit current due-date sort', async () => {
    getStored.mockResolvedValue(JSON.stringify({
      ...DEFAULT_SHOP_FLOOR_DISPLAY_OPTIONS,
      sortField: 'dueDate',
      sortDirection: 'asc',
    }));
    await expect(getShopFloorDisplayOptions()).resolves.toMatchObject({
      version: 2,
      sortField: 'dueDate',
      sortDirection: 'asc',
    });
  });

  it('rejects invalid colors and does not write them', async () => {
    const input = {
      ...DEFAULT_SHOP_FLOOR_DISPLAY_OPTIONS,
      colorRules: [{ ...DEFAULT_SHOP_FLOOR_DISPLAY_OPTIONS.colorRules[0], color: 'red' }],
    };
    expect((await updateShopFloorDisplayOptions(input)).ok).toBe(false);
    expect(saveStored).not.toHaveBeenCalled();
  });

  it('builds a bounded, malformed-metadata-safe movement and stock summary', async () => {
    getDepartments.mockResolvedValue([
      { id: 'dept-fab', name: 'Fabrication' },
      { id: 'dept-machine', name: 'Machining' },
    ]);
    const base = {
      user: { id: 'user-1', name: 'Alex', email: null },
      part: {
        id: 'part-1', partNumber: 'P-100', partName: 'Bracket', materialStatus: 'IN_STOCK',
        procurementVendor: { id: 'vendor-1', name: 'Steel Supply' },
      },
      order: { id: 'order-1', orderNumber: 'STD-1001', customer: { name: 'Acme' } },
    };
    getEvents.mockResolvedValue([
      {
        ...base,
        id: 'arrival',
        type: 'MATERIAL_STATUS_CHANGED',
        message: 'Material arrived.',
        meta: JSON.stringify({ fromMaterialStatus: 'WAITING_ON_STOCK', toMaterialStatus: 'IN_STOCK' }),
        createdAt: new Date('2026-09-01T11:00:00Z'),
      },
      {
        ...base,
        id: 'department',
        type: 'DEPARTMENT_ADVANCED',
        message: 'Moved departments.',
        meta: JSON.stringify({ fromDepartmentId: 'dept-fab', toDepartmentId: 'dept-machine' }),
        createdAt: new Date('2026-09-01T10:00:00Z'),
      },
      {
        ...base,
        id: 'malformed',
        type: 'DEPARTMENT_SET_MANUAL',
        message: 'Legacy malformed event.',
        meta: '{bad-json',
        createdAt: new Date('2026-09-01T09:00:00Z'),
      },
      {
        ...base,
        id: 'not-arrived',
        type: 'MATERIAL_STATUS_CHANGED',
        message: 'Still waiting.',
        meta: JSON.stringify({ fromMaterialStatus: 'NEED_TO_ORDER', toMaterialStatus: 'WAITING_ON_STOCK' }),
        createdAt: new Date('2026-09-01T08:00:00Z'),
      },
    ]);
    getWaiting.mockResolvedValue({
      count: 2,
      items: [{
        id: 'part-2',
        partNumber: 'P-200',
        partName: null,
        updatedAt: new Date('2026-09-01T07:00:00Z'),
        procurementVendor: null,
        order: {
          id: 'order-2', orderNumber: 'STD-1002', dueDate: new Date('2026-09-10T00:00:00Z'),
          customer: { name: 'Beta' },
        },
      }],
    });

    const summary = await getShopFloorSummary(new Date('2026-09-01T12:00:00Z'));

    expect(getEvents).toHaveBeenCalledWith(new Date('2026-08-25T12:00:00Z'), 60);
    expect(summary.recentChanges.map((change) => change.id)).toEqual(['arrival', 'department', 'malformed']);
    expect(summary.recentChanges[0]).toMatchObject({
      kind: 'MATERIAL_ARRIVED', fromLabel: 'Waiting on stock', toLabel: 'Material arrived', vendorName: 'Steel Supply',
    });
    expect(summary.recentChanges[1]).toMatchObject({
      kind: 'DEPARTMENT', fromLabel: 'Fabrication', toLabel: 'Machining',
    });
    expect(summary.recentChanges[2]).toMatchObject({
      kind: 'DEPARTMENT', fromLabel: 'Unassigned', toLabel: 'Completed',
    });
    expect(summary.waitingStock).toMatchObject({
      count: 2,
      items: [{ partId: 'part-2', orderId: 'order-2', vendorName: null }],
    });
  });
});
