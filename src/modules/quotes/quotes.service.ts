import 'server-only';

import { BUSINESS_PREFIX_BY_CODE, type BusinessCode } from '@/lib/businesses';
import type { QuoteCreateInput } from '@/lib/zod-quotes';
import type { QuoteApprovalMetadata } from '@/lib/quote-metadata';
import {
  createQuoteWithDetails,
  deleteQuoteById,
  findActiveOrderCustomFields,
  findActiveQuoteCustomFields,
  findQuoteById,
  findQuoteByNumber,
  findQuoteForConversion,
  findQuoteForUpdate,
  listAddonsByIds,
  listQuoteCustomFieldValues,
  listQuotes,
  listVendorsByIds,
  updateQuoteApproval,
  updateQuoteWithDetails,
  convertQuoteToOrder,
} from './quotes.repo';

function prefixForBusiness(business: BusinessCode): string {
  return BUSINESS_PREFIX_BY_CODE[business] ?? business;
}

export async function generateQuoteNumber(business: BusinessCode) {
  const prefix = prefixForBusiness(business);
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = `${prefix}-${stamp}-${Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, '0')}`;
    const existing = await findQuoteByNumber(candidate);
    if (!existing) {
      return candidate;
    }
  }
  return `${prefix}-${stamp}-${Date.now()}`;
}

export interface PreparedQuoteComponents {
  quoteNumber: string;
  multiPiece: boolean;
  basePriceCents: number;
  vendorTotalCents: number;
  addonsTotalCents: number;
  totalCents: number;
  parts: Array<{
    name: string;
    partNumber: string | null;
    materialId: string | null;
    stockSize: string | null;
    cutLength: string | null;
    description: string | null;
    quantity: number;
    pieceCount: number;
    notes: string | null;
    addonSelections: Array<{
      addonId: string;
      units: number;
      rateTypeSnapshot: string;
      rateCents: number;
      totalCents: number;
      notes: string | null;
    }>;
  }>;
  vendorItems: Array<{
    vendorId: string | null;
    vendorName: string | null;
    partNumber: string | null;
    partUrl: string | null;
    basePriceCents: number;
    markupPercent: number;
    finalPriceCents: number;
    notes: string | null;
  }>;
  attachments: Array<{
    url: string | null;
    storagePath: string | null;
    label: string | null;
    mimeType: string | null;
  }>;
}

export async function prepareQuoteComponents(
  input: QuoteCreateInput,
  options?: { existingQuoteNumber?: string }
): Promise<PreparedQuoteComponents> {
  const business = input.business as BusinessCode;
  const prefix = prefixForBusiness(business);
  const parts = input.parts ?? [];
  const vendorItemsInput = input.vendorItems ?? [];
  const attachmentsInput = input.attachments ?? [];

  const vendorIds = vendorItemsInput
    .map((item) => item.vendorId)
    .filter((value): value is string => typeof value === 'string' && value.length > 0);
  type VendorRecord = { id: string; name?: string | null };
  const vendorRecords = (await listVendorsByIds(vendorIds)) as VendorRecord[];
  const vendorMap = new Map(vendorRecords.map((vendor) => [vendor.id, vendor]));

  type AddonRecord = { id: string; name: string; rateType: string; rateCents: number };
  const addonSelectionsInput = parts.flatMap((part, partIndex) =>
    (part.addonSelections ?? []).map((item) => ({ partIndex, item }))
  );
  const addonIds = addonSelectionsInput.map(({ item }) => item.addonId);
  const addonRecords = (await listAddonsByIds(addonIds)) as AddonRecord[];
  const addonMap = new Map(addonRecords.map((addon) => [addon.id, addon]));

  for (const selection of addonSelectionsInput) {
    if (!addonMap.has(selection.item.addonId)) {
      throw new Error(`Addon ${selection.item.addonId} not found`);
    }
  }

  const addonSelectionsByPart = new Map<number, PreparedQuoteComponents['parts'][number]['addonSelections']>();
  for (const selection of addonSelectionsInput) {
    const addon = addonMap.get(selection.item.addonId)!;
    const units = typeof selection.item.units === 'number' ? selection.item.units : 0;
    const totalCents = Math.round(addon.rateCents * units);
    const entry = {
      addonId: addon.id,
      units,
      rateTypeSnapshot: addon.rateType,
      rateCents: addon.rateCents,
      totalCents,
      notes: selection.item.notes ?? null,
    };
    const existing = addonSelectionsByPart.get(selection.partIndex) ?? [];
    addonSelectionsByPart.set(selection.partIndex, [...existing, entry]);
  }

  const addonsTotalCents = Array.from(addonSelectionsByPart.values()).reduce(
    (sum, selections) => sum + selections.reduce((innerSum, selection) => innerSum + selection.totalCents, 0),
    0
  );

  const vendorItems = vendorItemsInput.map((item) => {
    const vendor = item.vendorId ? vendorMap.get(item.vendorId) : undefined;
    const basePriceCents = item.basePriceCents ?? 0;
    const markupPercent = item.markupPercent ?? 0;
    const calculatedFinal = Math.round(basePriceCents * (1 + markupPercent / 100));
    const finalPriceCents = item.finalPriceCents && item.finalPriceCents > 0 ? item.finalPriceCents : calculatedFinal;
    return {
      vendorId: item.vendorId ?? null,
      vendorName: item.vendorName ?? vendor?.name ?? null,
      partNumber: item.partNumber ?? null,
      partUrl: item.partUrl ?? null,
      basePriceCents,
      markupPercent,
      finalPriceCents,
      notes: item.notes ?? null,
    };
  });

  const vendorTotalCents = vendorItems.reduce((sum, item) => sum + item.finalPriceCents, 0);
  const basePriceCents = input.basePriceCents ?? 0;
  const totalCents = basePriceCents + vendorTotalCents + addonsTotalCents;

  const providedQuoteNumber = input.quoteNumber?.trim();
  let quoteNumber: string;
  if (providedQuoteNumber && providedQuoteNumber.length > 0) {
    if (!providedQuoteNumber.startsWith(`${prefix}-`)) {
      throw new Error(`Quote numbers for ${prefix} must start with ${prefix}-`);
    }
    quoteNumber = providedQuoteNumber;
  } else if (options?.existingQuoteNumber && options.existingQuoteNumber.length > 0) {
    if (options.existingQuoteNumber.startsWith(`${prefix}-`)) {
      quoteNumber = options.existingQuoteNumber;
    } else {
      quoteNumber = await generateQuoteNumber(business);
    }
  } else {
    quoteNumber = await generateQuoteNumber(business);
  }

  const multiPiece =
    typeof input.multiPiece === 'boolean'
      ? input.multiPiece
      : parts.some((part) => (part.pieceCount ?? 1) > 1);

  const partsData = parts.map((part, index) => ({
    name: part.name,
    partNumber: part.partNumber ?? null,
    materialId: part.materialId ?? null,
    stockSize: part.stockSize ?? null,
    cutLength: part.cutLength ?? null,
    description: part.description ?? null,
    quantity: part.quantity ?? 1,
    pieceCount: part.pieceCount ?? 1,
    notes: part.notes ?? null,
    addonSelections: addonSelectionsByPart.get(index) ?? [],
  }));

  const attachments = attachmentsInput
    .map((attachment) => ({
      url: attachment.url?.trim() ? attachment.url.trim() : null,
      storagePath: attachment.storagePath?.trim() ? attachment.storagePath.trim() : null,
      label: attachment.label?.trim() ? attachment.label.trim() : null,
      mimeType: attachment.mimeType?.trim() ? attachment.mimeType.trim() : null,
    }))
    .filter((attachment) => attachment.url || attachment.storagePath);

  return {
    quoteNumber,
    multiPiece,
    basePriceCents,
    vendorTotalCents,
    addonsTotalCents,
    totalCents,
    parts: partsData,
    vendorItems,
    attachments,
  };
}

export {
  createQuoteWithDetails,
  deleteQuoteById,
  findActiveOrderCustomFields,
  findActiveQuoteCustomFields,
  findQuoteById,
  findQuoteForConversion,
  findQuoteForUpdate,
  listQuoteCustomFieldValues,
  listQuotes,
  updateQuoteApproval,
  updateQuoteWithDetails,
  convertQuoteToOrder,
};

export type { QuoteApprovalMetadata };
