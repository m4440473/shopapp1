import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-session';
import { canAccessAdmin } from '@/lib/rbac';
import { RepeatOrderTemplateCreateOrder } from '@/modules/repeat-orders/repeat-orders.schema';
import { createOrderFromRepeatOrderTemplate } from '@/modules/repeat-orders/repeat-orders.service';
import { submissionIdentity, SubmissionError } from '@/modules/submissions/submissions.service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerAuthSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  if (!canAccessAdmin(session.user as any)) return new NextResponse('Forbidden', { status: 403 });

  const json = await req.json().catch(() => null);
  const parsed = RepeatOrderTemplateCreateOrder.safeParse(json ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { id } = await params;
  try {
    const submission = submissionIdentity({ actorId: (session.user as { id?: string })?.id, scope: `order:repeat:${id}`, clientKey: req.headers.get('Idempotency-Key'), payload: parsed.data });
    const result = await createOrderFromRepeatOrderTemplate(
      id,
      parsed.data,
      (session.user as any)?.id as string | undefined,
      submission,
    );
    if (result.ok === false) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(result.data, { status: 201 });
  } catch (error) {
    if (error instanceof SubmissionError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    console.error('Repeat order submission failed', error);
    return NextResponse.json({ error: 'Unable to confirm order creation. Retry the saved submission.' }, { status: 503 });
  }
}
