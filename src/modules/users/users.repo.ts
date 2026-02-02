import { prisma } from '@/lib/prisma';

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
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const nextCursor = items.length > take ? (items[take] as any).id : null;
  if (nextCursor) items.pop();

  const sanitized = items.map(({ passwordHash, ...rest }) => rest);
  return { items: sanitized, nextCursor };
}

export async function createUser(data: Record<string, unknown>) {
  const item = await prisma.user.create({ data });
  const { passwordHash, ...rest } = item as any;
  return rest;
}

export async function updateUser(id: string, data: Record<string, unknown>) {
  const item = await prisma.user.update({ where: { id }, data });
  const { passwordHash, ...rest } = item as any;
  return rest;
}

export async function findUserById(id: string) {
  return prisma.user.findUnique({ where: { id } });
}
