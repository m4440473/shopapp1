import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetServerAuthSession = vi.fn();
const mockGetAppSettings = vi.fn();
const mockFindQuoteForConversion = vi.fn();
const mockFindActiveOrderCustomFields = vi.fn();
const mockConvertQuoteToOrder = vi.fn();
const mockSyncChecklistForOrder = vi.fn();

vi.mock('@/lib/auth-session', () => ({
  getServerAuthSession: mockGetServerAuthSession,
}));

vi.mock('@/lib/rbac', () => ({
  canAccessAdmin: () => true,
}));

vi.mock('@/lib/app-settings', () => ({
  getAppSettings: mockGetAppSettings,
}));

vi.mock('@/modules/quotes/quotes.service', () => ({
  findQuoteForConversion: mockFindQuoteForConversion,
  findActiveOrderCustomFields: mockFindActiveOrderCustomFields,
  convertQuoteToOrder: mockConvertQuoteToOrder,
}));

vi.mock('@/modules/orders/orders.service', () => ({
  syncChecklistForOrder: mockSyncChecklistForOrder,
}));

describe('POST /api/admin/quotes/[id]/convert', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetServerAuthSession.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } });
    mockGetAppSettings.mockResolvedValue({
      requirePOForQuoteToOrder: false,
      attachmentsDir: '/tmp',
    });
  });

  it('returns 409 when quote is already converted', async () => {
    mockFindQuoteForConversion.mockResolvedValue({
      id: 'q1',
      business: 'STD',
      customerId: 'c1',
      companyName: 'Acme',
      metadata: JSON.stringify({ conversion: { orderId: 'o1', orderNumber: 'STD-0005' } }),
      parts: [{ id: 'qp1', name: 'Part A', quantity: 1 }],
      attachments: [],
      customer: { name: 'Acme' },
      multiPiece: false,
    });

    const { POST } = await import('../route');
    const response = await POST(new Request('http://localhost/api/admin/quotes/q1/convert', { method: 'POST' }) as any, {
      params: Promise.resolve({ id: 'q1' }),
    });

    expect(response.status).toBe(409);
    expect(mockConvertQuoteToOrder).not.toHaveBeenCalled();
  });

  it('returns 400 when PO attachment is required but missing', async () => {
    mockGetAppSettings.mockResolvedValue({
      requirePOForQuoteToOrder: true,
      attachmentsDir: '/tmp',
    });
    mockFindQuoteForConversion.mockResolvedValue({
      id: 'q1',
      business: 'STD',
      customerId: 'c1',
      companyName: 'Acme',
      metadata: JSON.stringify({ approval: { received: false } }),
      parts: [{ id: 'qp1', name: 'Part A', quantity: 1 }],
      attachments: [],
      customer: { name: 'Acme' },
      multiPiece: false,
    });

    const { POST } = await import('../route');
    const response = await POST(new Request('http://localhost/api/admin/quotes/q1/convert', { method: 'POST' }) as any, {
      params: Promise.resolve({ id: 'q1' }),
    });

    expect(response.status).toBe(400);
    expect(mockConvertQuoteToOrder).not.toHaveBeenCalled();
  });

  it('converts quote and filters custom fields to active order fields only', async () => {
    mockFindQuoteForConversion.mockResolvedValue({
      id: 'q1',
      quoteNumber: 'STD-QUO-1',
      business: 'STD',
      customerId: 'c1',
      companyName: 'Acme',
      materialSummary: null,
      purchaseItems: null,
      requirements: null,
      notes: null,
      metadata: JSON.stringify({ approval: { attachmentId: 'att-1' } }),
      parts: [{ id: 'qp1', name: 'Part A', quantity: 2, materialId: null, stockSize: null, cutLength: null, description: null, notes: null, pieceCount: 1, partNumber: 'A-1' }],
      attachments: [],
      customer: { name: 'Acme' },
      multiPiece: false,
    });
    mockFindActiveOrderCustomFields.mockResolvedValue([{ id: 'cf-allowed' }]);
    mockConvertQuoteToOrder.mockResolvedValue({ orderId: 'o1', orderNumber: 'STD-2001', metadata: { conversion: { orderId: 'o1' } } });

    const { POST } = await import('../route');
    const response = await POST(
      new Request('http://localhost/api/admin/quotes/q1/convert', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          customFieldValues: [
            { fieldId: 'cf-allowed', value: 'yes' },
            { fieldId: 'cf-denied', value: 'no' },
          ],
        }),
      }) as any,
      { params: Promise.resolve({ id: 'q1' }) }
    );

    expect(response.status).toBe(200);
    expect(mockConvertQuoteToOrder).toHaveBeenCalledTimes(1);
    const args = mockConvertQuoteToOrder.mock.calls[0][0];
    expect(args.normalizedCustomFieldValues).toEqual([{ fieldId: 'cf-allowed', value: '"yes"' }]);
    expect(mockSyncChecklistForOrder).toHaveBeenCalledWith('o1');
  });
});
