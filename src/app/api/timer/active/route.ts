import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-session';

import { getOrderHeaderInfo, getOrderPartSummary } from '@/modules/orders/orders.service';
import { getActiveTimeEntries, getActiveTimeEntry, getOrderPartTimeTotals, getTimeEntrySummary } from '@/modules/time/time.service';

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
  const activeEntriesResult = await getActiveTimeEntries(userId);
  if (activeEntriesResult.ok === false) {
    return NextResponse.json({ error: activeEntriesResult.error }, { status: activeEntriesResult.status });
  }

  const activeEntriesWithContext = await Promise.all(
    activeEntriesResult.data.entries.map(async (entry) => {
      const [orderResult, partResult] = await Promise.all([
        getOrderHeaderInfo(entry.orderId),
        entry.partId ? getOrderPartSummary(entry.orderId, entry.partId) : Promise.resolve(null),
      ]);

      const order = orderResult.ok ? (orderResult.data as { order: unknown }).order : null;
      const part = partResult?.ok ? (partResult.data as { part: unknown }).part : null;
      const href = entry.partId ? `/orders/${entry.orderId}?part=${entry.partId}` : `/orders/${entry.orderId}`;

      return {
        ...entry,
        href,
        order,
        part,
      };
    })
  );

  const activeEntry = activeResult.data.entry;
  const orderResult = activeEntry ? await getOrderHeaderInfo(activeEntry.orderId) : null;
  const partResult = activeEntry?.partId
    ? await getOrderPartSummary(activeEntry.orderId, activeEntry.partId)
    : null;
  const activeOrder = orderResult?.ok ? (orderResult.data as { order: unknown }).order : null;
  const activePart = partResult?.ok ? (partResult.data as { part: unknown }).part : null;

  const totalsResult = orderId && partIds.length ? await getOrderPartTimeTotals(orderId, partIds) : null;
  if (totalsResult && totalsResult.ok === false) {
    return NextResponse.json({ error: totalsResult.error }, { status: totalsResult.status });
  }

  const summaryResult = orderId
    ? await getTimeEntrySummary(userId, orderId, partIds)
    : null;
  if (summaryResult && summaryResult.ok === false) {
    return NextResponse.json({ error: summaryResult.error }, { status: summaryResult.status });
  }

  return NextResponse.json({
    activeEntry,
    activeEntries: activeEntriesWithContext,
    activeOrder,
    activePart,
    totalsSeconds: totalsResult?.ok ? totalsResult.data.totalsSeconds : {},
    lastPartEntries: summaryResult?.ok ? summaryResult.data.lastPartEntries : {},
  });
}
