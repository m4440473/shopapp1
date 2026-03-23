import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-session';
import { canAccessAdmin } from '@/lib/rbac';
import { updateOrderWorkflowStatusByAdmin } from '@/modules/orders/orders.service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerAuthSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  const user = session.user as any;
  if (!canAccessAdmin(user)) return new NextResponse('Forbidden', { status: 403 });

  const { id } = await params;
  const json = await req.json().catch(() => null);
  const { status, reason } = json ?? {};
  const result = await updateOrderWorkflowStatusByAdmin({
    orderId: id,
    status,
    reason: typeof reason === 'string' ? reason : '',
    userId: (session.user as any).id,
    actorName: typeof user?.name === 'string' && user.name.trim().length ? user.name : user?.email,
  });

  if (result.ok === false) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const { order } = result.data as { order: unknown };
  return NextResponse.json({ ok: true, order });
}
