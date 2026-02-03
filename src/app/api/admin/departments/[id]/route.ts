import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-session';

import { canAccessAdmin } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { DepartmentPatch } from '@/lib/zod';
import { slugifyName } from '@/lib/businesses';

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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;
  const body = await req.json();
  const parsed = DepartmentPatch.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const data = parsed.data;
  const updateData = {
    ...data,
    ...(data.name ? { slug: slugifyName(data.name, 'department') } : {}),
  };

  const item = await prisma.department.update({ where: { id }, data: updateData });
  return NextResponse.json({ ok: true, item });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;
  const addonCount = await prisma.addon.count({ where: { departmentId: id } });
  if (addonCount > 0) {
    return NextResponse.json(
      { error: 'Department is assigned to existing add-ons. Disable it instead.' },
      { status: 409 }
    );
  }

  await prisma.department.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;
  const item = await prisma.department.findUnique({ where: { id } });
  if (!item) {
    return new NextResponse('Not found', { status: 404 });
  }
  return NextResponse.json({ item });
}
