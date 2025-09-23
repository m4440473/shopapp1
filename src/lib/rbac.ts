export type RoleName = 'ADMIN' | 'MACHINIST' | 'VIEWER';

export function canAccessAdmin(user: { role?: string }) {
  return user?.role === 'ADMIN';
}

export function canAccessMachinist(user: { role?: string }) {
  return user?.role === 'MACHINIST';
}

export function canAccessViewer(user: { role?: string }) {
  return user?.role === 'VIEWER';
}

export function canMoveStatusBackward(role?: string): boolean {
  return role === 'ADMIN';
}

export function isMachinist(role?: string): boolean {
  return role === 'MACHINIST' || role === 'ADMIN';
}

export function isViewer(role?: string): boolean {
  return role === 'VIEWER' || role === 'ADMIN';
}

export function requireRole(role: string | undefined, predicate: (r?: string) => boolean): void {
  if (!predicate(role)) {
    throw new Response('Forbidden', { status: 403 }) as unknown as never;
  }
}
