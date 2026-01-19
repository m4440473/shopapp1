import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { canAccessAdmin } from '@/lib/rbac';
import { OrderChargeUpdate } from '@/lib/zod-charges';
import { syncChecklistForOrder } from '@/lib/order-charges';

function toDecimal(value: string) {
  return new Prisma.Decimal(value);
}

function serializeCharge(charge: any) {
  const quantity = charge.quantity instanceof Prisma.Decimal ? charge.quantity : new Prisma.Decimal(charge.quantity);
  const unitPrice = charge.unitPrice instanceof Prisma.Decimal ? charge.unitPrice : new Prisma.Decimal(charge.unitPrice);
  return {
    ...charge,
    quantity: quantity.toString(),
    unitPrice: unitPrice.toString(),
    totalPrice: unitPrice.mul(quantity).toString(),
  };
}

async function requireAdmin() {
  const session = await getServerSession(authOptions as any);
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  const user = (session as any).user;
  if (!canAccessAdmin(user)) return new NextResponse('Forbidden', { status: 403 });
  return { session };
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string; chargeId: string } }) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const { id: orderId, chargeId } = params;
  if (!orderId || !chargeId) {
    return NextResponse.json({ error: 'Missing order or charge id' }, { status: 400 });
  }

  const charge = await prisma.orderCharge.findFirst({
    where: { id: chargeId, orderId },
    select: { id: true, partId: true, kind: true },
  });
  if (!charge) return NextResponse.json({ error: 'Charge not found' }, { status: 404 });

  const json = await req.json().catch(() => null);
  const parsed = OrderChargeUpdate.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const payload = parsed.data;
  const nextKind = payload.kind ?? charge.kind;
  const nextPartId = payload.partId !== undefined ? payload.partId : charge.partId;

  if ((nextKind === 'LABOR' || nextKind === 'ADDON') && !nextPartId) {
    return NextResponse.json({ error: 'partId is required for labor or addon charges.' }, { status: 400 });
  }

  if (payload.partId) {
    const part = await prisma.orderPart.findFirst({
      where: { id: payload.partId, orderId },
      select: { id: true },
    });
    if (!part) return NextResponse.json({ error: 'Part not found on order' }, { status: 404 });
  }

  if (payload.departmentId) {
    const department = await prisma.department.findUnique({
      where: { id: payload.departmentId },
      select: { id: true },
    });
    if (!department) return NextResponse.json({ error: 'Department not found' }, { status: 404 });
  }

  if (payload.addonId !== undefined && payload.addonId !== null) {
    const addon = await prisma.addon.findUnique({
      where: { id: payload.addonId },
      select: { id: true, departmentId: true },
    });
    if (!addon) return NextResponse.json({ error: 'Addon not found' }, { status: 404 });
    if (payload.departmentId && addon.departmentId !== payload.departmentId) {
      return NextResponse.json({ error: 'Addon does not belong to department' }, { status: 400 });
    }
  }

  const data: Record<string, any> = {};
  if (payload.partId !== undefined) data.partId = payload.partId ?? null;
  if (payload.departmentId !== undefined) data.departmentId = payload.departmentId;
  if (payload.addonId !== undefined) data.addonId = payload.addonId ?? null;
  if (payload.kind !== undefined) data.kind = payload.kind;
  if (payload.name !== undefined) data.name = payload.name;
  if (payload.description !== undefined) data.description = payload.description ?? null;
  if (payload.quantity !== undefined) data.quantity = toDecimal(payload.quantity);
  if (payload.unitPrice !== undefined) data.unitPrice = toDecimal(payload.unitPrice);
  if (payload.sortOrder !== undefined) data.sortOrder = payload.sortOrder;
  if (payload.completed !== undefined) data.completedAt = payload.completed ? new Date() : null;

  const updated = await prisma.orderCharge.update({
    where: { id: chargeId },
    data,
    include: { department: true, part: true },
  });

  await syncChecklistForOrder(orderId);

  return NextResponse.json({ charge: serializeCharge(updated) });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string; chargeId: string } }) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const { id: orderId, chargeId } = params;
  if (!orderId || !chargeId) {
    return NextResponse.json({ error: 'Missing order or charge id' }, { status: 400 });
  }

  const charge = await prisma.orderCharge.findFirst({
    where: { id: chargeId, orderId },
    select: { id: true },
  });
  if (!charge) return NextResponse.json({ error: 'Charge not found' }, { status: 404 });

  await prisma.$transaction([
    prisma.orderChecklist.updateMany({
      where: { chargeId },
      data: { isActive: false },
    }),
    prisma.orderCharge.delete({ where: { id: chargeId } }),
  ]);

  await syncChecklistForOrder(orderId);

  return NextResponse.json({ ok: true });
}
