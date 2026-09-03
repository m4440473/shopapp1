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

  it('requires a reason for an administrative workflow-status override', async () => {
    const { updateOrderWorkflowStatusByAdmin } = await import('../orders.service');

    const result = await updateOrderWorkflowStatusByAdmin({
      orderId: 'order_test_001',
      status: 'CLOSED',
      reason: '   ',
      userId: 'user_test_admin',
      actorName: 'Test Admin',
    });

    expect(result.ok).toBe(false);
    expect((result as { ok: false; status: number }).status).toBe(400);
    expect((result as { ok: false; error: string }).error).toContain('Reason is required');
  });

  it('records the actor and reason when an admin changes workflow status', async () => {
    const { getOrderDetails, updateOrderWorkflowStatusByAdmin } = await import('../orders.service');

    const result = await updateOrderWorkflowStatusByAdmin({
      orderId: 'order_test_001',
      status: 'CLOSED',
      reason: 'Customer picked up the completed order.',
      userId: 'user_test_admin',
      actorName: 'Test Admin',
    });

    expect(result.ok).toBe(true);
    const details = await getOrderDetails('order_test_001', { isAdmin: true });
    expect(details.ok).toBe(true);
    const item = (details as { ok: true; data: { item: { status: string; statusHistory: Array<{ to: string; reason: string }> } } }).data.item;
    expect(item.status).toBe('CLOSED');
    expect(item.statusHistory[0]).toMatchObject({
      to: 'CLOSED',
      reason: 'Admin status change by Test Admin: Customer picked up the completed order.',
    });
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
      assignedWorkerIds: [],
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
    const details = await getOrderDetails(orderId, { isAdmin: true });
    expect(details.ok).toBe(true);

    const payload = (details as { ok: true; data: { item: { parts: Array<{ currentDepartmentId: string | null }> }; departments: Array<{ id: string; name: string }> } }).data;
    expect(payload.departments[0]?.name).toBe('Machining');
    expect(payload.item.parts[0]?.currentDepartmentId).toBe(payload.departments[0]?.id);
  });

  it('persists drawing-derived stock dimensions on a new order part', async () => {
    const { createOrderFromPayload, getOrderDetails } = await import('../orders.service');
    const created = await createOrderFromPayload({
      business: 'STD', customerId: 'customer_test_001', receivedDate: '2026-08-27', dueDate: '2026-09-10', priority: 'NORMAL',
      materialNeeded: true, materialOrdered: false, modelIncluded: false, assignedWorkerIds: [], notes: '', attachments: [], addonIds: [], customFieldValues: [],
      parts: [{
        partNumber: 'DIM-100', quantity: 4, partThickness: '0.25', partWidth: '2.5', cutLength: '4.125', stockSize: '0.25 × 2.5 × 16.5', addonSelections: [],
      }],
    });
    expect(created.ok).toBe(true);
    const details = await getOrderDetails((created as { ok: true; data: { id: string } }).data.id, { isAdmin: true });
    expect(details.ok).toBe(true);
    const part = (details as { ok: true; data: { item: { parts: Array<Record<string, unknown>> } } }).data.item.parts[0];
    expect(part).toMatchObject({ partThickness: '0.25', partWidth: '2.5', cutLength: '4.125', stockSize: '0.25 × 2.5 × 16.5' });
  });

  it('assigns every selected worker to every new part without making one the coordinator', async () => {
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
      assignedMachinistId: undefined,
      assignedWorkerIds: ['user_test_machinist', 'user_test_helper', 'user_test_machinist'],
      notes: '',
      attachments: [],
      addonIds: [],
      customFieldValues: [],
      parts: [
        { partNumber: 'CREW-001', quantity: 1, addonSelections: [] },
        { partNumber: 'CREW-002', quantity: 2, addonSelections: [] },
      ],
    }, 'user_test_admin');

    expect(created.ok).toBe(true);
    const orderId = (created as { ok: true; data: { id: string } }).data.id;
    const details = await getOrderDetails(orderId, { isAdmin: true });
    expect(details.ok).toBe(true);

    const item = (details as {
      ok: true;
      data: { item: { assignedMachinistId: string | null; parts: Array<{ assignments: Array<{ userId: string }> }> } };
    }).data.item;
    expect(item.assignedMachinistId).toBeNull();
    expect(item.parts).toHaveLength(2);
    for (const part of item.parts) {
      expect(part.assignments.map((assignment) => assignment.userId)).toEqual([
        'user_test_machinist',
        'user_test_helper',
      ]);
    }
  });

  it('normalizes blank optional material IDs on order create', async () => {
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
      assignedWorkerIds: [],
      notes: '',
      attachments: [],
      addonIds: [],
      customFieldValues: [],
      parts: [
        {
          partNumber: 'NEW-BLANK-MATERIAL',
          quantity: 1,
          materialId: '',
          stockSize: undefined,
          cutLength: undefined,
          notes: undefined,
          addonSelections: [],
        },
      ],
    });

    expect(created.ok).toBe(true);

    const orderId = (created as { ok: true; data: { id: string } }).data.id;
    const details = await getOrderDetails(orderId, { isAdmin: true });
    expect(details.ok).toBe(true);

    const payload = (details as { ok: true; data: { item: { parts: Array<{ materialId: string | null }> } } }).data;
    expect(payload.item.parts[0]?.materialId).toBeNull();
  });

  it('persists a dedicated part name and maps an imported drawing to that created part', async () => {
    const { createOrderFromPayload, getOrderDetails } = await import('../orders.service');

    const created = await createOrderFromPayload({
      business: 'STD',
      customerId: 'customer_test_001',
      receivedDate: '2026-07-16',
      dueDate: '2026-07-30',
      priority: 'NORMAL',
      materialNeeded: false,
      materialOrdered: false,
      modelIncluded: false,
      assignedWorkerIds: [],
      attachments: [],
      addonIds: [],
      customFieldValues: [],
      parts: [{
        partNumber: '25011-00-133-607',
        partName: 'VERTICAL RAIL MOUNT',
        quantity: 1,
        addonSelections: [],
        attachments: [{
          kind: 'PDF',
          storagePath: 'draft/customer/25011-00-133-607.pdf',
          label: '25011-00-133-607.pdf',
          mimeType: 'application/pdf',
        }],
      }],
    });

    expect(created.ok).toBe(true);
    const data = (created as { ok: true; data: { id: string; parts: Array<{ id: string }> } }).data;
    expect(data.parts).toHaveLength(1);

    const details = await getOrderDetails(data.id, { isAdmin: true });
    expect(details.ok).toBe(true);
    const part = (details as { ok: true; data: { item: { parts: Array<{ id: string; partName?: string | null; attachments: Array<{ partId: string; label: string | null }> }> } } }).data.item.parts[0];
    expect(part.partName).toBe('VERTICAL RAIL MOUNT');
    expect(part.attachments.find((attachment) => attachment.label === '25011-00-133-607.pdf')).toMatchObject({
      partId: part.id,
      label: '25011-00-133-607.pdf',
    });
  });

  it('keeps the final department visible when checklist completion finishes a part', async () => {
    const { completeChecklistAndAdvance, getOrderDetails } = await import('../orders.service');

    const result = await completeChecklistAndAdvance({
      orderId: 'order_test_001',
      partId: 'part_test_002',
      checklistId: 'checklist_test_001',
      actorUserId: 'user_test_machinist',
    });

    expect(result.ok).toBe(true);
    const payload = (result as { ok: true; data: { part: { currentDepartmentId: string | null } } }).data;
    expect(payload.part.currentDepartmentId).toBe('dept_test_002');

    const details = await getOrderDetails('order_test_001', { isAdmin: true });
    expect(details.ok).toBe(true);
    const part = (details as { ok: true; data: { item: { parts: Array<{ id: string; status: string | null; currentDepartmentId: string | null }> } } }).data.item.parts
      .find((entry) => entry.id === 'part_test_002');
    expect(part?.status).toBe('COMPLETE');
    expect(part?.currentDepartmentId).toBe('dept_test_002');
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

    const details = await getOrderDetails('order_test_001', { isAdmin: true });
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

    const details = await getOrderDetails('order_test_001', { isAdmin: true });
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

    const details = await getOrderDetails('order_test_001', { isAdmin: true });
    expect(details.ok).toBe(true);
    const part = (details as { ok: true; data: { item: { parts: Array<{ id: string; assignments: any[]; partActivity: any }> } } }).data.item.parts
      .find((entry) => entry.id === 'part_test_001');

    expect(part?.assignments).toHaveLength(2);
    expect(part?.partActivity?.activeTimers.some((entry: any) => entry.userId === 'user_test_machinist')).toBe(true);
    expect(part?.partActivity?.timeByUser.some((entry: any) => entry.user?.id === 'user_test_helper' && entry.seconds > 0)).toBe(true);
    expect(part?.partActivity?.totalSeconds).toBeGreaterThan(0);
  });

  it('removes administrative documents from non-admin order details and part attachment lists', async () => {
    const {
      createAttachmentForOrder,
      createAttachmentForPart,
      getOrderDetails,
      listAttachmentsForPart,
    } = await import('../orders.service');

    await createAttachmentForOrder({
      orderId: 'order_test_001',
      payload: { label: 'Customer PO.pdf', storagePath: 'orders/customer-po.pdf', mimeType: 'application/pdf' },
    });
    await createAttachmentForPart({
      partId: 'part_test_001',
      payload: { kind: 'PO', label: 'Purchase order', storagePath: 'parts/po.pdf', mimeType: 'application/pdf' },
    });
    await createAttachmentForPart({
      partId: 'part_test_001',
      payload: { kind: 'PDF', label: 'A-100 drawing.pdf', storagePath: 'parts/drawing.pdf', mimeType: 'application/pdf' },
    });

    const details = await getOrderDetails('order_test_001', { isAdmin: false });
    expect(details.ok).toBe(true);
    const item = (details as { ok: true; data: { item: any } }).data.item;
    expect(item.attachments).toEqual([]);
    const visibleOrderPartLabels = item.partAttachments.map((attachment: any) => attachment.label);
    expect(visibleOrderPartLabels).toContain('A-100 drawing.pdf');
    expect(visibleOrderPartLabels).not.toContain('Purchase order');
    const visibleNestedPartLabels = item.parts
      .find((part: any) => part.id === 'part_test_001').attachments
      .map((attachment: any) => attachment.label);
    expect(visibleNestedPartLabels).toContain('A-100 drawing.pdf');
    expect(visibleNestedPartLabels).not.toContain('Purchase order');

    const list = await listAttachmentsForPart('part_test_001', false);
    expect(list.ok).toBe(true);
    const visibleListLabels = (list as { ok: true; data: { attachments: any[] } }).data.attachments
      .map((attachment) => attachment.label);
    expect(visibleListLabels).toContain('A-100 drawing.pdf');
    expect(visibleListLabels).not.toContain('Purchase order');
  });
});
