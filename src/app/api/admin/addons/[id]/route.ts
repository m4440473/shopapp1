import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-session';

import { canAccessAdmin } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { AddonPatch } from '@/lib/zod';

async function requireAdmin() {
  const session = await getServerAuthSession();
  if (!session) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  const user = session.user as any;
  if (!canAccessAdmin(user)) {
    return new NextResponse('Forbidden', { status: 403 });
  }
  return { session };
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const body = await req.json();
  const parsed = AddonPatch.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const data = parsed.data;
  const item = await prisma.addon.update({
    where: { id: params.id },
    data,
    include: { department: true },
  });
  return NextResponse.json({ ok: true, item });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  await prisma.addon.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const item = await prisma.addon.findUnique({
    where: { id: params.id },
    include: { department: true },
  });
  if (!item) {
    return new NextResponse('Not found', { status: 404 });
  }
  return NextResponse.json({ item });
}
