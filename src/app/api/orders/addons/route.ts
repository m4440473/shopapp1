import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ListQuery } from '@/lib/zod';

const QuerySchema = ListQuery.extend({
  active: z.union([z.string().transform((value) => value === 'true'), z.boolean()]).optional(),
});

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    q: searchParams.get('q') || undefined,
    cursor: searchParams.get('cursor') || undefined,
    take: searchParams.get('take') || undefined,
    active: searchParams.get('active') || undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const { q, cursor, take, active } = parsed.data;
  const where = {
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
    ...(typeof active === 'boolean' ? { active } : {}),
  };

  const items = await prisma.addon.findMany({
    where: Object.keys(where).length ? (where as any) : undefined,
    orderBy: { name: 'asc' },
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const nextCursor = items.length > take ? items[take]?.id ?? null : null;
  if (nextCursor) items.pop();

  const sanitized = items.map(({ rateCents, ...rest }) => rest);

  return NextResponse.json({ items: sanitized, nextCursor });
}
