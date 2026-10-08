import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-session';

import { DEFAULT_QUOTE_METADATA, parseQuoteMetadata } from '@/lib/quote-metadata';
import { canAccessAdmin } from '@/lib/rbac';
import { QuoteUpdate } from '@/modules/quotes/quotes.schema';
import { sanitizePricingForNonAdmin } from '@/lib/quote-visibility';
import { hasCustomFieldValue, parseCustomFieldValue, serializeCustomFieldValue } from '@/lib/custom-field-values';
import { resolveCustomerContactSnapshot } from '@/modules/customers/customers.service';
import {
  deleteQuoteById,
  findActiveQuoteCustomFields,
  findQuoteById,
  findQuoteForUpdate,
  listQuoteCustomFieldValues,
  prepareQuoteComponents,
  updateQuoteWithDetails,
} from '@/modules/quotes/quotes.service';

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

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;
  const item = await findQuoteById(id);

  if (!item) {
    return new NextResponse('Not found', { status: 404 });
  }

  const customFieldValues = await listQuoteCustomFieldValues(item.id);

  const normalized = {
    ...item,
    metadata: parseQuoteMetadata(item.metadata) ?? null,
    customFieldValues: customFieldValues.map((value) => ({
      fieldId: value.fieldId,
      value: parseCustomFieldValue(value.value),
    })),
  };

  return NextResponse.json({ item: sanitizePricingForNonAdmin(normalized, true) });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;
  await deleteQuoteById(id);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = QuoteUpdate.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const existing = await findQuoteForUpdate(id);
  if (!existing) {
    return new NextResponse('Not found', { status: 404 });
  }

  let data = parsed.data;
  if (data.customerContactId) {
    if (!data.customerId) {
      return NextResponse.json({ error: 'Select a customer before selecting a contact.' }, { status: 400 });
    }
    try {
      const snapshot = await resolveCustomerContactSnapshot(data.customerId, data.customerContactId);
      data = { ...data, ...snapshot };
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Invalid customer contact.' },
        { status: 400 },
      );
    }
  }

  let prepared;
  try {
    prepared = await prepareQuoteComponents(data, {
      existingQuoteNumber: existing.quoteNumber,
      existingWorkStepSnapshots: existing.addonSelections,
    });
  } catch (error: any) {
    const message = typeof error?.message === 'string' ? error.message : 'Failed to prepare quote';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const existingMetadata = parseQuoteMetadata(existing.metadata) ?? DEFAULT_QUOTE_METADATA;
  const nextMetadata = {
    ...existingMetadata,
    originDepartmentId: data.originDepartmentId ?? null,
    partPricing: prepared.partPricing,
    customAmounts: data.customAmounts
      ? data.customAmounts.map((entry) => ({
          title: entry.title,
          amountCents: entry.amountCents ?? 0,
        }))
      : existingMetadata.customAmounts,
  };

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

  let updated;
  try {
    updated = await updateQuoteWithDetails({
      quoteId: id,
      data,
      prepared,
      normalizedCustomFieldValues,
      nextMetadata,
    });
  } catch (error) {
    if (data.expectedUpdatedAt && (error as { code?: string })?.code === 'P2025') {
      return NextResponse.json({ error: 'This quote changed after you opened it, or your previous save completed. Your local draft is retained; reload the saved quote before applying more changes.', code: 'QUOTE_CHANGED' }, { status: 409 });
    }
    console.error('Quote update failed', error);
    return NextResponse.json({ error: 'Unable to confirm quote changes. Keep your draft and reload the saved quote to check.' }, { status: 503 });
  }

  if (!updated) {
    return new NextResponse('Not found', { status: 404 });
  }

  const updatedCustomFieldValues = await listQuoteCustomFieldValues(id);

  const normalized = {
    ...updated,
    metadata: parseQuoteMetadata(updated.metadata) ?? null,
    customFieldValues: updatedCustomFieldValues.map((value) => ({
      fieldId: value.fieldId,
      value: parseCustomFieldValue(value.value),
    })),
  };

  return NextResponse.json({ ok: true, item: normalized });
}
