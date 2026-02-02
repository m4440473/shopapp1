import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-session';
import { canAccessAdmin } from '@/lib/rbac';
import { hash } from 'bcryptjs';
import { updateUser } from '@/repos/users';
import { UserPatch } from '@/lib/zod';

async function requireAdmin(): Promise<NextResponse | null> {
  const session = await getServerAuthSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  const user = session.user as any;
  if (!canAccessAdmin(user)) return new NextResponse('Forbidden', { status: 403 });
  return null;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (guard) return guard;
  const body = await req.json();
  const parsed = UserPatch.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  const { password, ...data } = parsed.data as any;
  const item = await updateUser(params.id, {
    ...data,
    ...(password ? { passwordHash: await hash(password, 10) } : {}),
  });
  return NextResponse.json({ ok: true, item });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (guard) return guard;
  return NextResponse.json({ error: 'Delete not allowed. Disable user instead.' }, { status: 405 });
}
