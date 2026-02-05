import 'server-only';

import { NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-session';
import { TimeEntryStart } from '@/modules/time/time.schema';
import { startTimeEntry } from '@/modules/time/time.service';
import { getOrderPartSummary, logPartEvent } from '@/modules/orders/orders.service';

export async function POST(req: Request) {
  const session = await getServerAuthSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const userId = (session.user as any)?.id as string | undefined;
  if (!userId) return new NextResponse('Unauthorized', { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = TimeEntryStart.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Validate part exists if partId provided
  if (parsed.data.partId) {
    const partCheck = await getOrderPartSummary(parsed.data.orderId, parsed.data.partId);
    if (partCheck.ok === false) {
      return NextResponse.json({ error: partCheck.error }, { status: partCheck.status });
    }
  }

  const result = await startTimeEntry(userId, parsed.data);
  if (result.ok === false) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const { entry } = result.data as { entry: unknown };

  // Log part event if partId is present
  if (parsed.data.partId) {
    await logPartEvent({
      orderId: parsed.data.orderId,
      partId: parsed.data.partId,
      userId,
      type: 'TIMER_STARTED',
      message: 'Timer started.',
      meta: { timeEntryId: (entry as any).id },
    });
  }

  return NextResponse.json({ entry }, { status: 201 });
}
