import { NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-session';
import { isTestMode } from '@/lib/testMode';
import { listOrdersForQuery } from '@/modules/orders/orders.service';

export async function GET() {
  if (!isTestMode()) {
    return new NextResponse('Not found', { status: 404 });
  }

  const session = await getServerAuthSession();
  const whoami = session?.user ?? null;

  const ordersResult = await listOrdersForQuery({ take: 10 });
  if (ordersResult.ok === false) {
    return NextResponse.json({ whoami, ordersError: ordersResult.error }, { status: ordersResult.status });
  }

  return NextResponse.json({ whoami, orders: ordersResult.data.items });
}
