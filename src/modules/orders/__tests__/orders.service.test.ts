import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('orders.service completion gating', () => {
  beforeEach(() => {
    process.env.TEST_MODE = 'true';
    vi.resetModules();
  });

  it('rejects completing a part when checklist items remain', async () => {
    const { completeOrderPart } = await import('../orders.service');

    const result = await completeOrderPart({
      orderId: 'order_test_001',
      partId: 'part_test_002',
      userId: 'user_test_machinist',
    });

    expect(result.ok).toBe(false);
    expect((result as { ok: false; status: number }).status).toBe(409);
    expect((result as { ok: false; error: string }).error).toContain('checklist items remain');
  });
});
