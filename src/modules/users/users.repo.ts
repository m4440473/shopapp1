import { prisma } from '@/lib/prisma';

const userInclude = {
  primaryDepartment: {
    select: {
      id: true,
      name: true,
    },
  },
} as const;

function sanitizeUser<T extends Record<string, unknown>>(item: T) {
  const { passwordHash, kioskPinHash, ...rest } = item as T & {
    passwordHash?: unknown;
    kioskPinHash?: unknown;
  };
  return rest;
}

export async function listUsers({
  q,
  role,
  take,
  cursor,
}: {
  q?: string;
  role?: string;
  take: number;
  cursor?: string | null;
}) {
  const where: Record<string, unknown> = {};
  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
    ];
  }
  if (role) {
    where.role = role;
  }

  const items = await prisma.user.findMany({
    where: Object.keys(where).length ? where : undefined,
    orderBy: { id: 'asc' },
    take: take + 1,
    include: userInclude,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const nextCursor = items.length > take ? (items[take] as any).id : null;
  if (nextCursor) items.pop();

  const sanitized = items.map((item) => sanitizeUser(item as Record<string, unknown>));
  return { items: sanitized, nextCursor };
}

export async function createUser(data: Record<string, unknown>) {
  const item = await prisma.user.create({ data, include: userInclude });
  return sanitizeUser(item as Record<string, unknown>);
}

export async function updateUser(id: string, data: Record<string, unknown>) {
  const item = await prisma.user.update({ where: { id }, data, include: userInclude });
  return sanitizeUser(item as Record<string, unknown>);
}

export async function findUserById(id: string) {
  return prisma.user.findUnique({ where: { id }, include: userInclude });
}

export async function findUserByKioskId(id: string) {
  return prisma.user.findUnique({
    where: { id },
    include: userInclude,
  });
}

export async function findKioskUserByPinEligibility(emailOrId: { id?: string; email?: string }) {
  return prisma.user.findFirst({
    where: {
      active: true,
      ...(emailOrId.id ? { id: emailOrId.id } : {}),
      ...(emailOrId.email ? { email: emailOrId.email } : {}),
    },
    include: userInclude,
  });
}

export async function listKioskUsers() {
  return prisma.user.findMany({
    where: {
      active: true,
    },
    orderBy: [{ name: 'asc' }, { email: 'asc' }],
    include: userInclude,
  });
}
