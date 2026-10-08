import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-session';
import { canAccessAdmin } from '@/lib/rbac';
import { getCreationSubmissionStatus, SubmissionError } from '@/modules/submissions/submissions.service';
import type { CreationSubmissionScope } from '@/modules/submissions/submissions.types';

export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  const session = await getServerAuthSession();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canAccessAdmin(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const result = await getCreationSubmissionStatus(user.id, request.nextUrl.searchParams.get('scope') as CreationSubmissionScope, request.nextUrl.searchParams.get('key') ?? '');
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof SubmissionError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    return NextResponse.json({ error: 'Unable to confirm the submission. Retry this check.' }, { status: 503 });
  }
}
