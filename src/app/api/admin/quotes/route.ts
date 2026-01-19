import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '@/lib/auth';
import { DEFAULT_QUOTE_METADATA, parseQuoteMetadata, stringifyQuoteMetadata } from '@/lib/quote-metadata';
import { canAccessAdmin } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { ListQuery } from '@/lib/zod';
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

  const items = await prisma.quote.findMany({
    where: Object.keys(where).length ? where : undefined,
    include: {
      customer: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      parts: { include: { material: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
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

  const created = await prisma.quote.create({
    data: {
      quoteNumber: prepared.quoteNumber,
      business: data.business,
      companyName: data.companyName,
      contactName: data.contactName ?? null,
      contactEmail: data.contactEmail ?? null,
      contactPhone: data.contactPhone ?? null,
      customerId: data.customerId ?? null,
      status: data.status ?? 'DRAFT',
      materialSummary: data.materialSummary ?? null,
      purchaseItems: data.purchaseItems ?? null,
      requirements: data.requirements ?? null,
      notes: data.notes ?? null,
      multiPiece: prepared.multiPiece,
      basePriceCents: prepared.basePriceCents,
      addonsTotalCents: prepared.addonsTotalCents,
      vendorTotalCents: prepared.vendorTotalCents,
      totalCents: prepared.totalCents,
      metadata: stringifyQuoteMetadata({
        ...DEFAULT_QUOTE_METADATA,
        partPricing: data.partPricing?.map((entry) => ({
          name: entry.name ?? null,
          partNumber: entry.partNumber ?? null,
          priceCents: entry.priceCents ?? 0,
        })),
        charges: prepared.charges,
      }),
      createdById: userId,
      parts: {
        create: prepared.parts,
      },
      vendorItems: {
        create: prepared.vendorItems,
      },
      addonSelections: {
        create: prepared.addonSelections,
      },
      attachments: {
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
        include: {
          addon: { select: { id: true, name: true, rateType: true, rateCents: true } },
        },
      },
      attachments: true,
    },
  });

  const normalized = {
    ...created,
    metadata: parseQuoteMetadata(created.metadata) ?? null,
  };

  return NextResponse.json({ ok: true, item: normalized });
}
