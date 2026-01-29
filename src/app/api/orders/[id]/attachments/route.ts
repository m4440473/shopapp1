import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { canAccessAdmin } from '@/lib/rbac';
import { OrderAttachmentCreate } from '@/modules/orders/orders.schema';
import { createAttachmentForOrder } from '@/modules/orders/orders.service';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions as any);
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  const user = (session as any).user;
  if (!canAccessAdmin(user)) return new NextResponse('Forbidden', { status: 403 });

  const { id } = params;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const json = await req.json().catch(() => null);
  const parsed = OrderAttachmentCreate.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const payload = parsed.data;
  const userId = (session as any).user?.id as string | undefined;

  const result = await createAttachmentForOrder({ orderId: id, payload, userId });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ attachment: result.data.attachment }, { status: 201 });
}
