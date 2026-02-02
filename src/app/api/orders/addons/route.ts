import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-session';
import { z } from 'zod';

import { ListQuery } from '@/lib/zod';
import { listAddonsForOrders } from '@/modules/orders/orders.service';

const QuerySchema = ListQuery.extend({
  active: z.union([z.string().transform((value) => value === 'true'), z.boolean()]).optional(),
});

export async function GET(req: NextRequest) {
  const session = await getServerAuthSession();
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
  const result = await listAddonsForOrders({ q, cursor, take, active });
  if (result.ok === false) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.data);
}
