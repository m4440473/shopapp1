import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { canAccessAdmin } from '@/lib/rbac';
import { OrderPartCreate } from '@/modules/orders/orders.schema';
import { syncChecklistForOrder } from '@/modules/orders/orders.service';

const InvoiceAction = z.enum(['new', 'update']);
const OrderPartCreateWithOptions = OrderPartCreate.extend({
  invoiceAction: InvoiceAction.optional(),
  copyChargesFromPartId: z.string().trim().min(1).optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions as any);
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  const user = (session as any).user;
  if (!canAccessAdmin(user)) return new NextResponse('Forbidden', { status: 403 });

  const { id } = params;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const json = await req.json().catch(() => null);
  const parsed = OrderPartCreateWithOptions.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    select: { id: true, poNumber: true },
    where: { id },
  });
  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  const payload = parsed.data;
  const { invoiceAction, copyChargesFromPartId, ...partPayload } = payload;
  const userId = (session as any)?.user?.id as string | undefined;

  let sourcePart: { id: string; partNumber: string | null } | null = null;
  if (copyChargesFromPartId) {
    sourcePart = await prisma.orderPart.findFirst({
      where: { id: copyChargesFromPartId, orderId: id },
      select: { id: true, partNumber: true },
    });
    if (!sourcePart) {
      return NextResponse.json({ error: 'Source part not found on this order' }, { status: 404 });
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const part = await tx.orderPart.create({
      data: {
        orderId: id,
        partNumber: partPayload.partNumber,
        quantity: partPayload.quantity,
        materialId: partPayload.materialId ?? null,
        stockSize: partPayload.stockSize ?? null,
        cutLength: partPayload.cutLength ?? null,
        notes: partPayload.notes ?? null,
      },
    });

    let copiedCharges = 0;
    if (sourcePart) {
      const charges = await tx.orderCharge.findMany({
        where: { orderId: id, partId: sourcePart.id },
        select: {
          departmentId: true,
          addonId: true,
          kind: true,
          name: true,
          description: true,
          quantity: true,
          unitPrice: true,
          sortOrder: true,
        },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      });
      if (charges.length) {
        await tx.orderCharge.createMany({
          data: charges.map((charge) => ({
            orderId: id,
            partId: part.id,
            departmentId: charge.departmentId,
            addonId: charge.addonId ?? null,
            kind: charge.kind,
            name: charge.name,
            description: charge.description ?? null,
            quantity: charge.quantity,
            unitPrice: charge.unitPrice,
            sortOrder: charge.sortOrder ?? 0,
          })),
        });
        copiedCharges = charges.length;
      }
    }

    if (userId) {
      const invoiceLine =
        invoiceAction === 'update'
          ? `Invoice action: update existing invoice (invalidates prior PO${order.poNumber ? ` ${order.poNumber}` : ''}). Previous invoice/PO remain in attachments and notes.`
          : invoiceAction === 'new'
            ? 'Invoice action: create a separate invoice for the added part.'
            : null;
      const copyLine = sourcePart
        ? `Add-ons/labor: copied ${copiedCharges} charge${copiedCharges === 1 ? '' : 's'} from ${
            sourcePart.partNumber ?? 'selected part'
          }.`
        : null;
      const noteLines = [
        `Added part ${part.partNumber} (qty ${part.quantity}).`,
        copyLine,
        invoiceLine,
      ].filter(Boolean);

      await tx.note.create({
        data: {
          orderId: id,
          userId,
          content: noteLines.join(' '),
        },
      });
    }

    return { part, copiedCharges };
  });

  if (sourcePart) {
    await syncChecklistForOrder(id);
  }

  return NextResponse.json({ part: result.part, copiedCharges: result.copiedCharges }, { status: 201 });
}
