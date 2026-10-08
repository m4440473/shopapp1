import 'server-only';
import type { Prisma } from '.prisma/client';
import { prisma } from '@/lib/prisma';
import type { Search } from './assistant.schema';

const contains = (value: string) => ({ contains: value });
const dates = (s: Search) => ({
  ...(s.fromYear ? { gte: new Date(`${s.fromYear}-01-01T00:00:00Z`) } : {}),
  ...(s.toYear ? { lt: new Date(`${s.toYear + 1}-01-01T00:00:00Z`) } : {}),
});
const closed = ['COMPLETE', 'CLOSED', 'CANCELLED', 'CANCELED', 'SHIPPED'];

export function orderPartWhere(s: Search): Prisma.OrderPartWhereInput {
  const active = s.mode === 'procurement' || s.activeOnly || s.overdue;
  const order: Prisma.OrderWhereInput = {
    ...(s.customer && { customer: { name: contains(s.customer) } }),
    ...(s.orderNumber && { orderNumber: contains(s.orderNumber) }),
    ...((s.fromYear || s.toYear) && { receivedDate: dates(s) }),
    ...(active && { status: { notIn: closed } }),
    ...(s.overdue && { dueDate: { lt: new Date() } }),
  };
  return {
    order,
    ...(active && { status: { notIn: closed } }),
    ...(s.partNumber && { partNumber: contains(s.partNumber) }),
    ...((s.materialStatus || s.mode === 'procurement') && { materialStatus: s.materialStatus || 'NEED_TO_ORDER' }),
    AND: [
      ...(s.material ? [{ OR: [{ drawingMaterialText: contains(s.material) }, { material: { name: contains(s.material) } }, { notes: contains(s.material) }] }] : []),
      ...(s.finish ? [{ OR: [{ finish: contains(s.finish) }, { drawingFinishText: contains(s.finish) }, { notes: contains(s.finish) }, { workInstructions: contains(s.finish) }] }] : []),
      ...s.query.split(/\s+/).filter(Boolean).map(term => ({ OR: [
        { partNumber: contains(term) }, { partName: contains(term) }, { notes: contains(term) },
        { drawingMaterialText: contains(term) }, { drawingFinishText: contains(term) }, { finish: contains(term) },
        { materialNotes: contains(term) }, { workInstructions: contains(term) }, { material: { name: contains(term) } },
        { order: { orderNumber: contains(term) } }, { order: { customer: { name: contains(term) } } },
        { order: { notes: { some: { content: contains(term) } } } },
      ] })),
    ],
  };
}

export async function searchOrderParts(s: Search) {
  const where = orderPartWhere(s);
  return prisma.$transaction(async tx => ({
    total: await tx.orderPart.count({ where }),
    orderCount: (await tx.orderPart.groupBy({ by: ['orderId'], where })).length,
    unreviewed: s.mode === 'procurement' ? await tx.orderPart.count({ where: { ...where, materialStatus: 'UNREVIEWED' } }) : 0,
    rows: await tx.orderPart.findMany({ where, skip: s.offset, take: 25,
      orderBy: [{ order: { dueDate: 'asc' } }, { id: 'asc' }],
      select: { id: true, partNumber: true, partName: true, quantity: true, status: true,
        drawingMaterialText: true, drawingFinishText: true, finish: true, materialStatus: true,
        notes: true, materialNotes: true, workInstructions: true, stockSize: true,
        material: { select: { name: true } }, procurementVendor: { select: { name: true } },
        order: { select: { id: true, orderNumber: true, status: true, dueDate: true, receivedDate: true, customer: { select: { name: true } } } },
      },
    }),
  }));
}

export function quoteWhere(s: Search): Prisma.QuoteWhereInput {
  return {
    ...(s.conversion !== 'any' && { convertedOrder: { is: null } }),
    ...(s.conversion === 'never_ordered' && { customer: { is: { orders: { none: {} } } } }),
    ...((s.fromYear || s.toYear) && { createdAt: dates(s) }),
    AND: [
      ...(s.customer ? [{ OR: [{ companyName: contains(s.customer) }, { customer: { name: contains(s.customer) } }] }] : []),
      ...(s.query ? [{ OR: [{ quoteNumber: contains(s.query) }, { notes: contains(s.query) }, { companyName: contains(s.query) }] }] : []),
      ...(s.partNumber ? [{ parts: { some: { partNumber: contains(s.partNumber) } } }] : []),
      ...(s.material ? [{ parts: { some: { OR: [{ drawingMaterialText: contains(s.material) }, { material: { name: contains(s.material) } }] } } }] : []),
    ],
  };
}

export async function searchQuotes(s: Search) {
  const where = quoteWhere(s);
  return prisma.$transaction(async tx => ({
    total: await tx.quote.count({ where }),
    customerCount: (await tx.quote.groupBy({ by: ['customerId'], where: { AND: [where, { customerId: { not: null } }] } })).length,
    unlinkedQuotes: await tx.quote.count({ where: { AND: [where, { customerId: null }] } }),
    rows: await tx.quote.findMany({ where, skip: s.offset, take: 25, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      select: { id: true, quoteNumber: true, companyName: true, status: true, totalCents: true, createdAt: true,
        customer: { select: { id: true, name: true } }, convertedOrder: { select: { id: true, orderNumber: true } } },
    }),
  }));
}

export async function searchCustomers(s: Search) {
  const where: Prisma.CustomerWhereInput = {
    ...((s.customer || s.query) && { name: contains(s.customer || s.query) }),
    ...(s.conversion !== 'any' && { quotes: { some: { convertedOrder: { is: null } } } }),
    ...(s.conversion === 'never_ordered' && { orders: { none: {} } }),
  };
  return prisma.$transaction(async tx => ({
    total: await tx.customer.count({ where }),
    rows: await tx.customer.findMany({ where, skip: s.offset, take: 25, orderBy: { name: 'asc' },
      select: { id: true, name: true, _count: { select: { orders: true, quotes: true } } },
    }),
  }));
}

// Only registered business attachments are exposed. No configuration/source tree traversal.
export async function listAssistantFiles() {
  const file = { id: true, label: true, storagePath: true, mimeType: true } as const;
  const order = { select: { id: true, orderNumber: true, customer: { select: { name: true } } } } as const;
  const quote = { select: { id: true, quoteNumber: true, companyName: true } } as const;
  const [orders, parts, quotes, quoteParts] = await Promise.all([
    prisma.attachment.findMany({ select: { ...file, order } }),
    prisma.partAttachment.findMany({ select: { ...file, order, part: { select: { partNumber: true, drawingMaterialText: true, drawingFinishText: true } } } }),
    prisma.quoteAttachment.findMany({ select: { ...file, quote } }),
    prisma.quotePartAttachment.findMany({ select: { ...file, quote, quotePart: { select: { partNumber: true, drawingMaterialText: true, drawingFinishText: true } } } }),
  ]);
  return [
    ...orders.map(f => ({ ...f, reference: f.order.orderNumber, customer: f.order.customer.name, parentHref: `/orders/${f.order.id}`, partNumber: '' })),
    ...parts.map(f => ({ ...f, reference: f.order.orderNumber, customer: f.order.customer.name, parentHref: `/orders/${f.order.id}`, partNumber: f.part.partNumber })),
    ...quotes.map(f => ({ ...f, reference: f.quote.quoteNumber, customer: f.quote.companyName, parentHref: `/admin/quotes/${f.quote.id}`, partNumber: '' })),
    ...quoteParts.map(f => ({ ...f, reference: f.quote.quoteNumber, customer: f.quote.companyName, parentHref: `/admin/quotes/${f.quote.id}`, partNumber: f.quotePart.partNumber || '' })),
  ].map(f => ({ id: f.id, label: f.label || f.storagePath?.split('/').pop() || 'Attachment', storagePath: f.storagePath,
    mimeType: f.mimeType, reference: f.reference, customer: f.customer, parentHref: f.parentHref, partNumber: f.partNumber }));
}
