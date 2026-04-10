import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('orders.service completion gating', () => {
  beforeEach(() => {
    process.env.TEST_MODE = 'true';
    process.env.TEST_MODE_USE_MOCK_REPOS = 'true';
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
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

  it('blocks checklist toggles until required instructions are acknowledged', async () => {
    const { toggleChecklistItem } = await import('../orders.service');

    const result = await toggleChecklistItem({
      orderId: 'order_test_001',
      checklistId: 'checklist_ack_test_001',
      checked: true,
      togglerId: 'user_test_machinist',
      employeeName: 'Alex Machinist',
    });

    expect(result.ok).toBe(false);
    expect((result as { ok: false; status: number }).status).toBe(409);
    expect((result as { ok: false; error: { code: string } }).error.code).toBe('INSTRUCTION_ACK_REQUIRED');
  });

  it('blocks department submit until required instructions are acknowledged', async () => {
    const { submitDepartmentComplete } = await import('../orders.service');

    const result = await submitDepartmentComplete({
      orderId: 'order_test_001',
      partId: 'part_ack_test_001',
      userId: 'user_test_machinist',
    });

    expect(result.ok).toBe(false);
    expect((result as { ok: false; status: number }).status).toBe(409);
    expect((result as { ok: false; error: { code: string } }).error.code).toBe('INSTRUCTION_ACK_REQUIRED');
  });

  it('records checklist actor and performer distinctly after acknowledgement', async () => {
    const { acknowledgePartInstructions, getOrderDetails, listPartEvents, toggleChecklistItem } = await import('../orders.service');

    const ack = await acknowledgePartInstructions({
      orderId: 'order_test_001',
      partId: 'part_ack_test_001',
      departmentId: 'dept_test_001',
      userId: 'user_test_machinist',
    });
    expect(ack.ok).toBe(true);

    const toggle = await toggleChecklistItem({
      orderId: 'order_test_001',
      checklistId: 'checklist_ack_test_001',
      checked: true,
      togglerId: 'user_test_machinist',
      employeeName: 'Alex Machinist',
      performedById: 'user_test_helper',
    });
    expect(toggle.ok).toBe(true);

    const details = await getOrderDetails('order_test_001', true);
    expect(details.ok).toBe(true);
    const checklistItem = (details as { ok: true; data: { item: { checklist: Array<{ id: string; toggledBy?: { id: string }; performedBy?: { id: string } }> } } }).data.item.checklist
      .find((item) => item.id === 'checklist_ack_test_001');
    expect(checklistItem?.toggledBy?.id).toBe('user_test_machinist');
    expect(checklistItem?.performedBy?.id).toBe('user_test_helper');

    const events = await listPartEvents({ orderId: 'order_test_001', partId: 'part_ack_test_001' });
    expect(events.ok).toBe(true);
    const checklistEvent = (events as { ok: true; data: { events: Array<{ type: string; message: string; meta: any }> } }).data.events
      .find((event) => event.type === 'CHECKLIST_TOGGLED');
    expect(checklistEvent?.message).toContain('marked Jamie Helper as completing');
    expect(checklistEvent?.meta?.actorUserId).toBe('user_test_machinist');
    expect(checklistEvent?.meta?.performedById).toBe('user_test_helper');
  });

  it('surfaces assigned workers and shared part activity in order details', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-03T10:00:00Z'));

    const { assignWorkerToPart, getOrderDetails } = await import('../orders.service');
    const { startTimeEntry } = await import('@/modules/time/time.service');

    const firstAssignment = await assignWorkerToPart({
      orderId: 'order_test_001',
      partId: 'part_test_001',
      userId: 'user_test_machinist',
      assignedById: 'test-user',
    });
    const secondAssignment = await assignWorkerToPart({
      orderId: 'order_test_001',
      partId: 'part_test_001',
      userId: 'user_test_helper',
      assignedById: 'test-user',
    });
    expect(firstAssignment.ok).toBe(true);
    expect(secondAssignment.ok).toBe(true);

    const started = await startTimeEntry('user_test_machinist', {
      orderId: 'order_test_001',
      partId: 'part_test_001',
      departmentId: 'dept_test_001',
      operation: 'Part Work',
    });
    expect(started.ok).toBe(true);

    const details = await getOrderDetails('order_test_001', true);
    expect(details.ok).toBe(true);
    const part = (details as { ok: true; data: { item: { parts: Array<{ id: string; assignments: any[]; partActivity: any }> } } }).data.item.parts
      .find((entry) => entry.id === 'part_test_001');

    expect(part?.assignments).toHaveLength(2);
    expect(part?.partActivity?.activeTimers.some((entry: any) => entry.userId === 'user_test_machinist')).toBe(true);
    expect(part?.partActivity?.timeByUser.some((entry: any) => entry.user?.id === 'user_test_helper' && entry.seconds > 0)).toBe(true);
    expect(part?.partActivity?.totalSeconds).toBeGreaterThan(0);
  });
});
