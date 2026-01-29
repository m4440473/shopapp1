import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '@/lib/auth';
import { canAccessAdmin } from '@/lib/rbac';
import { OrderPartCreate } from '@/modules/orders/orders.schema';
import { addOrderPart } from '@/modules/orders/orders.service';

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

  const payload = parsed.data;
  const { invoiceAction, copyChargesFromPartId, ...partPayload } = payload;
  const userId = (session as any)?.user?.id as string | undefined;
  const result = await addOrderPart({
    orderId: id,
    payload: partPayload,
    invoiceAction,
    copyChargesFromPartId,
    userId,
  });

  if (result.ok === false) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const { part, copiedCharges } = result.data as { part: unknown; copiedCharges?: unknown };
  return NextResponse.json({ part, copiedCharges }, { status: 201 });
}
