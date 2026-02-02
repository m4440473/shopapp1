import 'server-only';

import { NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-session';
import { getTimeEntrySummary } from '@/modules/time/time.service';

export async function GET(req: Request) {
  const session = await getServerAuthSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const userId = (session.user as any)?.id as string | undefined;
  if (!userId) return new NextResponse('Unauthorized', { status: 401 });

  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get('orderId')?.trim();
  if (!orderId) {
    return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
  }

  const partIdsParam = searchParams.get('partIds') ?? '';
  const partIds = partIdsParam
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  const result = await getTimeEntrySummary(userId, orderId, partIds);
  if (result.ok === false) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.data, { status: 200 });
}
