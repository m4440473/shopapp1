import 'server-only';

import { BUSINESS_PREFIX_BY_CODE, type BusinessCode } from '@/lib/businesses';
import { sumQuoteCustomAmountsCents } from '@/lib/quote-metadata';
import type { QuoteCreateInput } from '@/modules/quotes/quotes.schema';
import type { QuoteApprovalMetadata } from '@/lib/quote-metadata';
import { calculatePartLotTotal } from '@/modules/pricing/part-pricing';
import { calculatePartPricingSummaryTotalsCents, calculateWorkItemsSubtotalCents } from '@/modules/pricing/work-item-pricing';
import { calculateProcurementTotalCents, calculateSuggestedPartUnitPriceCents } from '@/modules/pricing/part-pricing';
import { dedupeSelectionsByAddonId } from '@/modules/quotes/quote-addon-bulk';
import {
  createQuoteWithDetails,
  deleteQuoteById,
  findActiveOrderCustomFields,
  findActiveQuoteCustomFields,
  findQuoteAttachmentByStoragePath,
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
  partPricing: Array<{
    quotePartId: string | null;
    name: string;
    partNumber: string | null;
    priceCents: number;
    pricingMode: 'PER_UNIT' | 'LOT_TOTAL';
    priceSource: 'CALCULATED' | 'MANUAL';
    suggestedUnitPriceCents: number;
  }>;
  parts: Array<{
    id: string | null;
    name: string;
    partNumber: string | null;
    materialId: string | null;
    drawingMaterialText: string | null;
    drawingFinishText: string | null;
    finish: string | null;
    stockSize: string | null;
    cutLength: string | null;
    materialStatus: 'UNREVIEWED' | 'IN_STOCK' | 'NEED_TO_ORDER' | 'NOT_REQUIRED';
    inventoryLocation: string | null;
    materialNotes: string | null;
    procurementVendorId: string | null;
    procurementCostCents: number | null;
    procurementMarkupPercent: number | null;
    sortOrder: number;
    description: string | null;
    quantity: number;
    pieceCount: number;
    notes: string | null;
    attachments: Array<{
      id: string | null;
      kind: string;
      url: string | null;
      storagePath: string | null;
      label: string | null;
      mimeType: string | null;
    }>;
    addonSelections: Array<{
      addonId: string;
      units: number;
      rateTypeSnapshot: string;
      rateCents: number;
      totalCents: number;
      affectsPriceSnapshot: boolean;
      isChecklistItemSnapshot: boolean;
      departmentIdSnapshot: string | null;
      nameSnapshot: string;
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
    id: string | null;
    url: string | null;
    storagePath: string | null;
    label: string | null;
    mimeType: string | null;
  }>;
}

export function calculatePricedAddonTotal(
  selections: Array<{ units: number; rateCents: number; affectsPrice: boolean }>
) {
  return selections.reduce((sum, selection) => {
    if (!selection.affectsPrice) return sum;
    const units = Number.isFinite(selection.units) ? selection.units : 0;
    return sum + Math.round(selection.rateCents * (units > 0 ? units : 0));
  }, 0);
}

export function calculateQuoteEstimateTotalCents({
  basePriceCents,
  vendorTotalCents,
  parts,
  partPricing,
  addonMap,
  customAmountsCents,
}: {
  basePriceCents: number;
  vendorTotalCents: number;
  parts: QuoteCreateInput['parts'];
  partPricing: QuoteCreateInput['partPricing'];
  addonMap: Map<string, { rateCents: number; affectsPrice: boolean }>;
  customAmountsCents: number;
}) {
  const pricingSummaryTotals = calculatePartPricingSummaryTotalsCents({
    parts: (parts ?? []).map((part, index) => {
      const workItemsSubtotalCents = calculateWorkItemsSubtotalCents({
        selections: dedupeSelectionsByAddonId(part.addonSelections ?? []).map((selection) => ({
          addonId: selection.addonId,
          units: selection.units ?? 0,
        })),
        itemsById: addonMap,
      });
      const pricingEntry = partPricing?.[index];
      const enteredPriceCents = Math.max(0, pricingEntry?.priceCents ?? 0);
      const quantity = Math.max(1, part.quantity ?? 1);
      const priceSource = pricingEntry
        ? pricingEntry.priceSource === 'CALCULATED'
          ? 'CALCULATED'
          : 'MANUAL'
        : 'CALCULATED';
      const procurementTotalCents = part.materialStatus === 'NEED_TO_ORDER'
        ? calculateProcurementTotalCents({
            baseCostCents: part.procurementCostCents ?? 0,
            markupPercent: part.procurementMarkupPercent,
          })
        : 0;
      const suggestedUnitPriceCents = calculateSuggestedPartUnitPriceCents({
        workItemsSubtotalCents,
        procurementTotalCents,
        quantity,
      });
      return {
        workItemsSubtotalCents,
        partPricingSubtotalCents:
          priceSource === 'MANUAL'
            ? calculatePartLotTotal({
                enteredPriceCents,
                quantity,
                pricingMode: pricingEntry?.pricingMode === 'PER_UNIT' ? 'PER_UNIT' : 'LOT_TOTAL',
              })
            : suggestedUnitPriceCents * quantity,
        hasPartPricingOverride: true,
      };
    }),
  });

  return (
    basePriceCents +
    vendorTotalCents +
    pricingSummaryTotals.addonsAndLaborCents +
    pricingSummaryTotals.partPricingCents +
    customAmountsCents
  );
}

type ExistingQuoteWorkStepSnapshot = {
  quotePartId: string | null;
  addonId: string;
  rateTypeSnapshot: string;
  rateCents: number;
  totalCents: number;
  affectsPriceSnapshot: boolean;
  isChecklistItemSnapshot: boolean;
  departmentIdSnapshot: string | null;
  nameSnapshot: string | null;
};

export async function prepareQuoteComponents(
  input: QuoteCreateInput,
  options?: {
    existingQuoteNumber?: string;
    existingWorkStepSnapshots?: ExistingQuoteWorkStepSnapshot[];
  }
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

  type AddonRecord = {
    id: string;
    name: string;
    rateType: string;
    rateCents: number;
    affectsPrice: boolean;
    isChecklistItem: boolean;
    departmentId: string;
  };
  const addonSelectionsInput = parts.flatMap((part, partIndex) =>
    dedupeSelectionsByAddonId(part.addonSelections ?? []).map((item) => ({ partIndex, item }))
  );
  const addonIds = addonSelectionsInput.map(({ item }) => item.addonId);
  const addonRecords = (await listAddonsByIds(addonIds)) as AddonRecord[];
  const addonMap = new Map(addonRecords.map((addon) => [addon.id, addon]));
  const existingSnapshotMap = new Map(
    (options?.existingWorkStepSnapshots ?? [])
      .filter((selection) => selection.quotePartId)
      .map((selection) => [`${selection.quotePartId}:${selection.addonId}`, selection]),
  );

  for (const selection of addonSelectionsInput) {
    if (!addonMap.has(selection.item.addonId)) {
      throw new Error(`Addon ${selection.item.addonId} not found`);
    }
  }

  const addonSelectionsByPart = new Map<number, PreparedQuoteComponents['parts'][number]['addonSelections']>();
  for (const selection of addonSelectionsInput) {
    const addon = addonMap.get(selection.item.addonId)!;
    const units = typeof selection.item.units === 'number' ? selection.item.units : 0;
    const quotePartId = parts[selection.partIndex]?.id ?? null;
    const snapshot = quotePartId
      ? existingSnapshotMap.get(`${quotePartId}:${selection.item.addonId}`)
      : null;
    const rateTypeSnapshot = snapshot?.rateTypeSnapshot ?? addon.rateType;
    const rateCents = snapshot?.rateCents ?? addon.rateCents;
    const affectsPriceSnapshot = snapshot?.affectsPriceSnapshot ?? addon.affectsPrice;
    const isChecklistItemSnapshot = snapshot?.isChecklistItemSnapshot ?? addon.isChecklistItem;
    const departmentIdSnapshot = snapshot?.departmentIdSnapshot ?? addon.departmentId ?? null;
    const nameSnapshot = snapshot?.nameSnapshot ?? addon.name;
    const totalCents = affectsPriceSnapshot ? Math.round(rateCents * units) : 0;
    const entry = {
      addonId: addon.id,
      units,
      rateTypeSnapshot,
      rateCents,
      totalCents,
      affectsPriceSnapshot,
      isChecklistItemSnapshot,
      departmentIdSnapshot,
      nameSnapshot,
      notes: selection.item.notes ?? null,
    };
    const existing = addonSelectionsByPart.get(selection.partIndex) ?? [];
    addonSelectionsByPart.set(selection.partIndex, [...existing, entry]);
  }

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
  const customAmountsCents = sumQuoteCustomAmountsCents(input.customAmounts);
  const canonicalPartPricing = parts.map((part, index) => {
    const workItemsSubtotalCents = (addonSelectionsByPart.get(index) ?? []).reduce(
      (sum, selection) => sum + selection.totalCents,
      0,
    );
    const quantity = Math.max(1, part.quantity ?? 1);
    const procurementTotalCents = part.materialStatus === 'NEED_TO_ORDER'
      ? calculateProcurementTotalCents({
          baseCostCents: part.procurementCostCents ?? 0,
          markupPercent: part.procurementMarkupPercent,
        })
      : 0;
    const suggestedUnitPriceCents = calculateSuggestedPartUnitPriceCents({
      workItemsSubtotalCents,
      procurementTotalCents,
      quantity,
    });
    const submitted = input.partPricing?.[index];
    const priceSource: 'CALCULATED' | 'MANUAL' = submitted?.priceSource === 'MANUAL' ? 'MANUAL' : 'CALCULATED';
    return {
      quotePartId: part.id?.trim() || null,
      name: part.name,
      partNumber: part.partNumber ?? null,
      priceCents: priceSource === 'MANUAL' ? Math.max(0, submitted?.priceCents ?? 0) : suggestedUnitPriceCents,
      pricingMode: priceSource === 'MANUAL' && submitted?.pricingMode === 'LOT_TOTAL' ? 'LOT_TOTAL' as const : 'PER_UNIT' as const,
      priceSource,
      suggestedUnitPriceCents,
    };
  });
  const pricingTotals = calculatePartPricingSummaryTotalsCents({
    parts: parts.map((part, index) => {
      const workItemsSubtotalCents = (addonSelectionsByPart.get(index) ?? []).reduce(
        (sum, selection) => sum + selection.totalCents,
        0,
      );
      const partPricingEntry = canonicalPartPricing[index];
      return {
        workItemsSubtotalCents,
        partPricingSubtotalCents: calculatePartLotTotal({
          enteredPriceCents: partPricingEntry.priceCents,
          quantity: Math.max(1, part.quantity ?? 1),
          pricingMode: partPricingEntry.pricingMode,
        }),
        hasPartPricingOverride: true,
      };
    }),
  });
  const addonsTotalCents = pricingTotals.addonsAndLaborCents;
  const totalCents =
    basePriceCents + vendorTotalCents + pricingTotals.addonsAndLaborCents + pricingTotals.partPricingCents + customAmountsCents;

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

  const optionalId = (value: string | null | undefined) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  };

  const partsData = parts.map((part, index) => ({
    id: optionalId(part.id),
    name: part.name,
    partNumber: part.partNumber ?? null,
    materialId: optionalId(part.materialId),
    drawingMaterialText: part.drawingMaterialText ?? null,
    drawingFinishText: part.drawingFinishText ?? null,
    finish: part.finish ?? null,
    stockSize: part.stockSize ?? null,
    cutLength: part.cutLength ?? null,
    materialStatus: part.materialStatus ?? 'UNREVIEWED',
    inventoryLocation: part.inventoryLocation ?? null,
    materialNotes: part.materialNotes ?? null,
    procurementVendorId: optionalId(part.procurementVendorId),
    procurementCostCents: part.procurementCostCents ?? null,
    procurementMarkupPercent: part.procurementMarkupPercent ?? null,
    sortOrder: part.sortOrder ?? index,
    description: part.description ?? null,
    quantity: part.quantity ?? 1,
    pieceCount: part.pieceCount ?? 1,
    notes: part.notes ?? null,
    attachments: (part.attachments ?? []).map((attachment) => ({
      id: optionalId(attachment.id),
      kind: attachment.kind ?? 'DWG',
      url: attachment.url?.trim() ? attachment.url.trim() : null,
      storagePath: attachment.storagePath?.trim() ? attachment.storagePath.trim() : null,
      label: attachment.label?.trim() ? attachment.label.trim() : null,
      mimeType: attachment.mimeType?.trim() ? attachment.mimeType.trim() : null,
    })),
    addonSelections: addonSelectionsByPart.get(index) ?? [],
  }));

  const attachments = attachmentsInput
    .map((attachment) => ({
      id: optionalId(attachment.id),
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
    partPricing: canonicalPartPricing,
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
  findQuoteAttachmentByStoragePath,
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
