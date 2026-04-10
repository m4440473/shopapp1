import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-session';
import { canAccessAdmin } from '@/lib/rbac';
import { RepeatOrderTemplateCreateFromOrder } from '@/modules/repeat-orders/repeat-orders.schema';
import { snapshotRepeatOrderTemplateFromOrder } from '@/modules/repeat-orders/repeat-orders.service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const session = await getServerAuthSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  if (!canAccessAdmin(session.user as any)) return new NextResponse('Forbidden', { status: 403 });

  const json = await req.json().catch(() => null);
  const parsed = RepeatOrderTemplateCreateFromOrder.safeParse(json ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { orderId } = await params;
  const result = await snapshotRepeatOrderTemplateFromOrder(
    orderId,
    parsed.data,
    (session.user as any)?.id as string | undefined,
  );
  if (result.ok === false) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.data, { status: 201 });
}
