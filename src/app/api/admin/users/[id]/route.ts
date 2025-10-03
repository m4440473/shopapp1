import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { canAccessAdmin } from '@/lib/rbac';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function requireAdmin(): Promise<NextResponse | null> {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  const user = session.user as any;
  if (!canAccessAdmin(user)) return new NextResponse('Forbidden', { status: 403 });
  return null;
}

import { UserPatch } from '@/lib/zod';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin(); if (guard) return guard;
  const body = await req.json();
  const parsed = UserPatch.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  const { password, ...data } = parsed.data as any;
  const item = await prisma.user.update({
    where: { id: params.id },
    data: {
      ...data,
      ...(password ? { passwordHash: await hash(password, 10) } : {}),
    },
  });
  const { passwordHash, ...rest } = item as any;
  return NextResponse.json({ ok: true, item: rest });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin(); if (guard) return guard;
  return NextResponse.json({ error: 'Delete not allowed. Disable user instead.' }, { status: 405 });
}
