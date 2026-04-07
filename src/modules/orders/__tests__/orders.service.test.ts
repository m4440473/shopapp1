import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('orders.service completion gating', () => {
  beforeEach(() => {
    process.env.TEST_MODE = 'true';
    process.env.TEST_MODE_USE_MOCK_REPOS = 'true';
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

  it('requires all current department checklist items before department submission', async () => {
    const { submitDepartmentComplete } = await import('../orders.service');

    const result = await submitDepartmentComplete({
      orderId: 'order_test_001',
      partId: 'part_test_002',
      userId: 'user_test_machinist',
    });

    expect(result.ok).toBe(false);
    expect((result as { ok: false; status: number }).status).toBe(409);
    expect((result as { ok: false; error: string }).error).toContain('checklist item');
  });

  it('requires a note when adding extra manual time on department submission', async () => {
    const { submitDepartmentComplete, toggleChecklistItem } = await import('../orders.service');

    const toggle = await toggleChecklistItem({
      orderId: 'order_test_001',
      checklistId: 'checklist_test_001',
      checked: true,
      togglerId: 'user_test_machinist',
      employeeName: 'Test Machinist',
    });
    expect(toggle.ok).toBe(true);

    const result = await submitDepartmentComplete({
      orderId: 'order_test_001',
      partId: 'part_test_002',
      userId: 'user_test_machinist',
      additionalSeconds: 120,
      adjustmentNote: '',
    });

    expect(result.ok).toBe(false);
    expect((result as { ok: false; status: number }).status).toBe(400);
    expect((result as { ok: false; error: string }).error).toContain('note is required');
  });
});
