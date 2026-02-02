import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-session';
import { canAccessAdmin, canAccessViewer, isMachinist } from '@/lib/rbac';
import { hash } from 'bcryptjs';
import { createUser, listUsers } from '@/repos/users';
import { UserUpsert } from '@/lib/zod';

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

export async function GET(req: NextRequest) {
  const guard = await requireTeamAccess();
  if (guard) return guard;
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') || undefined;
  const cursor = searchParams.get('cursor');
  const take = Number(searchParams.get('take') || '20');
  const roleFilter = searchParams.get('role') || undefined;

  const result = await listUsers({ q, role: roleFilter, take, cursor });
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard) return guard;
  const body = await req.json();
  const parsed = UserUpsert.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  const { password, ...data } = parsed.data as any;
  const item = await createUser({
    ...data,
    ...(password ? { passwordHash: await hash(password, 10) } : {}),
  });
  return NextResponse.json({ ok: true, item });
}
