import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/src/lib/prisma';
import { authOptions } from '@/src/lib/auth';
import { canAccessAdmin } from '@/src/lib/rbac';
import { OrderQuery, OrderCreate } from '@/src/lib/zod-orders';
import { Role, Status } from '@prisma/client';

/** GET /api/orders — list with filters & cursor pagination */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const url = new URL(req.url);
  const qs = Object.fromEntries(url.searchParams.entries());
  const parsed = OrderQuery.safeParse(qs);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { q, status, priority, assignedMachinistId, customerId, overdue, awaitingMaterial, take, cursor } = parsed.data;

  const where: any = {};
  if (q) {
    where.OR = [
      { orderNumber: { contains: q, mode: 'insensitive' } },
      { customer: { name: { contains: q, mode: 'insensitive' } } },
    ];
  }
  if (status) where.status = status;
  if (priority) where.priority = priority;
  if (assignedMachinistId) where.assignedMachinistId = assignedMachinistId;
  if (customerId) where.customerId = customerId;
  if (overdue) where.dueDate = { lt: new Date() };
  if (awaitingMaterial) where.AND = [...(where.AND ?? []), { materialNeeded: true, materialOrdered: false }];

  const items = await prisma.order.findMany({
    where,
    orderBy: [{ dueDate: 'asc' }, { priority: 'desc' }],
    take,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    select: {
      id: true,
      orderNumber: true,
      dueDate: true,
      receivedDate: true,
      priority: true,
      status: true,
      customer: { select: { id: true, name: true } },
      assignedMachinist: { select: { id: true, name: true } },
      materialNeeded: true,
      materialOrdered: true,
    },
  });

  const nextCursor = items.length === take ? items[items.length - 1].id : null;
  return NextResponse.json({ items, nextCursor });
}

/** POST /api/orders — create order with parts, checklist, initial status */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  const role = (session.user as any)?.role as Role | undefined;
  if (!canAccessAdmin(role)) return new NextResponse('Forbidden', { status: 403 });

  const json = await req.json().catch(() => null);
  const parsed = OrderCreate.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data;

  const order = await prisma.order.create({
    data: {
      orderNumber: body.orderNumber,
      customerId: body.customerId,
      modelIncluded: body.modelIncluded,
      receivedDate: new Date(body.receivedDate),
      dueDate: new Date(body.dueDate),
      priority: body.priority,
      status: 'RECEIVED',
      materialNeeded: body.materialNeeded,
      materialOrdered: body.materialOrdered,
      vendorId: body.vendorId ?? null,
      poNumber: body.poNumber ?? null,
      assignedMachinistId: body.assignedMachinistId ?? null,
      parts: {
        create: body.parts.map(p => ({
          partNumber: p.partNumber,
          quantity: p.quantity,
          materialId: p.materialId ?? null,
          notes: p.notes ?? null,
        })),
      },
      checklist: body.checklistItemIds.length
        ? { create: body.checklistItemIds.map(id => ({ checklistItemId: id })) }
        : undefined,
      attachments: body.attachments.length
        ? {
            create: body.attachments.map(a => ({
              url: a.url,
              label: a.label ?? null,
              mimeType: a.mimeType ?? null,
              uploadedById: (session.user as any)?.id ?? null,
            })),
          }
        : undefined,
      statusHistory: {
        create: {
          from: 'RECEIVED' as Status,
          to: 'RECEIVED' as Status,
          userId: (session.user as any)?.id,
          reason: 'Order created',
        },
      },
    },
    select: { id: true },
  });

  return NextResponse.json({ id: order.id }, { status: 201 });
}
