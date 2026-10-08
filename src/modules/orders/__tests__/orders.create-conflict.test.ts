import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  create: vi.fn(), generate: vi.fn(), fields: vi.fn(), addons: vi.fn(), departments: vi.fn(),
  contact: vi.fn(), finalize: vi.fn(),
}));
vi.mock('@/repos/orders', () => ({
  createOrderWithCustomFields: mocks.create,
  generateNextOrderNumber: mocks.generate,
  findActiveOrderCustomFields: mocks.fields,
  listAddonsByIds: mocks.addons,
  listDepartmentsOrdered: mocks.departments,
}));
vi.mock('@/modules/customers/customers.service', () => ({ resolveCustomerContactSnapshot: mocks.contact }));
vi.mock('../orders.files.service', () => ({ ensureOrderFilesInCanonicalStorage: mocks.finalize }));

import { createOrderFromPayload } from '../orders.create.service';
import { OrderCreate } from '../orders.schema';

function conflict(target: unknown = ['orderNumber'], code = 'P2002') {
  return Object.assign(new Error('Synthetic database conflict'), { code, meta: { target } });
}
function payload(orderNumber?: string) {
  return OrderCreate.parse({
    business: 'STD', customerId: 'synthetic-customer', orderNumber,
    receivedDate: '2026-09-10', dueDate: '2026-09-17',
    parts: [{ partNumber: 'SYNTHETIC-1', quantity: 2 }],
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.generate.mockResolvedValue('STD-1004');
  mocks.create.mockResolvedValue({ id: 'new-order', parts: [{ id: 'new-part' }] });
  mocks.fields.mockResolvedValue([]);
  mocks.addons.mockResolvedValue([]);
  mocks.departments.mockResolvedValue([]);
  mocks.contact.mockResolvedValue(null);
  mocks.finalize.mockResolvedValue({ ok: true });
});

describe('direct order creation number conflicts', () => {
  it('reallocates after a racing automatic number conflict and finalizes only the committed order', async () => {
    mocks.generate.mockResolvedValueOnce('STD-1003').mockResolvedValueOnce('STD-1004');
    mocks.create.mockRejectedValueOnce(conflict());
    expect(await createOrderFromPayload(payload())).toMatchObject({ ok: true, data: { id: 'new-order' } });
    expect(mocks.create.mock.calls.map(([input]) => input.orderData.data.orderNumber)).toEqual(['STD-1003', 'STD-1004']);
    expect(mocks.create.mock.calls[1][0].relatedData).toEqual(mocks.create.mock.calls[0][0].relatedData);
    expect(mocks.finalize).toHaveBeenCalledTimes(1);
    expect(mocks.finalize).toHaveBeenCalledWith('new-order');
  });

  it('returns 409 for an explicitly supplied duplicate without changing the requested number', async () => {
    mocks.create.mockRejectedValueOnce(conflict());
    expect(await createOrderFromPayload(payload('STD-1003'))).toMatchObject({ ok: false, status: 409 });
    expect(mocks.generate).not.toHaveBeenCalled();
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.finalize).not.toHaveBeenCalled();
  });

  it('stops after three known rolled-back automatic number conflicts', async () => {
    mocks.create.mockRejectedValue(conflict());
    expect(await createOrderFromPayload(payload())).toMatchObject({ ok: false, status: 503 });
    expect(mocks.create).toHaveBeenCalledTimes(3);
    expect(mocks.generate).toHaveBeenCalledTimes(3);
    expect(mocks.finalize).not.toHaveBeenCalled();
  });

  it.each([
    ['another unique constraint', () => conflict(['partId', 'addonId'])],
    ['a mixed target', () => conflict(['orderNumber', 'anotherField'])],
    ['an unknown unique target', () => conflict(null)],
    ['a foreign-key error', () => conflict(['orderNumber'], 'P2003')],
    ['an uncertain transaction outcome', () => new Error('Connection closed')],
  ])('does not retry %s', async (_description, makeError) => {
    const error = makeError();
    mocks.create.mockRejectedValueOnce(error);
    await expect(createOrderFromPayload(payload())).rejects.toBe(error);
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.generate).toHaveBeenCalledTimes(1);
    expect(mocks.finalize).not.toHaveBeenCalled();
  });
});
