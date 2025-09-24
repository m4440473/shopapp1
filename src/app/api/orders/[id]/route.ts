import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { canAccessAdmin } from '@/lib/rbac';
import { OrderUpdate } from '@/lib/zod-orders';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions as any);
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const { id } = params;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      customer: true,
      parts: { include: { material: true } },
      checklist: { include: { checklistItem: true } },
  statusHistory: { orderBy: { createdAt: 'asc' } },
  notes: { orderBy: { createdAt: 'asc' }, include: { user: true } },
      attachments: true,
      assignedMachinist: true,
    },
  });

  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ item: order });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions as any);
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  const role = (session as any).user?.role as string | undefined;
  if (!canAccessAdmin(role)) return new NextResponse('Forbidden', { status: 403 });

  const { id } = params;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const json = await req.json().catch(() => null);
  const parsed = OrderUpdate.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const payload = parsed.data;
  const data: Record<string, unknown> = {};

  if (payload.receivedDate !== undefined) {
    const date = new Date(payload.receivedDate);
    if (Number.isNaN(date.getTime())) {
      return NextResponse.json({ error: 'Invalid received date' }, { status: 400 });
    }
    data.receivedDate = date;
  }

  if (payload.dueDate !== undefined) {
    const date = new Date(payload.dueDate);
    if (Number.isNaN(date.getTime())) {
      return NextResponse.json({ error: 'Invalid due date' }, { status: 400 });
    }
    data.dueDate = date;
  }

  if (payload.priority !== undefined) data.priority = payload.priority;
  if (payload.vendorId !== undefined) data.vendorId = payload.vendorId || null;
  if (payload.poNumber !== undefined) data.poNumber = payload.poNumber || null;
  if (payload.materialNeeded !== undefined) data.materialNeeded = payload.materialNeeded;
  if (payload.materialOrdered !== undefined) data.materialOrdered = payload.materialOrdered;
  if (payload.modelIncluded !== undefined) data.modelIncluded = payload.modelIncluded;
  if (payload.assignedMachinistId !== undefined)
    data.assignedMachinistId = payload.assignedMachinistId || null;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  await prisma.order.update({
    where: { id },
    data,
  });

  return NextResponse.json({ ok: true });
}
