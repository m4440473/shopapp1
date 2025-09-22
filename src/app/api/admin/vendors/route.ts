import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { canAccessAdmin } from '@/lib/rbac';

const prisma = new PrismaClient();

async function requireAdmin(): Promise<NextResponse | null> {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  const role = (session.user as any)?.role || 'VIEWER';
  if (!canAccessAdmin(role)) return new NextResponse('Forbidden', { status: 403 });
  return null;
}

import { VendorUpsert } from '@/lib/zod';

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(); if (guard) return guard;
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') || undefined;
  const cursor = searchParams.get('cursor');
  const take = Number(searchParams.get('take') || '20');

  const where = q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { url: { contains: q, mode: 'insensitive' } }, { phone: { contains: q, mode: 'insensitive' } }, { notes: { contains: q, mode: 'insensitive' } }] } as any : undefined;
  const items = await prisma.vendor.findMany({
    where,
    orderBy: { id: 'asc' },
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const nextCursor = items.length > take ? (items[take] as any).id : null;
  if (nextCursor) items.pop();
  return NextResponse.json({ items, nextCursor });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(); if (guard) return guard;
  const body = await req.json();
  const parsed = VendorUpsert.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  const data = parsed.data as any;
  const item = await prisma.vendor.create({ data });
  return NextResponse.json({ ok: true, item });
}
