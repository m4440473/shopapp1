import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { canAccessAdmin } from '@/lib/rbac';
import { OrderChargeCreate } from '@/modules/orders/orders.schema';
import { syncChecklistForOrder } from '@/modules/orders/orders.service';

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

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const { id: orderId } = params;
  if (!orderId) return NextResponse.json({ error: 'Missing order id' }, { status: 400 });

  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true } });
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  const charges = await prisma.orderCharge.findMany({
    where: { orderId },
    include: { department: true, part: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });

  return NextResponse.json({ charges: charges.map(serializeCharge) });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

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
  if (payload.partId) {
    const part = await prisma.orderPart.findFirst({
      where: { id: payload.partId, orderId },
      select: { id: true },
    });
    if (!part) return NextResponse.json({ error: 'Part not found on order' }, { status: 404 });
  }

  const department = await prisma.department.findUnique({
    where: { id: payload.departmentId },
    select: { id: true },
  });
  if (!department) return NextResponse.json({ error: 'Department not found' }, { status: 404 });

  if (payload.addonId) {
    const addon = await prisma.addon.findUnique({
      where: { id: payload.addonId },
      select: { id: true, departmentId: true },
    });
    if (!addon) return NextResponse.json({ error: 'Addon not found' }, { status: 404 });
    if (addon.departmentId !== payload.departmentId) {
      return NextResponse.json({ error: 'Addon does not belong to department' }, { status: 400 });
    }
  }

  const charge = await prisma.orderCharge.create({
    data: {
      orderId,
      partId: payload.partId ?? null,
      departmentId: payload.departmentId,
      addonId: payload.addonId ?? null,
      kind: payload.kind,
      name: payload.name,
      description: payload.description ?? null,
      quantity: toDecimal(payload.quantity),
      unitPrice: toDecimal(payload.unitPrice),
      sortOrder: payload.sortOrder ?? 0,
    },
    include: { department: true, part: true },
  });

  await syncChecklistForOrder(orderId);

  return NextResponse.json({ charge: serializeCharge(charge) }, { status: 201 });
}
