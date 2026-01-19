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
      parts: {
        include: {
          material: true,
          addonSelections: {
            include: {
              addon: { select: { id: true, name: true, rateType: true, rateCents: true } },
            },
          },
        },
      },
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
  const nextMetadata = parsed.data.partPricing
    ? {
        ...existingMetadata,
        partPricing: parsed.data.partPricing.map((entry) => ({
          name: entry.name ?? null,
          partNumber: entry.partNumber ?? null,
          priceCents: entry.priceCents ?? 0,
        })),
      }
    : existingMetadata;

  const updated = await prisma.$transaction(async (tx) => {
    await tx.quote.update({
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
      },
    });

    await tx.quoteAddonSelection.deleteMany({ where: { quoteId: params.id } });
    await tx.quotePart.deleteMany({ where: { quoteId: params.id } });
    await tx.quoteVendorItem.deleteMany({ where: { quoteId: params.id } });
    await tx.quoteAttachment.deleteMany({ where: { quoteId: params.id } });

    const createdParts = await Promise.all(
      prepared.parts.map((part) =>
        tx.quotePart.create({
          data: {
            quoteId: params.id,
            name: part.name,
            partNumber: part.partNumber,
            materialId: part.materialId,
            stockSize: part.stockSize,
            cutLength: part.cutLength,
            description: part.description,
            quantity: part.quantity,
            pieceCount: part.pieceCount,
            notes: part.notes,
          },
          select: { id: true },
        })
      )
    );

    const addonSelections = prepared.parts.flatMap((part, index) => {
      const partId = createdParts[index]?.id;
      if (!partId) return [];
      return part.addonSelections.map((selection) => ({
        quoteId: params.id,
        quotePartId: partId,
        addonId: selection.addonId,
        units: selection.units,
        rateTypeSnapshot: selection.rateTypeSnapshot,
        rateCents: selection.rateCents,
        totalCents: selection.totalCents,
        notes: selection.notes,
      }));
    });

    if (addonSelections.length) {
      await tx.quoteAddonSelection.createMany({ data: addonSelections });
    }

    if (prepared.vendorItems.length) {
      await tx.quoteVendorItem.createMany({
        data: prepared.vendorItems.map((item) => ({
          quoteId: params.id,
          vendorId: item.vendorId,
          vendorName: item.vendorName,
          partNumber: item.partNumber,
          partUrl: item.partUrl,
          basePriceCents: item.basePriceCents,
          markupPercent: item.markupPercent,
          finalPriceCents: item.finalPriceCents,
          notes: item.notes,
        })),
      });
    }

    if (prepared.attachments.length) {
      await tx.quoteAttachment.createMany({
        data: prepared.attachments.map((attachment) => ({
          quoteId: params.id,
          url: attachment.url,
          storagePath: attachment.storagePath,
          label: attachment.label,
          mimeType: attachment.mimeType,
        })),
      });
    }

    return tx.quote.findUnique({
      where: { id: params.id },
      include: {
        customer: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        parts: {
          include: {
            material: true,
            addonSelections: {
              include: { addon: { select: { id: true, name: true, rateType: true, rateCents: true } } },
            },
          },
        },
        vendorItems: true,
        addonSelections: {
          include: { addon: { select: { id: true, name: true, rateType: true, rateCents: true } } },
        },
        attachments: true,
      },
    });
  });

  if (!updated) {
    return new NextResponse('Not found', { status: 404 });
  }

  const normalized = {
    ...updated,
    metadata: parseQuoteMetadata(updated.metadata) ?? null,
  };

  return NextResponse.json({ ok: true, item: normalized });
}
