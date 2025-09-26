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
  if (!addonId) return NextResponse.json({ error: 'Missing addonId' }, { status: 400 });

  const orderId = params.id;
  if (checked) {
    // create if not exists
    const exists = await prisma.orderChecklist.findFirst({ where: { orderId, addonId } });
    if (!exists) {
      await prisma.orderChecklist.create({ data: { orderId, addonId, toggledById: (session.user as any)?.id ?? null } });
    } else {
      await prisma.orderChecklist.update({
        where: { id: exists.id },
        data: { toggledById: (session.user as any)?.id ?? null },
      });
    }
    return NextResponse.json({ ok: true });
  } else {
    await prisma.orderChecklist.deleteMany({ where: { orderId, addonId } });
    return NextResponse.json({ ok: true });
  }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAuth();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  const items = await prisma.orderChecklist.findMany({ where: { orderId: params.id }, include: { addon: true } });
  return NextResponse.json({ items });
}
