import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const mocks = vi.hoisted(() => ({ session: vi.fn(), status: vi.fn(), converse: vi.fn(), list: vi.fn(), get: vi.fn(), index: vi.fn(), remove: vi.fn() }));
vi.mock('@/lib/auth-session', () => ({ getServerAuthSession: mocks.session }));
vi.mock('@/modules/assistant/assistant.service', () => ({ assistantStatus: mocks.status, converse: mocks.converse, listConversations: mocks.list, getConversation: mocks.get, refreshDocumentIndex: mocks.index, deleteConversation: mocks.remove }));
import { GET, POST, DELETE } from './route';
beforeEach(() => { vi.clearAllMocks(); mocks.list.mockResolvedValue([]); mocks.status.mockResolvedValue({ ready: true }); });
const request = (method = 'GET', body?: string, origin?: string) => new NextRequest('http://localhost:3000/api/admin/assistant', { method, headers: { host: 'localhost:3000', ...(origin && { origin }) }, ...(body && { body }) });
describe('assistant API authorization', () => {
  it('denies unauthenticated reads and writes', async () => {
    mocks.session.mockResolvedValue(null);
    expect((await GET(request())).status).toBe(401);
    expect((await POST(request('POST', '{}'))).status).toBe(401);
    expect((await DELETE(request('DELETE'))).status).toBe(401);
    expect(mocks.status).not.toHaveBeenCalled();
  });
  it('denies non-admin users', async () => {
    mocks.session.mockResolvedValue({ user: { id: 'worker', role: 'MACHINIST' } });
    expect((await POST(request('POST', '{"message":"hi"}'))).status).toBe(403);
    expect(mocks.converse).not.toHaveBeenCalled();
  });
  it('denies cross-origin mutation and malformed payloads', async () => {
    mocks.session.mockResolvedValue({ user: { id: 'owner', role: 'ADMIN' } });
    expect((await POST(request('POST', '{"message":"hi"}', 'https://evil.example'))).status).toBe(403);
    expect((await POST(request('POST', '{bad'))).status).toBe(400);
  });
  it('uses authenticated identity, not a supplied identity', async () => {
    mocks.session.mockResolvedValue({ user: { id: 'owner', role: 'ADMIN' } });
    expect((await POST(request('POST', '{"message":"hi","userId":"other"}'))).status).toBe(400);
    const response = await POST(request('POST', '{"message":"hi"}'));
    await response.text();
    expect(mocks.converse.mock.calls[0][0]).toBe('owner');
  });
});
