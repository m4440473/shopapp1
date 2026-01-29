import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { canAccessAdmin } from '@/lib/rbac';
import { OrderChargeCreate } from '@/modules/orders/orders.schema';
import { createChargeForOrder, listChargesForOrder } from '@/modules/orders/orders.service';

async function requireAdmin() {
  const session = await getServerSession(authOptions as any);
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  const user = (session as any).user;
  if (!canAccessAdmin(user)) return new NextResponse('Forbidden', { status: 403 });
  return { session };
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const { id: orderId } = params;
  if (!orderId) return NextResponse.json({ error: 'Missing order id' }, { status: 400 });

  const result = await listChargesForOrder(orderId);
  if (result.ok === false) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const { charges } = result.data as { charges: unknown };
  return NextResponse.json({ charges });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const { id: orderId } = params;
  if (!orderId) return NextResponse.json({ error: 'Missing order id' }, { status: 400 });

  const json = await req.json().catch(() => null);
  const parsed = OrderChargeCreate.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await createChargeForOrder({ orderId, payload: parsed.data });
  if (result.ok === false) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const { charge } = result.data as { charge: unknown };
  return NextResponse.json({ charge }, { status: 201 });
}
