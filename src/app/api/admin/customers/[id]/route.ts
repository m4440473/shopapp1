import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-session';

import { prisma } from '@/lib/prisma';
import { canAccessAdmin } from '@/lib/rbac';
import { CustomerUpdate } from '@/lib/zod-customers';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerAuthSession();
  if (!session || !canAccessAdmin(session.user as any)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = params;
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  const json = await req.json().catch(() => null);
  const parsed = CustomerUpdate.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const payload = parsed.data;
  const data: Record<string, unknown> = {};
  if (payload.name !== undefined) data.name = payload.name;
  if (payload.contact !== undefined) data.contact = payload.contact || null;
  if (payload.phone !== undefined) data.phone = payload.phone || null;
  if (payload.email !== undefined) data.email = payload.email || null;
  if (payload.address !== undefined) data.address = payload.address || null;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const customer = await prisma.customer.update({
    where: { id },
    data,
  });

  return NextResponse.json({ ok: true, item: customer });
}
