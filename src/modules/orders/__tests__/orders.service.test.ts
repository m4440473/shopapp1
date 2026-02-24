import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('orders.service completion rules', () => {
  beforeEach(() => {
    process.env.TEST_MODE = 'true';
    vi.resetModules();
  });

  it('rejects completing a part when checklist items remain', async () => {
    const ordersRepo = await import('@/repos/orders');
    const { completeOrderPart } = await import('../orders.service');

    await ordersRepo.createOrderChecklistItem({
      orderId: 'order_test_001',
      partId: 'part_test_001',
      addonId: 'addon_test_001',
      departmentId: 'dept_test_machining',
      completed: false,
      isActive: true,
      source: 'test',
    });

    const result = await completeOrderPart({
      orderId: 'order_test_001',
      partId: 'part_test_001',
      userId: 'user_test_admin',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(409);
    expect(result.error).toContain('checklist items remain');
  });
});
