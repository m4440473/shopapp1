import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-session';

import { getOrderHeaderInfo, getOrderPartSummary } from '@/modules/orders/orders.service';
import { getActiveTimeEntry, getOrderPartTimeTotals } from '@/modules/time/time.service';

export async function GET(req: NextRequest) {
  const session = await getServerAuthSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const userId = (session.user as any)?.id as string | undefined;
  if (!userId) return new NextResponse('Unauthorized', { status: 401 });

  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get('orderId') ?? '';
  const partIds = (searchParams.get('partIds') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  const activeResult = await getActiveTimeEntry(userId);
  if (activeResult.ok === false) {
    return NextResponse.json({ error: activeResult.error }, { status: activeResult.status });
  }

  const activeEntry = activeResult.data.entry;
  const orderResult = activeEntry ? await getOrderHeaderInfo(activeEntry.orderId) : null;
  const partResult = activeEntry?.partId
    ? await getOrderPartSummary(activeEntry.orderId, activeEntry.partId)
    : null;

  const totalsResult = orderId && partIds.length ? await getOrderPartTimeTotals(orderId, partIds) : null;

  return NextResponse.json({
    activeEntry,
    activeOrder: orderResult?.ok ? orderResult.data.order : null,
    activePart: partResult?.ok ? partResult.data.part : null,
    totals: totalsResult?.ok ? totalsResult.data.totals : {},
  });
}
