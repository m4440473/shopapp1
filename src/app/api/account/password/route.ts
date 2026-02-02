import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-session';
import { compare, hash } from 'bcryptjs';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';

const PasswordUpdate = z.object({
  currentPassword: z.string().min(1).optional(),
  newPassword: z.string().min(8).max(100),
});

export async function GET() {
  const session = await getServerAuthSession();
  if (!session?.user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  const userId = (session.user as any).id as string | undefined;
  const email = session.user.email;
  if (!userId && !email) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const user = await prisma.user.findFirst({
    where: userId ? { id: userId } : { email: email ?? undefined },
    select: { id: true, passwordHash: true },
  });

  if (!user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  return NextResponse.json({ hasPassword: Boolean(user.passwordHash) });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerAuthSession();
  if (!session?.user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  const userId = (session.user as any).id as string | undefined;
  const email = session.user.email;
  if (!userId && !email) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const user = await prisma.user.findFirst({
    where: userId ? { id: userId } : { email: email ?? undefined },
    select: { id: true, passwordHash: true },
  });

  if (!user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const body = await req.json();
  const parsed = PasswordUpdate.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const { currentPassword, newPassword } = parsed.data;

  if (user.passwordHash) {
    if (!currentPassword) {
      return NextResponse.json({ error: 'Current password is required.' }, { status: 400 });
    }
    const ok = await compare(currentPassword, user.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 400 });
    }
  }

  const passwordHash = await hash(newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  return NextResponse.json({ ok: true });
}
