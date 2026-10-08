import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-session';
import { z } from 'zod';

import { parseQuoteMetadata } from '@/lib/quote-metadata';
import { canAccessAdmin } from '@/lib/rbac';
import { ListQuery } from '@/lib/zod';
import { QuoteCreate } from '@/modules/quotes/quotes.schema';
import { sanitizePricingForNonAdmin } from '@/lib/quote-visibility';
import { createQuoteFromPayload } from '@/modules/quotes/quotes.create.service';
import { listQuotes } from '@/modules/quotes/quotes.service';
import { submissionIdentity, SubmissionError } from '@/modules/submissions/submissions.service';

async function getSessionWithRole() {
  const session = await getServerAuthSession();
  if (!session) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  const user = session.user as any;
  const role = user?.role ?? null;
  return { session, role, user };
}

async function requireAdmin() {
  const result = await getSessionWithRole();
  if (result instanceof NextResponse) return result;
  const { role, session, user } = result;
  if (!canAccessAdmin(user ?? role)) {
    return new NextResponse('Forbidden', { status: 403 });
  }
  return { session, role, user };
}

const QuerySchema = ListQuery.extend({
  status: z.string().trim().optional(),
  customerId: z.string().trim().optional(),
});

export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const { searchParams } = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    q: searchParams.get('q') || undefined,
    cursor: searchParams.get('cursor') || undefined,
    take: searchParams.get('take') || undefined,
    status: searchParams.get('status') || undefined,
    customerId: searchParams.get('customerId') || undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const { q, cursor, take, status, customerId } = parsed.data;

  const where: any = {};
  if (q) {
    where.OR = [
      { quoteNumber: { contains: q, mode: 'insensitive' } },
      { companyName: { contains: q, mode: 'insensitive' } },
      { contactName: { contains: q, mode: 'insensitive' } },
    ];
  }
  if (status) where.status = status;
  if (customerId) where.customerId = customerId;

  const items = await listQuotes({
    where: Object.keys(where).length ? where : undefined,
    take,
    cursor,
  });
  const nextCursor = items.length > take ? items[take]?.id ?? null : null;
  if (nextCursor) items.pop();

  const normalized = items.map((item) => {
    const enriched = {
      ...item,
      metadata: parseQuoteMetadata(item.metadata) ?? null,
    };
    return sanitizePricingForNonAdmin(enriched, true);
  });

  return NextResponse.json({ items: normalized, nextCursor });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;
  const userId = (guard.session.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: 'Unable to determine current user' }, { status: 401 });
  const parsed = QuoteCreate.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  try {
    const submission = submissionIdentity({ actorId: userId, scope: 'quote:create', clientKey: req.headers.get('Idempotency-Key'), payload: parsed.data });
    const created = await createQuoteFromPayload(parsed.data, userId, submission);
    if (!created) throw new Error('Unable to create quote.');
    return NextResponse.json({ ok: true, item: { ...created, metadata: parseQuoteMetadata(created.metadata) ?? null } });
  } catch (error) {
    if (error instanceof SubmissionError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    console.error('Quote submission failed', error);
    return NextResponse.json({ error: 'Unable to confirm quote creation. Retry the saved submission.' }, { status: 503 });
  }
}
