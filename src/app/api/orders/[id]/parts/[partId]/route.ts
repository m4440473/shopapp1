import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canAccessAdmin } from '@/lib/rbac';
import { syncChecklistForOrder } from '@/modules/orders/orders.service';
import { OrderPartUpdate } from '@/modules/orders/orders.schema';

export async function PATCH(req: NextRequest, { params }: { params: { id: string; partId: string } }) {
  const session = await getServerSession(authOptions as any);
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  const user = (session as any).user;
  if (!canAccessAdmin(user)) return new NextResponse('Forbidden', { status: 403 });
  const userId = (session as any)?.user?.id as string | undefined;

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
  if (payload.stockSize !== undefined) data.stockSize = payload.stockSize;
  if (payload.cutLength !== undefined) data.cutLength = payload.cutLength;
  if (payload.notes !== undefined) data.notes = payload.notes;

  const part = await prisma.orderPart.update({ where: { id: partId }, data });

  if (userId) {
    await prisma.note.create({
      data: {
        orderId: id,
        userId,
        content: `Updated part ${part.partNumber}.`,
      },
    });
  }

  return NextResponse.json({ part });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string; partId: string } }) {
  const session = await getServerSession(authOptions as any);
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  const user = (session as any).user;
  if (!canAccessAdmin(user)) return new NextResponse('Forbidden', { status: 403 });
  const userId = (session as any)?.user?.id as string | undefined;

  const { id, partId } = params;
  if (!id || !partId) return NextResponse.json({ error: 'Missing id or partId' }, { status: 400 });

  const partCount = await prisma.orderPart.count({ where: { orderId: id } });
  if (partCount <= 1) {
    return NextResponse.json({ error: 'Orders must contain at least one part.' }, { status: 400 });
  }

  const part = await prisma.orderPart.findFirst({
    where: { id: partId, orderId: id },
    select: { id: true, partNumber: true, quantity: true, charges: { select: { id: true } } },
  });
  if (!part) {
    return NextResponse.json({ error: 'Part not found for this order' }, { status: 404 });
  }

  const chargeIds = part.charges.map((charge) => charge.id);

  await prisma.$transaction([
    ...(chargeIds.length
      ? [
          prisma.orderChecklist.updateMany({
            where: { chargeId: { in: chargeIds } },
            data: { isActive: false },
          }),
          prisma.orderCharge.deleteMany({ where: { id: { in: chargeIds } } }),
        ]
      : []),
    prisma.orderChecklist.updateMany({
      where: { partId },
      data: { isActive: false },
    }),
    prisma.partAttachment.deleteMany({ where: { partId } }),
    prisma.orderPart.delete({ where: { id: partId } }),
    ...(userId
      ? [
          prisma.note.create({
            data: {
              orderId: id,
              userId,
              content: `Removed part ${part.partNumber} (qty ${part.quantity}).`,
            },
          }),
        ]
      : []),
  ]);

  await syncChecklistForOrder(id);

  return NextResponse.json({ ok: true });
}
