import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { canAccessAdmin, canAccessViewer, isMachinist } from '@/lib/rbac';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function requireAdmin(): Promise<NextResponse | null> {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  const role = (session.user as any)?.role || 'VIEWER';
  if (!canAccessAdmin(role)) return new NextResponse('Forbidden', { status: 403 });
  return null;
}

async function requireTeamAccess(): Promise<NextResponse | null> {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  const role = (session.user as any)?.role || 'VIEWER';
  if (!canAccessAdmin(role) && !isMachinist(role) && !canAccessViewer(role)) {
    return new NextResponse('Forbidden', { status: 403 });
  }
  return null;
}

import { UserUpsert } from '@/lib/zod';

export async function GET(req: NextRequest) {
  const guard = await requireTeamAccess();
  if (guard) return guard;
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') || undefined;
  const cursor = searchParams.get('cursor');
  const take = Number(searchParams.get('take') || '20');
  const roleFilter = searchParams.get('role') || undefined;

  const where: any = {};
  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
    ];
  }
  if (roleFilter) {
    where.role = roleFilter;
  }
  const items = await prisma.user.findMany({
    where: Object.keys(where).length > 0 ? where : undefined,
    orderBy: { id: 'asc' },
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const nextCursor = items.length > take ? (items[take] as any).id : null;
  if (nextCursor) items.pop();
  const sanitized = items.map(({ passwordHash, ...rest }) => rest);
  return NextResponse.json({ items: sanitized, nextCursor });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(); if (guard) return guard;
  const body = await req.json();
  const parsed = UserUpsert.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  const { password, ...data } = parsed.data as any;
  const item = await prisma.user.create({
    data: {
      ...data,
      ...(password ? { passwordHash: await hash(password, 10) } : {}),
    },
  });
  const { passwordHash, ...rest } = item as any;
  return NextResponse.json({ ok: true, item: rest });
}
