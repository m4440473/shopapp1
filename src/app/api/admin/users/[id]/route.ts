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

import { UserUpsert } from '@/lib/zod';
import { z } from 'zod';
const UserUpdate = z.object({ name: z.string().max(100).optional(), role: z.enum(['ADMIN','MACHINIST','VIEWER']).optional(), active: z.boolean().optional() });


export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin(); if (guard) return guard;
  const body = await req.json();
  const parsed = UserUpdate.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  const data = parsed.data as any;
  const item = await prisma.user.update({ where: { id: params.id }, data });
  return NextResponse.json({ ok: true, item });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin(); if (guard) return guard;
  return NextResponse.json({ error: 'Delete not allowed. Disable user instead.' }, { status: 405 });
}
