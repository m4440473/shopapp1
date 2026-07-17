import { describe, expect, it, vi } from 'vitest';

const { getServerAuthSessionMock, redirectMock } = vi.hoisted(() => ({
  getServerAuthSessionMock: vi.fn(),
  redirectMock: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

vi.mock('@/lib/auth-session', () => ({
  getServerAuthSession: getServerAuthSessionMock,
}));

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}));

import AdminLayout from '../layout';

describe('AdminLayout', () => {
  it('redirects signed-out visitors before rendering admin pages', async () => {
    getServerAuthSessionMock.mockResolvedValueOnce(null);

    await expect(AdminLayout({ children: 'private admin content' })).rejects.toThrow(
      'REDIRECT:/auth/signin',
    );
  });

  it('redirects signed-in non-admin users', async () => {
    getServerAuthSessionMock.mockResolvedValueOnce({
      user: { role: 'MACHINIST', admin: false },
    });

    await expect(AdminLayout({ children: 'private admin content' })).rejects.toThrow('REDIRECT:/403');
  });

  it('renders the route tree for administrators', async () => {
    getServerAuthSessionMock.mockResolvedValueOnce({
      user: { role: 'ADMIN', admin: true },
    });

    await expect(AdminLayout({ children: 'private admin content' })).resolves.toBe(
      'private admin content',
    );
  });
});
