import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-session';
import { canAccessAdmin } from '@/lib/rbac';
import { hash } from 'bcryptjs';
import { findUserById, updateUser } from '@/repos/users';
import { UserPatch } from '@/lib/zod';

async function requireAdmin(): Promise<NextResponse | null> {
  const session = await getServerAuthSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  const user = session.user as any;
  if (!canAccessAdmin(user)) return new NextResponse('Forbidden', { status: 403 });
  return null;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (guard) return guard;
  const { id } = await params;
  const body = await req.json();
  const parsed = UserPatch.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  const existing = await findUserById(id);
  if (!existing) return NextResponse.json({ error: 'User not found.' }, { status: 404 });
  const { password, kioskPin, kioskEnabled, primaryDepartmentId, ...data } = parsed.data as any;
  const nextKioskEnabled = kioskEnabled ?? existing.kioskEnabled;
  const nextPrimaryDepartmentId =
    primaryDepartmentId !== undefined ? primaryDepartmentId || null : existing.primaryDepartmentId ?? null;
  if (nextKioskEnabled && !nextPrimaryDepartmentId) {
    return NextResponse.json({ error: 'Primary department is required when kiosk access is enabled.' }, { status: 400 });
  }
  if (nextKioskEnabled && !kioskPin && !existing.kioskPinHash) {
    return NextResponse.json({ error: 'Kiosk PIN is required before kiosk access can be enabled.' }, { status: 400 });
  }
  const item = await updateUser(id, {
    ...data,
    ...(kioskEnabled !== undefined ? { kioskEnabled } : {}),
    ...(primaryDepartmentId !== undefined ? { primaryDepartmentId: primaryDepartmentId || null } : {}),
    ...(kioskPin ? { kioskPinHash: await hash(kioskPin, 10) } : {}),
    ...(password ? { passwordHash: await hash(password, 10) } : {}),
  });
  return NextResponse.json({ ok: true, item });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (guard) return guard;
  return NextResponse.json({ error: 'Delete not allowed. Disable user instead.' }, { status: 405 });
}
