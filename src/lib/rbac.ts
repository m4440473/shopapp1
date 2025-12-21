export type RoleName = 'ADMIN' | 'MACHINIST' | 'VIEWER';

type RoleInput = { role?: string; admin?: boolean } | string | undefined;

function extractRole(input?: RoleInput): string | undefined {
  if (!input) return undefined;
  if (typeof input === 'string') return input;
  return (input as any).role;
}

function extractAdminFlag(input?: RoleInput): boolean {
  if (!input) return false;
  if (typeof input === 'string') return input === 'ADMIN';
  return Boolean((input as any).admin);
}

export function canAccessAdmin(userOrRole?: RoleInput) {
  if (extractAdminFlag(userOrRole)) return true;
  const role = extractRole(userOrRole);
  return role === 'ADMIN';
}

export function canAccessMachinist(userOrRole?: RoleInput) {
  if (extractAdminFlag(userOrRole)) return true;
  const role = extractRole(userOrRole);
  return role === 'MACHINIST';
}

export function canAccessViewer(userOrRole?: RoleInput) {
  if (extractAdminFlag(userOrRole)) return true;
  const role = extractRole(userOrRole);
  return role === 'VIEWER';
}

export function canMoveStatusBackward(roleOrUser?: RoleInput): boolean {
  if (extractAdminFlag(roleOrUser)) return true;
  const role = extractRole(roleOrUser);
  return role === 'ADMIN';
}

export function isMachinist(roleOrUser?: RoleInput): boolean {
  if (extractAdminFlag(roleOrUser)) return true;
  const role = extractRole(roleOrUser);
  return role === 'MACHINIST' || role === 'ADMIN';
}

export function isViewer(roleOrUser?: RoleInput): boolean {
  if (extractAdminFlag(roleOrUser)) return true;
  const role = extractRole(roleOrUser);
  return role === 'VIEWER' || role === 'ADMIN';
}

export function canViewQuotes(roleOrUser?: RoleInput): boolean {
  if (extractAdminFlag(roleOrUser)) return true;
  const role = extractRole(roleOrUser);
  return role === 'ADMIN';
}

export function requireRole(roleOrUser: RoleInput, predicate: (r?: string) => boolean): void {
  if (extractAdminFlag(roleOrUser)) return;
  const role = extractRole(roleOrUser as any);
  if (!predicate(role)) {
    throw new Response('Forbidden', { status: 403 }) as unknown as never;
  }
}
