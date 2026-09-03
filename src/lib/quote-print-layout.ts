import { normalizeSectionName, type TemplateLayout, type TemplateLayoutBlock } from '@/lib/document-template-layout';
import { normalizeDocumentHeaderOptions, type DocumentHeaderOptions } from '@/lib/document-header';

export type QuoteBlockType =
  | 'header'
  | 'customer_info'
  | 'total_price'
  | 'scope'
  | 'part_pricing'
  | 'addons_labor'
  | 'requirements'
  | 'disclaimer'
  | 'custom';

export type QuotePricingBlockOptions = {
  showUnitPrice: boolean;
  showQuantity: boolean;
  showLineTotal: boolean;
  showPricingMode: boolean;
};

export type QuoteScopeBlockOptions = {
  showPartNumber: boolean;
  showQuantity: boolean;
  showPieces: boolean;
  showMaterial: boolean;
  showStockSize: boolean;
  showCutLength: boolean;
  showDescription: boolean;
  showNotes: boolean;
};

export type QuoteAddonsBlockOptions = {
  showPrices: boolean;
  showUnits: boolean;
  showNotes: boolean;
  showPartContext: boolean;
  showVendorItems: boolean;
};

export type QuoteRequirementsBlockOptions = {
  showMaterials: boolean;
  showPurchasedItems: boolean;
  showRequirements: boolean;
  showNotes: boolean;
};

export type QuoteDisclaimerBlockOptions = {
  heading: string;
  body: string;
};

export type QuoteRenderBlock = {
  id: string;
  type: QuoteBlockType;
  label: string;
  visible: boolean;
  order: number;
  variant: 'standard' | 'compact';
  headerOptions?: DocumentHeaderOptions;
  pricingOptions?: QuotePricingBlockOptions;
  scopeOptions?: QuoteScopeBlockOptions;
  addonsOptions?: QuoteAddonsBlockOptions;
  requirementsOptions?: QuoteRequirementsBlockOptions;
  disclaimerOptions?: QuoteDisclaimerBlockOptions;
};

export const DEFAULT_QUOTE_PRICING_OPTIONS: QuotePricingBlockOptions = {
  showUnitPrice: true,
  showQuantity: true,
  showLineTotal: true,
  showPricingMode: true,
};

export const DEFAULT_QUOTE_SCOPE_OPTIONS: QuoteScopeBlockOptions = {
  showPartNumber: true,
  showQuantity: true,
  showPieces: true,
  showMaterial: true,
  showStockSize: true,
  showCutLength: true,
  showDescription: true,
  showNotes: true,
};

export const DEFAULT_QUOTE_ADDONS_OPTIONS: QuoteAddonsBlockOptions = {
  showPrices: true,
  showUnits: false,
  showNotes: false,
  showPartContext: false,
  showVendorItems: true,
};

export const DEFAULT_QUOTE_REQUIREMENTS_OPTIONS: QuoteRequirementsBlockOptions = {
  showMaterials: true,
  showPurchasedItems: true,
  showRequirements: true,
  showNotes: true,
};

export const DEFAULT_QUOTE_DISCLAIMER_OPTIONS: QuoteDisclaimerBlockOptions = {
  heading: 'PLEASE NOTE:',
  body: 'Prices and deliveries are valid for 30 days from the quote date.\nThank you for the opportunity to quote!',
};

function toQuoteBlockType(value: string): QuoteBlockType {
  const key = normalizeSectionName(value);
  if (key === 'header') return 'header';
  if (key === 'customer info') return 'customer_info';
  if (key === 'total price' || key === 'totals') return 'total_price';
  if (key === 'scope' || key === 'scope of work' || key === 'part name' || key === 'line items') return 'scope';
  if (key === 'part pricing' || key === 'pricing' || key === 'part info') return 'part_pricing';
  if (key === 'addons labor' || key === 'addons/labor') return 'addons_labor';
  if (key === 'requirements' || key === 'notes' || key === 'shipping' || key === 'notes requirements') {
    return 'requirements';
  }
  if (key === 'disclaimer' || key === 'terms disclaimer') return 'disclaimer';
  return 'custom';
}

function normalizePricingOptions(options: unknown): QuotePricingBlockOptions {
  const record = (options && typeof options === 'object' ? options : {}) as Record<string, unknown>;
  return {
    showUnitPrice: record.showUnitPrice !== false,
    showQuantity: record.showQuantity !== false,
    showLineTotal: record.showLineTotal !== false,
    showPricingMode: record.showPricingMode !== false,
  };
}

function normalizeScopeOptions(options: unknown): QuoteScopeBlockOptions {
  const record = (options && typeof options === 'object' ? options : {}) as Record<string, unknown>;
  return {
    showPartNumber: record.showPartNumber !== false,
    showQuantity: record.showQuantity !== false,
    showPieces: record.showPieces !== false,
    showMaterial: record.showMaterial !== false,
    showStockSize: record.showStockSize !== false,
    showCutLength: record.showCutLength !== false,
    showDescription: record.showDescription !== false,
    showNotes: record.showNotes !== false,
  };
}

function normalizeAddonsOptions(options: unknown): QuoteAddonsBlockOptions {
  const record = (options && typeof options === 'object' ? options : {}) as Record<string, unknown>;
  return {
    showPrices: record.showPrices !== false,
    showUnits: record.showUnits === true,
    showNotes: record.showNotes === true,
    showPartContext: record.showPartContext === true,
    showVendorItems: record.showVendorItems !== false,
  };
}

function normalizeRequirementsOptions(options: unknown): QuoteRequirementsBlockOptions {
  const record = (options && typeof options === 'object' ? options : {}) as Record<string, unknown>;
  return {
    showMaterials: record.showMaterials !== false,
    showPurchasedItems: record.showPurchasedItems !== false,
    showRequirements: record.showRequirements !== false,
    showNotes: record.showNotes !== false,
  };
}

function normalizeDisclaimerOptions(options: unknown): QuoteDisclaimerBlockOptions {
  const record = (options && typeof options === 'object' ? options : {}) as Record<string, unknown>;
  return {
    heading: typeof record.heading === 'string' ? record.heading.trim() : DEFAULT_QUOTE_DISCLAIMER_OPTIONS.heading,
    body: typeof record.body === 'string' ? record.body.trim() : DEFAULT_QUOTE_DISCLAIMER_OPTIONS.body,
  };
}

function fromBlock(block: TemplateLayoutBlock, businessCode?: string | null): QuoteRenderBlock {
  const type = toQuoteBlockType(block.type || block.label);
  return {
    id: block.id,
    type,
    label: block.label,
    visible: block.visible !== false,
    order: block.order,
    variant: block.variant === 'compact' ? 'compact' : 'standard',
    headerOptions: type === 'header' ? normalizeDocumentHeaderOptions(block.options, businessCode) : undefined,
    pricingOptions: type === 'part_pricing' ? normalizePricingOptions(block.options) : undefined,
    scopeOptions: type === 'scope' ? normalizeScopeOptions(block.options) : undefined,
    addonsOptions: type === 'addons_labor' ? normalizeAddonsOptions(block.options) : undefined,
    requirementsOptions: type === 'requirements' ? normalizeRequirementsOptions(block.options) : undefined,
    disclaimerOptions: type === 'disclaimer' ? normalizeDisclaimerOptions(block.options) : undefined,
  };
}

export function buildQuoteRenderBlocks(layout: TemplateLayout, businessCode?: string | null): QuoteRenderBlock[] {
  if (layout.blocks.length > 0) {
    return [...layout.blocks].sort((a, b) => a.order - b.order).map((block) => fromBlock(block, businessCode));
  }

  return layout.sections.map((section, index) =>
    fromBlock({
      id: `section-${index + 1}`,
      type: section,
      label: section,
      visible: true,
      order: index,
      variant: 'standard',
    }, businessCode),
  );
}
