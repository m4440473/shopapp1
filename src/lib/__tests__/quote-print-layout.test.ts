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
});
