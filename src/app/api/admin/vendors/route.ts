import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerAuthSession } from '@/lib/auth-session';
import { canAccessAdmin, canAccessViewer, isMachinist } from '@/lib/rbac';

async function requireAdmin(): Promise<NextResponse | null> {
  const session = await getServerAuthSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  const user = session.user as any;
  if (!canAccessAdmin(user)) return new NextResponse('Forbidden', { status: 403 });
  return null;
}

async function requireTeamAccess(): Promise<NextResponse | null> {
  const session = await getServerAuthSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  const user = session.user as any;
  if (!canAccessAdmin(user) && !isMachinist(user) && !canAccessViewer(user)) {
    return new NextResponse('Forbidden', { status: 403 });
  }
  return null;
}

import { VendorUpsert } from '@/lib/zod';

export async function GET(req: NextRequest) {
  const guard = await requireTeamAccess();
  if (guard) return guard;
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') || undefined;
  const page = Math.max(1, Number(searchParams.get('page') || '1'));
  const take = Math.min(100, Math.max(1, Number(searchParams.get('take') || '20')));
  const skip = (page - 1) * take;

  const where = q
    ? ({
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { url: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q, mode: 'insensitive' } },
          { contact: { contains: q, mode: 'insensitive' } },
          { materials: { contains: q, mode: 'insensitive' } },
          { notes: { contains: q, mode: 'insensitive' } },
        ],
      } as any)
    : undefined;
  const [items, totalCount] = await Promise.all([
    prisma.vendor.findMany({
      where,
      orderBy: { id: 'asc' },
      skip,
      take,
    }),
    prisma.vendor.count({ where }),
  ]);
  return NextResponse.json({ items, totalCount, page, pageSize: take });
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
