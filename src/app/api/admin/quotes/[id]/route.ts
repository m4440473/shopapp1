import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { DEFAULT_QUOTE_METADATA, parseQuoteMetadata, stringifyQuoteMetadata } from '@/lib/quote-metadata';
import { canAccessAdmin } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { QuoteCreate } from '@/lib/zod-quotes';
import { prepareQuoteComponents } from '@/lib/quotes.server';
import { sanitizePricingForNonAdmin } from '@/lib/quote-visibility';

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

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const item = await prisma.quote.findUnique({
    where: { id: params.id },
    include: {
      customer: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      parts: { include: { material: true } },
      vendorItems: true,
      addonSelections: {
        include: {
          addon: { select: { id: true, name: true, rateType: true, rateCents: true } },
        },
      },
      attachments: true,
    },
  });

  if (!item) {
    return new NextResponse('Not found', { status: 404 });
  }

  const normalized = {
    ...item,
    metadata: parseQuoteMetadata(item.metadata) ?? null,
  };

  return NextResponse.json({ item: sanitizePricingForNonAdmin(normalized, true) });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  await prisma.quote.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const body = await req.json();
  const parsed = QuoteCreate.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const existing = await prisma.quote.findUnique({
    where: { id: params.id },
    select: { quoteNumber: true, metadata: true },
  });
  if (!existing) {
    return new NextResponse('Not found', { status: 404 });
  }

  let prepared;
  try {
    prepared = await prepareQuoteComponents(parsed.data, { existingQuoteNumber: existing.quoteNumber });
  } catch (error: any) {
    const message = typeof error?.message === 'string' ? error.message : 'Failed to prepare quote';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const existingMetadata = parseQuoteMetadata(existing.metadata) ?? DEFAULT_QUOTE_METADATA;
  const nextMetadata = {
    ...existingMetadata,
    ...(parsed.data.partPricing
      ? {
          partPricing: parsed.data.partPricing.map((entry) => ({
            name: entry.name ?? null,
            partNumber: entry.partNumber ?? null,
            priceCents: entry.priceCents ?? 0,
          })),
        }
      : {}),
    charges: prepared.charges,
  };

  const updated = await prisma.quote.update({
    where: { id: params.id },
    data: {
      quoteNumber: prepared.quoteNumber,
      business: parsed.data.business,
      companyName: parsed.data.companyName,
      contactName: parsed.data.contactName ?? null,
      contactEmail: parsed.data.contactEmail ?? null,
      contactPhone: parsed.data.contactPhone ?? null,
      customerId: parsed.data.customerId ?? null,
      status: parsed.data.status ?? 'DRAFT',
      materialSummary: parsed.data.materialSummary ?? null,
      purchaseItems: parsed.data.purchaseItems ?? null,
      requirements: parsed.data.requirements ?? null,
      notes: parsed.data.notes ?? null,
      multiPiece: prepared.multiPiece,
      basePriceCents: prepared.basePriceCents,
      vendorTotalCents: prepared.vendorTotalCents,
      addonsTotalCents: prepared.addonsTotalCents,
      totalCents: prepared.totalCents,
      metadata: stringifyQuoteMetadata(nextMetadata),
      parts: {
        deleteMany: {},
        create: prepared.parts,
      },
      vendorItems: {
        deleteMany: {},
        create: prepared.vendorItems,
      },
      addonSelections: {
        deleteMany: {},
        create: prepared.addonSelections,
      },
      attachments: {
        deleteMany: {},
        create: prepared.attachments.map((attachment) => ({
          url: attachment.url,
          storagePath: attachment.storagePath,
          label: attachment.label,
          mimeType: attachment.mimeType,
        })),
      },
    },
    include: {
      customer: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      parts: true,
      vendorItems: true,
      addonSelections: {
        include: { addon: { select: { id: true, name: true, rateType: true, rateCents: true } } },
      },
      attachments: true,
    },
  });

  const normalized = {
    ...updated,
    metadata: parseQuoteMetadata(updated.metadata) ?? null,
  };

  return NextResponse.json({ ok: true, item: normalized });
}
