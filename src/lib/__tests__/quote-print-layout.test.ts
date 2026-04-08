import { describe, expect, it } from 'vitest';

import { buildQuoteRenderBlocks } from '@/lib/quote-print-layout';

describe('buildQuoteRenderBlocks', () => {
  it('maps legacy section labels to quote render blocks', () => {
    const blocks = buildQuoteRenderBlocks({
      sections: ['Header', 'Part Info', 'Shipping'],
      blocks: [],
    });

    expect(blocks.map((block) => block.type)).toEqual(['header', 'part_pricing', 'requirements']);
  });

  it('preserves visibility and pricing options from structured blocks', () => {
    const blocks = buildQuoteRenderBlocks({
      sections: [],
      blocks: [
        {
          id: 'pricing',
          type: 'part_pricing',
          label: 'Part pricing',
          visible: false,
          order: 0,
          variant: 'compact',
          options: {
            showUnitPrice: false,
            showQuantity: true,
            showLineTotal: true,
            showPricingMode: false,
          },
        },
      ],
    });

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      type: 'part_pricing',
      visible: false,
      variant: 'compact',
      pricingOptions: {
        showUnitPrice: false,
        showQuantity: true,
        showLineTotal: true,
        showPricingMode: false,
      },
    });
  });

  it('normalizes scope and addons options for structured blocks', () => {
    const blocks = buildQuoteRenderBlocks({
      sections: [],
      blocks: [
        {
          id: 'scope',
          type: 'line items',
          label: 'Line Items',
          visible: true,
          order: 0,
          variant: 'standard',
          options: {
            showMaterial: false,
            showStockSize: true,
            showNotes: false,
          },
        },
        {
          id: 'addons',
          type: 'addons/labor',
          label: 'Addons/Labor',
          visible: true,
          order: 1,
          variant: 'compact',
          options: {
            showPrices: false,
            showUnits: true,
            showPartContext: true,
          },
        },
      ],
    });

    expect(blocks[0]).toMatchObject({
      type: 'scope',
      scopeOptions: {
        showMaterial: false,
        showStockSize: true,
        showNotes: false,
      },
    });
    expect(blocks[1]).toMatchObject({
      type: 'addons_labor',
      addonsOptions: {
        showPrices: false,
        showUnits: true,
        showPartContext: true,
      },
    });
  });
});
