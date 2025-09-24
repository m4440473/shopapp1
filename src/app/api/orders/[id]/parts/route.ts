import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { canAccessAdmin } from '@/lib/rbac';
import { OrderPartCreate } from '@/lib/zod-orders';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions as any);
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  const role = (session as any).user?.role as string | undefined;
  if (!canAccessAdmin(role)) return new NextResponse('Forbidden', { status: 403 });

  const { id } = params;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const json = await req.json().catch(() => null);
  const parsed = OrderPartCreate.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const order = await prisma.order.findUnique({ select: { id: true }, where: { id } });
  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  const payload = parsed.data;

  const part = await prisma.orderPart.create({
    data: {
      orderId: id,
      partNumber: payload.partNumber,
      quantity: payload.quantity,
      materialId: payload.materialId ?? null,
      notes: payload.notes ?? null,
    },
  });

  return NextResponse.json({ part }, { status: 201 });
}
