import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { canAccessAdmin, isMachinist } from '@/lib/rbac';
import { updateOrderStatusForEmployee } from '@/modules/orders/orders.service';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  const user = session.user as any;
  if (!isMachinist(user) && !canAccessAdmin(user)) return new NextResponse('Forbidden', { status: 403 });

  const json = await req.json().catch(() => null);
  const { status } = json ?? {};
  const employeeName = typeof json?.employeeName === 'string' ? json.employeeName.trim() : '';
  const result = await updateOrderStatusForEmployee({
    orderId: params.id,
    status,
    employeeName,
    userId: (session.user as any).id,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, order: result.data.order });
}
