import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-session';

import { canAccessAdmin } from '@/lib/rbac';
import { OrderChargeUpdate } from '@/modules/orders/orders.schema';
import { deleteChargeForOrder, updateChargeForOrder } from '@/modules/orders/orders.service';

async function requireAdmin() {
  const session = await getServerAuthSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  const user = (session as any).user;
  if (!canAccessAdmin(user)) return new NextResponse('Forbidden', { status: 403 });
  return { session };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; chargeId: string }> }
) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const { id: orderId, chargeId } = await params;
  if (!orderId || !chargeId) {
    return NextResponse.json({ error: 'Missing order or charge id' }, { status: 400 });
  }

  const json = await req.json().catch(() => null);
  const parsed = OrderChargeUpdate.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await updateChargeForOrder({ orderId, chargeId, payload: parsed.data });
  if (result.ok === false) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const { charge } = result.data as { charge: unknown };
  return NextResponse.json({ charge });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; chargeId: string }> }
) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const { id: orderId, chargeId } = await params;
  if (!orderId || !chargeId) {
    return NextResponse.json({ error: 'Missing order or charge id' }, { status: 400 });
  }

  const result = await deleteChargeForOrder({ orderId, chargeId });
  if (result.ok === false) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true });
}
