import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { canAccessAdmin } from '@/lib/rbac';
import { BUSINESS_PREFIX_BY_CODE, type BusinessCode } from '@/lib/businesses';
import { generateNextOrderNumber } from '@/lib/orders.server';
import { OrderQuery, OrderCreate } from '@/lib/zod-orders';
import { hasCustomFieldValue, serializeCustomFieldValue } from '@/lib/custom-field-values';
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
      business: true,
      dueDate: true,
      receivedDate: true,
      priority: true,
      status: true,
      customer: { select: { id: true, name: true } },
      assignedMachinist: { select: { id: true, name: true, email: true } },
      materialNeeded: true,
      materialOrdered: true,
      parts: { select: { quantity: true } },
      checklist: {
        where: { isActive: true },
        select: {
          completed: true,
          addon: { select: { name: true } },
        },
      },
      statusHistory: {
        select: { createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  const nextCursor = items.length === take ? items[items.length - 1].id : null;
  return NextResponse.json({ items, nextCursor });
}

/** POST /api/orders — create order with parts, checklist, initial status */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  const user = session.user as any;
  if (!canAccessAdmin(user)) return new NextResponse('Forbidden', { status: 403 });

  const json = await req.json().catch(() => null);
  const parsed = OrderCreate.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data;

  const prefix = BUSINESS_PREFIX_BY_CODE[body.business as keyof typeof BUSINESS_PREFIX_BY_CODE] ?? body.business;
  const providedOrderNumber = body.orderNumber?.trim();
  let orderNumber: string;
  if (providedOrderNumber && providedOrderNumber.length > 0) {
    if (!providedOrderNumber.startsWith(`${prefix}-`)) {
      return NextResponse.json(
        { error: `Order numbers for ${prefix} must start with ${prefix}-` },
        { status: 400 },
      );
    }
    orderNumber = providedOrderNumber;
  } else {
    orderNumber = await generateNextOrderNumber(body.business as BusinessCode);
  }
  const userId = (session.user as any)?.id as string | undefined;

  const customFieldValues = body.customFieldValues ?? [];
  const validCustomFieldValues = customFieldValues.length
    ? await prisma.customField.findMany({
        where: {
          id: { in: customFieldValues.map((value) => value.fieldId) },
          entityType: 'ORDER',
          isActive: true,
          OR: [{ businessCode: body.business }, { businessCode: null }],
        },
        select: { id: true },
      })
    : [];
  const allowedFieldIds = new Set(validCustomFieldValues.map((field) => field.id));
  const normalizedCustomFieldValues = customFieldValues
    .filter((value) => allowedFieldIds.has(value.fieldId) && hasCustomFieldValue(value.value))
    .map((value) => ({
      fieldId: value.fieldId,
      value: serializeCustomFieldValue(value.value),
    }))
    .filter((value) => value.value !== null);

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        orderNumber,
        business: body.business,
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
            stockSize: p.stockSize ?? null,
            cutLength: p.cutLength ?? null,
            notes: p.notes ?? null,
          })),
        },
        checklist: body.addonIds.length
          ? { create: body.addonIds.map(id => ({ addonId: id })) }
          : undefined,
        attachments: body.attachments.length
          ? {
              create: body.attachments.map(a => ({
                url: a.url ?? null,
                storagePath: a.storagePath ?? null,
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

    if (normalizedCustomFieldValues.length) {
      await tx.customFieldValue.createMany({
        data: normalizedCustomFieldValues.map((value) => ({
          fieldId: value.fieldId,
          entityId: created.id,
          value: value.value,
        })),
      });
    }

    return created;
  });

  return NextResponse.json({ id: order.id }, { status: 201 });
}
