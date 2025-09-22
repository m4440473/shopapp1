import { Role } from '@prisma/client';

export type RoleName = keyof typeof Role; // 'ADMIN' | 'MACHINIST' | 'VIEWER'

export function canAccessAdmin(role?: Role): boolean {
  return role === Role.ADMIN;
}

export function canMoveStatusBackward(role?: Role): boolean {
  return role === Role.ADMIN;
}

export function isMachinist(role?: Role): boolean {
  return role === Role.MACHINIST || role === Role.ADMIN;
}

export function isViewer(role?: Role): boolean {
  return role === Role.VIEWER || role === Role.ADMIN;
}

export function requireRole(role: Role | undefined, predicate: (r?: Role) => boolean): void {
  if (!predicate(role)) {
    throw new Response('Forbidden', { status: 403 }) as unknown as never;
  }
}
