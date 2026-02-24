import { NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-session';
import { completeOrderPart } from '@/modules/orders/orders.service';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string; partId: string }> }) {
  const session = await getServerAuthSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const { id, partId } = await params;
  const userId = (session.user as any)?.id as string | undefined;

  const result = await completeOrderPart({ orderId: id, partId, userId: userId ?? null });
  if (result.ok === false) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.data);
}
