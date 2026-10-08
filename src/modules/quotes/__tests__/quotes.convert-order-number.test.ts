import { beforeEach, describe, expect, it, vi } from 'vitest';

const { transaction } = vi.hoisted(() => ({ transaction: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: { $transaction: transaction } }));

import { convertQuoteToOrder } from '../quotes.repo';

type ExistingOrder = { business: string; orderNumber: string };

function mockTransaction(existing: ExistingOrder[]) {
  const tx = {
    order: {
      findMany: vi.fn(async (query: {
        where?: { business?: string; orderNumber?: { startsWith: string } };
        orderBy?: { orderNumber: string };
        take?: number;
      }) => {
        let found = existing.filter((order) =>
          (!query.where?.business || order.business === query.where.business)
          && (!query.where?.orderNumber || order.orderNumber.startsWith(query.where.orderNumber.startsWith))
        );
        if (query.orderBy?.orderNumber === 'desc') {
          found = [...found].sort((a, b) => b.orderNumber.localeCompare(a.orderNumber));
        }
        return found.slice(0, query.take);
      }),
      create: vi.fn(async ({ data }: { data: ExistingOrder }) => {
        if (existing.some((order) => order.orderNumber === data.orderNumber)) {
          throw new Error('Unique constraint failed on orderNumber');
        }
        existing.push(data);
        return { id: 'converted-order' };
      }),
    },
    department: { findMany: vi.fn(async () => []) },
    orderPart: { create: vi.fn(async () => ({ id: 'converted-part' })) },
    statusHistory: { create: vi.fn(async () => ({})) },
    quote: { update: vi.fn(async () => ({})) },
  };
  transaction.mockImplementation(async (callback: (value: typeof tx) => unknown) => callback(tx));
  return tx;
}

function convert() {
  return convertQuoteToOrder({
    quote: { id: 'quote', quoteNumber: 'Q-1001', business: 'STD', customerId: 'customer', parts: [] },
    metadata: {},
    now: new Date('2026-09-10T12:00:00Z'),
    dueDate: new Date('2026-09-11T12:00:00Z'),
    priority: 'NORMAL',
    modelIncluded: false,
    materialNeeded: false,
    materialOrdered: false,
    vendorId: null,
    poNumber: null,
    assignedMachinistId: null,
    assignedWorkerIds: [],
    partsData: [{ partNumber: 'TEST-PART', quantity: 1, materialId: null }],
    orderAttachments: [],
    partAttachments: [],
    noteContent: null,
    normalizedCustomFieldValues: [],
  });
}

describe('quote conversion order numbering', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reserves prefix numbers even after an existing order changes business', async () => {
    const tx = mockTransaction([
      { business: 'STD', orderNumber: 'STD-1002' },
      { business: 'CRM', orderNumber: 'STD-1003' },
    ]);

    await expect(convert()).resolves.toMatchObject({ orderId: 'converted-order', orderNumber: 'STD-1004' });
    expect(tx.order.create).toHaveBeenCalledOnce();
    expect(tx.orderPart.create).toHaveBeenCalledOnce();
    expect(tx.quote.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'CONVERTED' }),
    }));
  });

  it('uses the numeric maximum beyond 200 lexically newer order numbers', async () => {
    mockTransaction([
      ...Array.from({ length: 200 }, (_, index) => ({ business: 'STD', orderNumber: `STD-${9800 + index}` })),
      { business: 'STD', orderNumber: 'STD-10000' },
    ]);

    await expect(convert()).resolves.toMatchObject({ orderNumber: 'STD-10001' });
  });

  it('ignores malformed suffixes and unrelated prefixes while preserving the initial sequence', async () => {
    mockTransaction([
      { business: 'STD', orderNumber: 'STD-5000-old' },
      { business: 'STD', orderNumber: 'STD-9999.5' },
      { business: 'STD', orderNumber: 'CRM-7000' },
    ]);

    await expect(convert()).resolves.toMatchObject({ orderNumber: 'STD-1001' });
  });
});
