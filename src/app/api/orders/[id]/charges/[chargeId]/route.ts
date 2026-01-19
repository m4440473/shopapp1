import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { canAccessAdmin } from '@/lib/rbac';
import { OrderChargeUpdate } from '@/lib/zod-charges';
import { syncChecklistForOrder } from '@/lib/order-charges';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; chargeId: string } }
) {
  const session = await getServerSession(authOptions as any);
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  const user = (session as any).user;
  if (!canAccessAdmin(user)) return new NextResponse('Forbidden', { status: 403 });

  const { id: orderId, chargeId } = params;
  if (!orderId || !chargeId) {
    return NextResponse.json({ error: 'Missing order or charge id' }, { status: 400 });
  }

  const charge = await prisma.orderCharge.findUnique({
    where: { id: chargeId },
    select: { id: true, orderId: true },
  });
  if (!charge || charge.orderId !== orderId) {
    return NextResponse.json({ error: 'Charge not found' }, { status: 404 });
  }

  const json = await req.json().catch(() => null);
  const parsed = OrderChargeUpdate.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const payload = parsed.data;
  const data: Record<string, unknown> = {};
  let addonId = payload.addonId;
  let departmentId = payload.departmentId;

  if (addonId) {
    const addon = await prisma.addon.findUnique({
      where: { id: addonId },
      select: { id: true, name: true, rateCents: true, departmentId: true },
    });
    if (!addon) return NextResponse.json({ error: 'Addon not found' }, { status: 404 });
    departmentId = addon.departmentId;
    data.name = payload.name?.trim().length ? payload.name : addon.name;
    data.kind = payload.kind ?? 'ADDON';
    if (payload.unitPrice === undefined) {
      data.unitPrice = new Prisma.Decimal(addon.rateCents / 100);
    }
  }

  if (payload.partId !== undefined) data.partId = payload.partId;
  if (departmentId !== undefined) data.departmentId = departmentId;
  if (payload.addonId !== undefined) data.addonId = addonId ?? null;
  if (payload.kind !== undefined) data.kind = payload.kind;
  if (payload.name !== undefined) data.name = payload.name;
  if (payload.description !== undefined) data.description = payload.description ?? null;
  if (payload.quantity !== undefined) data.quantity = new Prisma.Decimal(payload.quantity);
  if (payload.unitPrice !== undefined) data.unitPrice = new Prisma.Decimal(payload.unitPrice);
  if (payload.sortOrder !== undefined) data.sortOrder = payload.sortOrder;
  if (payload.completed !== undefined) {
    data.completedAt = payload.completed ? new Date() : null;
  }

  const updated = await prisma.orderCharge.update({
    where: { id: chargeId },
    data,
    include: { department: true, addon: true },
  });

  await syncChecklistForOrder(orderId);

  return NextResponse.json({ charge: updated });
}
