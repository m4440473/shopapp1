export type RoleName = 'ADMIN' | 'MACHINIST' | 'VIEWER';

function extractRole(input?: { role?: string } | string): string | undefined {
  if (!input) return undefined;
  return typeof input === 'string' ? input : (input as any).role;
}

export function canAccessAdmin(userOrRole?: { role?: string } | string) {
  const role = extractRole(userOrRole);
  return role === 'ADMIN';
}

export function canAccessMachinist(userOrRole?: { role?: string } | string) {
  const role = extractRole(userOrRole);
  return role === 'MACHINIST';
}

export function canAccessViewer(userOrRole?: { role?: string } | string) {
  const role = extractRole(userOrRole);
  return role === 'VIEWER';
}

export function canMoveStatusBackward(roleOrUser?: { role?: string } | string): boolean {
  const role = extractRole(roleOrUser);
  return role === 'ADMIN';
}

export function isMachinist(roleOrUser?: { role?: string } | string): boolean {
  const role = extractRole(roleOrUser);
  return role === 'MACHINIST' || role === 'ADMIN';
}

export function isViewer(roleOrUser?: { role?: string } | string): boolean {
  const role = extractRole(roleOrUser);
  return role === 'VIEWER' || role === 'ADMIN';
}

export function requireRole(roleOrUser: { role?: string } | string | undefined, predicate: (r?: string) => boolean): void {
  const role = extractRole(roleOrUser as any);
  if (!predicate(role)) {
    throw new Response('Forbidden', { status: 403 }) as unknown as never;
  }
}
