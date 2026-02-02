import 'server-only';

import { NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-session';
import { TimeEntryResume } from '@/modules/time/time.schema';
import { resumeTimeEntry } from '@/modules/time/time.service';

export async function POST(req: Request) {
  const session = await getServerAuthSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const userId = (session.user as any)?.id as string | undefined;
  if (!userId) return new NextResponse('Unauthorized', { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = TimeEntryResume.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await resumeTimeEntry(userId, parsed.data);
  if (result.ok === false) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const { entry } = result.data as { entry: unknown };
  return NextResponse.json({ entry }, { status: 201 });
}
