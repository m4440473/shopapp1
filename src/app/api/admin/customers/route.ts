import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { canAccessAdmin, canAccessViewer, isMachinist } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const user = session.user as any;
  const canView = canAccessAdmin(user) || isMachinist(user) || canAccessViewer(user);
  if (!canView) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const take = parseInt(searchParams.get('take') || '100', 10);
  const customers = await prisma.customer.findMany({ take });
  return NextResponse.json({ items: customers });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !canAccessAdmin(session.user as any)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await req.json();
  const name = body?.name?.trim();
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  const customer = await prisma.customer.create({ data: { name, contact: body.contact || null, phone: body.phone || null, email: body.email || null, address: body.address || null } });
  return NextResponse.json({ ok: true, item: customer });
}
