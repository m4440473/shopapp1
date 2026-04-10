import { beforeEach, describe, expect, it, vi } from 'vitest';

const repeatOrdersRepo = vi.hoisted(() => ({
  findOrderTemplateSource: vi.fn(),
  createRepeatOrderTemplate: vi.fn(),
  listRepeatOrderTemplates: vi.fn(),
  findRepeatOrderTemplateById: vi.fn(),
  createOrderFromRepeatTemplate: vi.fn(),
}));

const ordersService = vi.hoisted(() => ({
  ensureOrderFilesInCanonicalStorage: vi.fn(),
  generateNextOrderNumber: vi.fn(),
  initializeCurrentDepartmentForOrder: vi.fn(),
  syncChecklistForOrder: vi.fn(),
  syncOrderWorkflowStatus: vi.fn(),
}));

vi.mock('@/modules/repeat-orders/repeat-orders.repo', () => repeatOrdersRepo);
vi.mock('@/modules/orders/orders.service', () => ordersService);

describe('repeat-orders.service', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    ordersService.generateNextOrderNumber.mockResolvedValue('STD-2001');
    ordersService.syncChecklistForOrder.mockResolvedValue({ ok: true, data: { ok: true } });
    ordersService.initializeCurrentDepartmentForOrder.mockResolvedValue({ ok: true, data: { ok: true } });
    ordersService.syncOrderWorkflowStatus.mockResolvedValue({ ok: true, data: { ok: true } });
    ordersService.ensureOrderFilesInCanonicalStorage.mockResolvedValue({ ok: true, data: { ok: true } });
  });

  it('snapshots a frozen template without carrying over the source PO as template notes', async () => {
    repeatOrdersRepo.findOrderTemplateSource.mockResolvedValue({
      id: 'order_1',
      orderNumber: 'STD-1010',
      customerId: 'customer_1',
      customer: { id: 'customer_1', name: 'Acme' },
      business: 'STD',
      vendorId: 'vendor_1',
      materialNeeded: true,
      materialOrdered: false,
      modelIncluded: true,
      priority: 'RUSH',
      poNumber: 'PO-12345',
      parts: [
        {
          id: 'part_1',
          partNumber: 'PN-1',
          quantity: 4,
          materialId: 'material_1',
          stockSize: '1 x 2',
          cutLength: '10',
          notes: 'repeat me',
          workInstructions: 'hold tight',
          instructionsVersion: 3,
          charges: [
            {
              id: 'charge_1',
              departmentId: 'dept_1',
              addonId: 'addon_1',
              kind: 'ADDON',
              name: 'Deburr',
              description: null,
              quantity: '2',
              unitPrice: '15',
              sortOrder: 0,
            },
          ],
          attachments: [
            {
              id: 'part_attachment_1',
              kind: 'PDF',
              url: null,
              storagePath: 'old/order/part.pdf',
              label: 'part.pdf',
              mimeType: 'application/pdf',
            },
          ],
        },
      ],
      attachments: [
        {
          id: 'attachment_1',
          url: null,
          storagePath: 'old/order/order.pdf',
          label: 'order.pdf',
          mimeType: 'application/pdf',
        },
      ],
    });

    repeatOrdersRepo.createRepeatOrderTemplate.mockImplementation(async (input) => ({
      id: 'template_1',
      customerId: input.customerId,
      customer: { id: 'customer_1', name: 'Acme' },
      sourceOrderId: input.sourceOrderId,
      sourceOrder: { id: input.sourceOrderId, orderNumber: 'STD-1010' },
      name: input.name,
      business: input.business,
      priority: input.priority,
      createdAt: new Date('2026-04-10T12:00:00Z'),
      updatedAt: new Date('2026-04-10T12:00:00Z'),
      parts: input.parts.map((part, index) => ({ id: `template_part_${index}`, ...part })),
    }));

    const { snapshotRepeatOrderTemplateFromOrder } = await import('../repeat-orders.service');

    const result = await snapshotRepeatOrderTemplateFromOrder('order_1', {}, 'user_1');

    expect(result.ok).toBe(true);
    expect(repeatOrdersRepo.createRepeatOrderTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceOrderId: 'order_1',
        name: 'Acme - STD-1010',
        notes: null,
      }),
    );
  });

  it('rejects unknown template part overrides', async () => {
    repeatOrdersRepo.findRepeatOrderTemplateById.mockResolvedValue({
      id: 'template_1',
      customerId: 'customer_1',
      business: 'STD',
      priority: 'NORMAL',
      materialNeeded: false,
      materialOrdered: false,
      modelIncluded: false,
      vendorId: null,
      attachments: [],
      parts: [
        {
          id: 'template_part_1',
          partNumber: 'PN-1',
          quantity: 1,
          materialId: null,
          stockSize: null,
          cutLength: null,
          notes: null,
          workInstructions: null,
          instructionsVersion: 1,
          charges: [],
          attachments: [],
        },
      ],
    });

    const { createOrderFromRepeatOrderTemplate } = await import('../repeat-orders.service');

    const result = await createOrderFromRepeatOrderTemplate('template_1', {
      parts: [{ templatePartId: 'missing_part', quantity: 2 }],
    });

    expect(result.ok).toBe(false);
    expect((result as { ok: false; status: number }).status).toBe(400);
    expect(repeatOrdersRepo.createOrderFromRepeatTemplate).not.toHaveBeenCalled();
  });

  it('rejects provided order numbers that do not match the standard business prefix rule', async () => {
    repeatOrdersRepo.findRepeatOrderTemplateById.mockResolvedValue({
      id: 'template_1',
      customerId: 'customer_1',
      business: 'STD',
      priority: 'NORMAL',
      materialNeeded: false,
      materialOrdered: false,
      modelIncluded: false,
      vendorId: null,
      attachments: [],
      parts: [
        {
          id: 'template_part_1',
          partNumber: 'PN-1',
          quantity: 1,
          materialId: null,
          stockSize: null,
          cutLength: null,
          notes: null,
          workInstructions: null,
          instructionsVersion: 1,
          charges: [],
          attachments: [],
        },
      ],
    });

    const { createOrderFromRepeatOrderTemplate } = await import('../repeat-orders.service');

    const result = await createOrderFromRepeatOrderTemplate('template_1', {
      orderNumber: 'BAD-5000',
    });

    expect(result.ok).toBe(false);
    expect((result as { ok: false; status: number }).status).toBe(400);
    expect(repeatOrdersRepo.createOrderFromRepeatTemplate).not.toHaveBeenCalled();
  });

  it('creates a brand-new order from a template and reuses the normal post-create lifecycle helpers', async () => {
    repeatOrdersRepo.findRepeatOrderTemplateById.mockResolvedValue({
      id: 'template_1',
      customerId: 'customer_1',
      business: 'STD',
      priority: 'HOT',
      materialNeeded: true,
      materialOrdered: false,
      modelIncluded: true,
      vendorId: 'vendor_1',
      attachments: [
        {
          id: 'attachment_1',
          kind: 'ORDER',
          url: null,
          storagePath: 'templates/order/order.pdf',
          label: 'order.pdf',
          mimeType: 'application/pdf',
        },
      ],
      parts: [
        {
          id: 'template_part_1',
          partNumber: 'PN-1',
          quantity: 4,
          materialId: 'material_1',
          stockSize: '1 x 2',
          cutLength: '10',
          notes: 'template note',
          workInstructions: 'template instructions',
          instructionsVersion: 2,
          charges: [
            {
              id: 'charge_1',
              departmentId: 'dept_1',
              addonId: 'addon_1',
              kind: 'ADDON',
              name: 'Deburr',
              description: null,
              quantity: '2',
              unitPrice: '15',
              sortOrder: 0,
            },
          ],
          attachments: [
            {
              id: 'part_attachment_1',
              kind: 'PDF',
              url: null,
              storagePath: 'templates/part/part.pdf',
              label: 'part.pdf',
              mimeType: 'application/pdf',
            },
          ],
        },
      ],
    });

    repeatOrdersRepo.createOrderFromRepeatTemplate.mockResolvedValue({
      id: 'order_new_1',
      partIdsByTemplatePartId: new Map([['template_part_1', 'part_new_1']]),
    });

    const { createOrderFromRepeatOrderTemplate } = await import('../repeat-orders.service');

    const result = await createOrderFromRepeatOrderTemplate(
      'template_1',
      {
        poNumber: 'PO-999',
        parts: [
          {
            templatePartId: 'template_part_1',
            quantity: 6,
            workInstructions: 'override instructions',
          },
        ],
      },
      'user_1',
    );

    expect(result.ok).toBe(true);
    expect(ordersService.generateNextOrderNumber).toHaveBeenCalledWith('STD');
    expect(repeatOrdersRepo.createOrderFromRepeatTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        orderNumber: 'STD-2001',
        business: 'STD',
        customerId: 'customer_1',
        vendorId: 'vendor_1',
        poNumber: 'PO-999',
        userId: 'user_1',
        attachments: [
          expect.objectContaining({
            storagePath: 'templates/order/order.pdf',
            label: 'order.pdf',
          }),
        ],
        parts: [
          expect.objectContaining({
            templatePartId: 'template_part_1',
            quantity: 6,
            workInstructions: 'override instructions',
            attachments: [
              expect.objectContaining({
                storagePath: 'templates/part/part.pdf',
                label: 'part.pdf',
              }),
            ],
          }),
        ],
      }),
    );
    expect(ordersService.syncChecklistForOrder).toHaveBeenCalledWith('order_new_1');
    expect(ordersService.initializeCurrentDepartmentForOrder).toHaveBeenCalledWith('order_new_1');
    expect(ordersService.syncOrderWorkflowStatus).toHaveBeenCalledWith('order_new_1', { userId: 'user_1' });
    expect(ordersService.ensureOrderFilesInCanonicalStorage).toHaveBeenCalledWith('order_new_1');
  });
});
