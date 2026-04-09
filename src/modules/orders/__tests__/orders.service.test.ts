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


  it('requires Shipping as current department before manual part completion', async () => {
    const { completeOrderPart, toggleChecklistItem } = await import('../orders.service');

    const toggle = await toggleChecklistItem({
      orderId: 'order_test_001',
      checklistId: 'checklist_test_001',
      checked: true,
      togglerId: 'user_test_machinist',
      employeeName: 'Test Machinist',
    });
    expect(toggle.ok).toBe(true);

    const result = await completeOrderPart({
      orderId: 'order_test_001',
      partId: 'part_test_002',
      userId: 'user_test_machinist',
    });

    expect(result.ok).toBe(false);
    expect((result as { ok: false; status: number }).status).toBe(409);
    expect((result as { ok: false; error: string }).error).toContain('Shipping');
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

  it('initializes new order parts to the first active department in order details', async () => {
    const { createOrderFromPayload, getOrderDetails } = await import('../orders.service');

    const created = await createOrderFromPayload({
      business: 'STD',
      customerId: 'customer_test_001',
      receivedDate: '2026-02-01',
      dueDate: '2026-02-10',
      priority: 'NORMAL',
      materialNeeded: false,
      materialOrdered: false,
      modelIncluded: false,
      vendorId: undefined,
      poNumber: undefined,
      assignedMachinistId: undefined,
      notes: '',
      attachments: [],
      addonIds: [],
      customFieldValues: [],
      parts: [
        {
          partNumber: 'NEW-001',
          quantity: 1,
          materialId: undefined,
          stockSize: undefined,
          cutLength: undefined,
          notes: undefined,
          addonSelections: [],
        },
      ],
    });

    expect(created.ok).toBe(true);

    const orderId = (created as { ok: true; data: { id: string } }).data.id;
    const details = await getOrderDetails(orderId, true);
    expect(details.ok).toBe(true);

    const payload = (details as { ok: true; data: { item: { parts: Array<{ currentDepartmentId: string | null }> }; departments: Array<{ id: string; name: string }> } }).data;
    expect(payload.departments[0]?.name).toBe('Machining');
    expect(payload.item.parts[0]?.currentDepartmentId).toBe(payload.departments[0]?.id);
  });

  it('does not visually auto-advance a null-owned part to the next department after checklist completion', async () => {
    const { getOrderDetails, toggleChecklistItem } = await import('../orders.service');
    const { updateOrderPart } = await import('@/repos/orders');

    await updateOrderPart('part_test_002', { currentDepartmentId: null, status: 'IN_PROGRESS' });

    const toggle = await toggleChecklistItem({
      orderId: 'order_test_001',
      checklistId: 'checklist_test_001',
      checked: true,
      togglerId: 'user_test_machinist',
      employeeName: 'Test Machinist',
    });
    expect(toggle.ok).toBe(true);

    const details = await getOrderDetails('order_test_001', true);
    expect(details.ok).toBe(true);

    const payload = (details as { ok: true; data: { item: { parts: Array<{ id: string; currentDepartmentId: string | null }> }; departments: Array<{ id: string; name: string }> } }).data;
    const part = payload.item.parts.find((entry) => entry.id === 'part_test_002');
    expect(payload.departments[0]?.name).toBe('Machining');
    expect(part?.currentDepartmentId).toBe(payload.departments[0]?.id);
    expect(part?.currentDepartmentId).not.toBe('dept_test_002');
  });

  it('includes parts in the department feed based on current department ownership', async () => {
    const { getOrderDepartmentFeed } = await import('../orders.service');

    const result = await getOrderDepartmentFeed('dept_test_001', false);

    expect(result.ok).toBe(true);
    const payload = (result as { ok: true; data: { items: Array<{ orderId: string; parts: Array<{ id: string; currentDepartmentId?: string | null }> }> } }).data;
    expect(payload.items.some((order) => order.orderId === 'order_test_001')).toBe(true);
    const machiningOrder = payload.items.find((order) => order.orderId === 'order_test_001');
    expect(machiningOrder?.parts.some((part) => part.id === 'part_test_001')).toBe(true);
    expect(machiningOrder?.parts.find((part) => part.id === 'part_test_001')?.currentDepartmentId).toBe('dept_test_001');
  });
});
