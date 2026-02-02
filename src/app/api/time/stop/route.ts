import 'server-only';

import { NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-session';
import { stopActiveTimeEntry } from '@/modules/time/time.service';

export async function POST() {
  const session = await getServerAuthSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const userId = (session.user as any)?.id as string | undefined;
  if (!userId) return new NextResponse('Unauthorized', { status: 401 });

  const result = await stopActiveTimeEntry(userId);
  if (result.ok === false) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const { entry } = result.data as { entry: unknown };
  return NextResponse.json({ entry });
}
