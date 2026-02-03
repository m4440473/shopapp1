import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-session';

import { canAccessAdmin } from '@/lib/rbac';
import { deleteOrderPartDetails, updateOrderPartDetails } from '@/modules/orders/orders.service';
import { OrderPartUpdate } from '@/modules/orders/orders.schema';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; partId: string }> }
) {
  const session = await getServerAuthSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  const user = (session as any).user;
  if (!canAccessAdmin(user)) return new NextResponse('Forbidden', { status: 403 });
  const userId = (session as any)?.user?.id as string | undefined;

  const { id, partId } = await params;
  if (!id || !partId) return NextResponse.json({ error: 'Missing id or partId' }, { status: 400 });

  const json = await req.json().catch(() => null);
  const parsed = OrderPartUpdate.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await updateOrderPartDetails({
    orderId: id,
    partId,
    payload: parsed.data,
    userId,
  });
  if (result.ok === false) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const { part } = result.data as { part: unknown };
  return NextResponse.json({ part });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; partId: string }> }
) {
  const session = await getServerAuthSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  const user = (session as any).user;
  if (!canAccessAdmin(user)) return new NextResponse('Forbidden', { status: 403 });
  const userId = (session as any)?.user?.id as string | undefined;

  const { id, partId } = await params;
  if (!id || !partId) return NextResponse.json({ error: 'Missing id or partId' }, { status: 400 });

  const result = await deleteOrderPartDetails({ orderId: id, partId, userId });
  if (result.ok === false) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true });
}
