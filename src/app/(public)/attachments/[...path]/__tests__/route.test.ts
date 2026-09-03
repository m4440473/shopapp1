import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetServerAuthSession = vi.fn();
const mockResolveStoredAttachmentAccess = vi.fn();

vi.mock('@/lib/auth-session', () => ({ getServerAuthSession: mockGetServerAuthSession }));
vi.mock('@/lib/rbac', () => ({ canAccessAdmin: (user: { role?: string }) => user?.role === 'ADMIN' }));
vi.mock('@/modules/attachments/attachment-access.service', () => ({
  resolveStoredAttachmentAccess: mockResolveStoredAttachmentAccess,
}));

describe('GET /attachments/[...path]', () => {
  beforeEach(() => vi.resetAllMocks());

  it('requires an authenticated session before resolving a file', async () => {
    mockGetServerAuthSession.mockResolvedValue(null);
    const { GET } = await import('../route');
    const response = await GET(new Request('http://localhost/attachments/private.pdf') as any, {
      params: Promise.resolve({ path: ['private.pdf'] }),
    });
    expect(response.status).toBe(401);
    expect(mockResolveStoredAttachmentAccess).not.toHaveBeenCalled();
  });

  it('enforces the non-admin attachment policy on the download route', async () => {
    mockGetServerAuthSession.mockResolvedValue({ user: { id: 'worker-1', role: 'USER' } });
    mockResolveStoredAttachmentAccess.mockResolvedValue({ ok: false, status: 403, error: 'Forbidden' });
    const { GET } = await import('../route');
    const response = await GET(new Request('http://localhost/attachments/customer-po.pdf') as any, {
      params: Promise.resolve({ path: ['customer-po.pdf'] }),
    });
    expect(response.status).toBe(403);
    expect(mockResolveStoredAttachmentAccess).toHaveBeenCalledWith('customer-po.pdf', false);
  });
});
