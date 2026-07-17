import { NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-session';
import { getRunningWorkerSummary } from '@/modules/time/time.service';

export async function GET() {
  const session = await getServerAuthSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const result = await getRunningWorkerSummary();
  if (result.ok === false) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.data);
}
