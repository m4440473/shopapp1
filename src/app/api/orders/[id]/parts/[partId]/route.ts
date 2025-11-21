import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canAccessAdmin } from '@/lib/rbac';
import { OrderPartUpdate } from '@/lib/zod-orders';

export async function PATCH(req: NextRequest, { params }: { params: { id: string; partId: string } }) {
  const session = await getServerSession(authOptions as any);
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  const user = (session as any).user;
  if (!canAccessAdmin(user)) return new NextResponse('Forbidden', { status: 403 });

  const { id, partId } = params;
  if (!id || !partId) return NextResponse.json({ error: 'Missing id or partId' }, { status: 400 });

  const json = await req.json().catch(() => null);
  const parsed = OrderPartUpdate.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.orderPart.findFirst({ where: { id: partId, orderId: id } });
  if (!existing) {
    return NextResponse.json({ error: 'Part not found for this order' }, { status: 404 });
  }

  const payload = parsed.data;
  const data: Record<string, unknown> = {};
  if (payload.partNumber !== undefined) data.partNumber = payload.partNumber;
  if (payload.quantity !== undefined) data.quantity = payload.quantity;
  if (payload.materialId !== undefined) data.materialId = payload.materialId;
  if (payload.notes !== undefined) data.notes = payload.notes;

  const part = await prisma.orderPart.update({ where: { id: partId }, data });

  return NextResponse.json({ part });
}
