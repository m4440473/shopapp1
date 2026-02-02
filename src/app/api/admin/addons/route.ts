import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-session';
import { z } from 'zod';

import { canAccessAdmin } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { AddonUpsert, ListQuery } from '@/lib/zod';

async function requireAdmin() {
  const session = await getServerAuthSession();
  if (!session) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  const user = session.user as any;
  if (!canAccessAdmin(user)) {
    return new NextResponse('Forbidden', { status: 403 });
  }
  return { session };
}

const QuerySchema = ListQuery.extend({
  active: z
    .union([z.string().transform((value) => value === 'true'), z.boolean()])
    .optional(),
});

export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

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
    include: { department: true },
  });
  const nextCursor = items.length > take ? items[take]?.id ?? null : null;
  if (nextCursor) items.pop();
  return NextResponse.json({ items, nextCursor });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const body = await req.json();
  const parsed = AddonUpsert.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const data = parsed.data;
  const item = await prisma.addon.create({ data, include: { department: true } });
  return NextResponse.json({ ok: true, item });
}
