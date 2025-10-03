import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { canAccessAdmin, isMachinist } from '@/lib/rbac';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  const user = session.user as any;
  if (!isMachinist(user) && !canAccessAdmin(user)) return new NextResponse('Forbidden', { status: 403 });

  const json = await req.json().catch(() => null);
  const { status } = json ?? {};
  const allowed = ['NEW','PROGRAMMING','RUNNING','INSPECTING','READY_FOR_ADDONS','COMPLETE','CLOSED'];
  if (!status || !allowed.includes(status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 });

  const order = await prisma.order.update({ where: { id: params.id }, data: { status } });
  await prisma.statusHistory.create({ data: { orderId: params.id, from: order.status, to: status, userId: (session.user as any).id, reason: 'Status changed' } });
  return NextResponse.json({ ok: true, order });
}
