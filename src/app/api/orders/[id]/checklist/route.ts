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
  const { checklistItemId, checked } = json ?? {};
  if (!checklistItemId) return NextResponse.json({ error: 'Missing checklistItemId' }, { status: 400 });

  const orderId = params.id;
  if (checked) {
    // create if not exists
    const exists = await prisma.orderChecklist.findFirst({ where: { orderId, checklistItemId } });
    if (!exists) {
      await prisma.orderChecklist.create({ data: { orderId, checklistItemId, toggledById: (session.user as any)?.id } });
    }
    return NextResponse.json({ ok: true });
  } else {
    await prisma.orderChecklist.deleteMany({ where: { orderId, checklistItemId } });
    return NextResponse.json({ ok: true });
  }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAuth();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  const items = await prisma.orderChecklist.findMany({ where: { orderId: params.id }, include: { checklistItem: true } });
  return NextResponse.json({ items });
}
