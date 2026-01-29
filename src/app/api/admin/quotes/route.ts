import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '@/lib/auth';
import { parseQuoteMetadata } from '@/lib/quote-metadata';
import { canAccessAdmin } from '@/lib/rbac';
import { ListQuery } from '@/lib/zod';
import { QuoteCreate } from '@/lib/zod-quotes';
import { sanitizePricingForNonAdmin } from '@/lib/quote-visibility';
import { hasCustomFieldValue, serializeCustomFieldValue } from '@/lib/custom-field-values';
import {
  createQuoteWithDetails,
  findActiveQuoteCustomFields,
  listQuotes,
  prepareQuoteComponents,
} from '@/modules/quotes/quotes.service';

async function getSessionWithRole() {
  const session = await getServerSession(authOptions);
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
  const session = guard.session;

  const body = await req.json();
  const parsed = QuoteCreate.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const data = parsed.data;
  const userId = (session.user as any)?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Unable to determine current user' }, { status: 400 });
  }

  let prepared;
  try {
    prepared = await prepareQuoteComponents(data);
  } catch (error: any) {
    const message = typeof error?.message === 'string' ? error.message : 'Failed to prepare quote';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const customFieldValues = data.customFieldValues ?? [];
  const validCustomFieldValues = customFieldValues.length
    ? await findActiveQuoteCustomFields({
        fieldIds: customFieldValues.map((value) => value.fieldId),
        business: data.business,
      })
    : [];
  const allowedFieldIds = new Set(validCustomFieldValues.map((field) => field.id));
  const normalizedCustomFieldValues = customFieldValues
    .filter((value) => allowedFieldIds.has(value.fieldId) && hasCustomFieldValue(value.value))
    .map((value) => ({
      fieldId: value.fieldId,
      value: serializeCustomFieldValue(value.value),
    }))
    .filter((value) => value.value !== null);

  const created = await createQuoteWithDetails({
    data,
    prepared,
    normalizedCustomFieldValues,
    userId,
  });

  if (!created) {
    return NextResponse.json({ error: 'Unable to create quote' }, { status: 500 });
  }

  const normalized = {
    ...created,
    metadata: parseQuoteMetadata(created.metadata) ?? null,
  };

  return NextResponse.json({ ok: true, item: normalized });
}
