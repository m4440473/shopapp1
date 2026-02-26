import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetServerAuthSession = vi.fn();
const mockGetAppSettings = vi.fn();
const mockUpdateQuoteApproval = vi.fn();

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
  updateQuoteApproval: mockUpdateQuoteApproval,
}));

describe('POST /api/admin/quotes/[id]/approval', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetServerAuthSession.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } });
    mockGetAppSettings.mockResolvedValue({ requirePOForQuoteApproval: true });
  });

  it('forwards requireAttachment setting and returns service validation errors', async () => {
    mockUpdateQuoteApproval.mockResolvedValue({ status: 400, error: 'An approval document must be uploaded before marking as received.' });

    const { POST } = await import('../route');
    const response = await POST(
      new Request('http://localhost/api/admin/quotes/q1/approval', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ received: true }),
      }) as any,
      { params: Promise.resolve({ id: 'q1' }) }
    );

    expect(response.status).toBe(400);
    expect(mockUpdateQuoteApproval).toHaveBeenCalledWith({
      quoteId: 'q1',
      received: true,
      attachment: undefined,
      requireAttachment: true,
    });
  });
});
