import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { canAccessAdmin } from '@/lib/rbac';
import { OrderQuery, OrderCreate } from '@/lib/zod-orders';
// Status enum not used from prisma; statuses are strings in this schema

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
  const role = (session.user as any)?.role as string | undefined;
  if (!canAccessAdmin(role)) return new NextResponse('Forbidden', { status: 403 });

  const json = await req.json().catch(() => null);
  const parsed = OrderCreate.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data;

  async function generateNextOrderNumber() {
    const recent = await prisma.order.findMany({
      select: { orderNumber: true },
      orderBy: { orderNumber: 'desc' },
      take: 200,
    });
    let maxValue = 1000;
    for (const candidate of recent) {
      const numeric = parseInt(candidate.orderNumber.replace(/[^0-9]/g, ''), 10);
      if (!Number.isNaN(numeric) && Number.isFinite(numeric)) {
        maxValue = Math.max(maxValue, numeric);
      }
    }
    return String(maxValue + 1);
  }

  const orderNumber = body.orderNumber?.trim() || (await generateNextOrderNumber());
  const userId = (session.user as any)?.id as string | undefined;

  const order = await prisma.order.create({
    data: {
      orderNumber,
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
      notes:
        body.notes && userId
          ? {
              create: {
                content: body.notes,
                userId,
              },
            }
          : undefined,
      statusHistory: {
        create: {
          from: 'RECEIVED',
          to: 'RECEIVED',
          userId,
          reason: 'Order created',
        },
      },
    },
    select: { id: true },
  });

  return NextResponse.json({ id: order.id }, { status: 201 });
}
