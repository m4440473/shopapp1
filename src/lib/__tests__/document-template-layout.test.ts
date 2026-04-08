import { describe, expect, it } from 'vitest';

import { normalizeTemplateLayout } from '@/lib/document-template-layout';

describe('normalizeTemplateLayout', () => {
  it('normalizes legacy sections into structured blocks', () => {
    const layout = normalizeTemplateLayout({
      sections: ['Header', 'Part Info', 'Shipping'],
    });

    expect(layout.sections).toEqual(['Header', 'Part Info', 'Shipping']);
    expect(layout.blocks).toHaveLength(3);
    expect(layout.blocks[1]).toMatchObject({
      label: 'Part Info',
      type: 'part info',
      visible: true,
      order: 1,
      variant: 'standard',
    });
  });

  it('keeps provided structured blocks and order', () => {
    const layout = normalizeTemplateLayout({
      blocks: [
        { id: 'b2', type: 'part_pricing', label: 'Pricing', visible: true, order: 2, variant: 'compact' },
        { id: 'b1', type: 'header', label: 'Header', visible: true, order: 1, variant: 'standard' },
      ],
    });

    expect(layout.blocks.map((block) => block.id)).toEqual(['b1', 'b2']);
    expect(layout.sections).toEqual(['Header', 'Pricing']);
  });
});
