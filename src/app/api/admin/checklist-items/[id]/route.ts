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

import { ChecklistItemUpsert } from '@/lib/zod';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin(); if (guard) return guard;
  const body = await req.json();
  const parsed = ChecklistItemUpsert.partial().safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  const data = parsed.data as any;
  const item = await prisma.checklistItem.update({ where: { id: params.id }, data });
  return NextResponse.json({ ok: true, item });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin(); if (guard) return guard;
  const inUse = await prisma.orderChecklist.count({ where: { checklistItemId: params.id } });
  if (inUse > 0) return NextResponse.json({ error: 'Item in use; disable instead.' }, { status: 409 });
  await prisma.checklistItem.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
