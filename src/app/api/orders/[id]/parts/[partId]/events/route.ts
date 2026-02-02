import { NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-session';

import { listPartEvents } from '@/modules/orders/orders.service';

export async function GET(req: Request, { params }: { params: { id: string; partId: string } }) {
  const session = await getServerAuthSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const { id, partId } = params;
  if (!id || !partId) return NextResponse.json({ error: 'Missing order or part id' }, { status: 400 });

  const result = await listPartEvents({ orderId: id, partId });
  if (result.ok === false) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const { events } = result.data as { events: unknown };
  return NextResponse.json({ events });
}
