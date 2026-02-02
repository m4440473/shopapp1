import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-session';
import { canAccessAdmin } from '@/lib/rbac';
import { createOrderFromPayload, listOrdersForQuery } from '@/modules/orders/orders.service';
import { OrderQuery, OrderCreate } from '@/modules/orders/orders.schema';
// Status enum not used from prisma; statuses are strings in this schema

/** GET /api/orders — list with filters & cursor pagination */
export async function GET(req: NextRequest) {
  const session = await getServerAuthSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const url = new URL(req.url);
  const qs = Object.fromEntries(url.searchParams.entries());
  const parsed = OrderQuery.safeParse(qs);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { q, status, priority, assignedMachinistId, customerId, overdue, awaitingMaterial, take, cursor } = parsed.data;

  const result = await listOrdersForQuery({
    q,
    status,
    priority,
    assignedMachinistId,
    customerId,
    overdue,
    awaitingMaterial,
    take,
    cursor,
  });
  if (result.ok === false) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.data);
}

/** POST /api/orders — create order with parts, checklist, initial status */
export async function POST(req: NextRequest) {
  const session = await getServerAuthSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  const user = session.user as any;
  if (!canAccessAdmin(user)) return new NextResponse('Forbidden', { status: 403 });

  const json = await req.json().catch(() => null);
  const parsed = OrderCreate.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data;
  const userId = (session.user as any)?.id as string | undefined;
  const result = await createOrderFromPayload(body, userId);
  if (result.ok === false) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const { id } = result.data as { id: unknown };
  return NextResponse.json({ id }, { status: 201 });
}
