import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { canAccessMachinist } from '@/lib/rbac';

async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  return session;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAuth();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  const role = (session.user as any)?.role as string | undefined;
  if (!canAccessMachinist(role)) return new NextResponse('Forbidden', { status: 403 });

  const json = await req.json().catch(() => null);
  const { addonId, checked } = json ?? {};
  const employeeName = typeof json?.employeeName === 'string' ? json.employeeName.trim() : '';
  if (!addonId) return NextResponse.json({ error: 'Missing addonId' }, { status: 400 });
  if (typeof checked !== 'boolean') return NextResponse.json({ error: 'Missing checked state' }, { status: 400 });
  if (!employeeName) return NextResponse.json({ error: 'Employee name is required' }, { status: 400 });

  const orderId = params.id;
  const orderExists = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true } });
  if (!orderExists) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  const addonExists = await prisma.addon.findUnique({ where: { id: addonId }, select: { id: true, name: true } });
  if (!addonExists) return NextResponse.json({ error: 'Addon not found' }, { status: 404 });

  const existingChecklist = await prisma.orderChecklist.findUnique({
    where: { orderId_addonId: { orderId, addonId } },
  });
  const previousState = existingChecklist?.completed ?? false;

  const togglerId = (session.user as any)?.id as string | undefined;
  const toggler = togglerId
    ? await prisma.user.findUnique({ where: { id: togglerId }, select: { id: true } })
    : null;
  const toggledById = toggler ? toggler.id : null;

  await prisma.orderChecklist.upsert({
    where: { orderId_addonId: { orderId, addonId } },
    create: {
      orderId,
      addonId,
      completed: checked,
      toggledById,
    },
    update: { completed: checked, toggledById },
  });

  await prisma.statusHistory.create({
    data: {
      orderId,
      from: `${addonExists.name} ${previousState ? 'checked' : 'unchecked'}`,
      to: `${addonExists.name} ${checked ? 'checked' : 'unchecked'}`,
      userId: toggledById,
      reason: `Checklist "${addonExists.name}" ${checked ? 'checked' : 'unchecked'} by ${employeeName}`,
    },
  });

  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAuth();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  const items = await prisma.orderChecklist.findMany({ where: { orderId: params.id }, include: { addon: true } });
  const sanitized = items.map(({ addon, ...item }) => ({
    ...item,
    addon: addon ? (({ rateCents: _, ...rest }) => rest)(addon) : addon,
  }));
  return NextResponse.json({ items: sanitized });
}
