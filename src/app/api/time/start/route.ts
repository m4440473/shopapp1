import 'server-only';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { TimeEntryStart } from '@/modules/time/time.schema';
import { startTimeEntry } from '@/modules/time/time.service';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const userId = (session.user as any)?.id as string | undefined;
  if (!userId) return new NextResponse('Unauthorized', { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = TimeEntryStart.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await startTimeEntry(userId, parsed.data);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ entry: result.data.entry }, { status: 201 });
}
