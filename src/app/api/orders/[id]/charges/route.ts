import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { canAccessAdmin } from '@/lib/rbac';
import { OrderChargeCreate } from '@/lib/zod-charges';
import { syncChecklistForOrder } from '@/lib/order-charges';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions as any);
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  const user = (session as any).user;
  if (!canAccessAdmin(user)) return new NextResponse('Forbidden', { status: 403 });

  const { id: orderId } = params;
  if (!orderId) return NextResponse.json({ error: 'Missing order id' }, { status: 400 });

  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true } });
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  const json = await req.json().catch(() => null);
  const parsed = OrderChargeCreate.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const payload = parsed.data;
  let departmentId = payload.departmentId;
  let name = payload.name;
  let kind = payload.kind;
  let addonId = payload.addonId ?? null;

  if (addonId) {
    const addon = await prisma.addon.findUnique({
      where: { id: addonId },
      select: { id: true, name: true, rateCents: true, departmentId: true },
    });
    if (!addon) return NextResponse.json({ error: 'Addon not found' }, { status: 404 });
    departmentId = addon.departmentId;
    name = name?.trim().length ? name : addon.name;
    kind = 'ADDON';
    if (payload.unitPrice === 0) {
      payload.unitPrice = addon.rateCents / 100;
    }
  }

  const charge = await prisma.orderCharge.create({
    data: {
      orderId,
      partId: payload.partId ?? null,
      departmentId,
      addonId,
      kind,
      name,
      description: payload.description ?? null,
      quantity: new Prisma.Decimal(payload.quantity),
      unitPrice: new Prisma.Decimal(payload.unitPrice),
      sortOrder: payload.sortOrder ?? 0,
    },
    include: { department: true, addon: true },
  });

  await syncChecklistForOrder(orderId);

  return NextResponse.json({ charge }, { status: 201 });
}
