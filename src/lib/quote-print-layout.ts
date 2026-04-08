import { normalizeSectionName, type TemplateLayout, type TemplateLayoutBlock } from '@/lib/document-template-layout';

export type QuoteBlockType =
  | 'header'
  | 'customer_info'
  | 'total_price'
  | 'scope'
  | 'part_pricing'
  | 'addons_labor'
  | 'requirements'
  | 'custom';

export type QuotePricingBlockOptions = {
  showUnitPrice: boolean;
  showQuantity: boolean;
  showLineTotal: boolean;
  showPricingMode: boolean;
};

export type QuoteRenderBlock = {
  id: string;
  type: QuoteBlockType;
  label: string;
  visible: boolean;
  order: number;
  variant: 'standard' | 'compact';
  pricingOptions?: QuotePricingBlockOptions;
};

export const DEFAULT_QUOTE_PRICING_OPTIONS: QuotePricingBlockOptions = {
  showUnitPrice: true,
  showQuantity: true,
  showLineTotal: true,
  showPricingMode: true,
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

function fromBlock(block: TemplateLayoutBlock): QuoteRenderBlock {
  const type = toQuoteBlockType(block.type || block.label);
  return {
    id: block.id,
    type,
    label: block.label,
    visible: block.visible !== false,
    order: block.order,
    variant: block.variant === 'compact' ? 'compact' : 'standard',
    pricingOptions: type === 'part_pricing' ? normalizePricingOptions(block.options) : undefined,
  };
}

export function buildQuoteRenderBlocks(layout: TemplateLayout): QuoteRenderBlock[] {
  if (layout.blocks.length > 0) {
    return [...layout.blocks].sort((a, b) => a.order - b.order).map(fromBlock);
  }

  return layout.sections.map((section, index) =>
    fromBlock({
      id: `section-${index + 1}`,
      type: section,
      label: section,
      visible: true,
      order: index,
      variant: 'standard',
    }),
  );
}
