import { describe, expect, it } from 'vitest';

import { normalizeOrderQuantityInput } from '../order-input';
import { OrderCreate } from '../orders.schema';

describe('direct-order intake', () => {
  it('allows the quantity draft to be empty while typing and normalizes it only for submission', () => {
    expect(normalizeOrderQuantityInput('')).toBe(1);
    expect(normalizeOrderQuantityInput('12')).toBe(12);
    expect(normalizeOrderQuantityInput(4)).toBe(4);
  });

  it('allows on-hand material without claiming that purchasing is required', () => {
    const parsed = OrderCreate.safeParse({
      customerId: 'customer-1',
      receivedDate: '2026-08-26',
      dueDate: '2026-09-01',
      priority: 'NORMAL',
      business: 'STD',
      materialNeeded: false,
      materialOrdered: true,
      parts: [{ partNumber: 'P-1', quantity: 1, addonSelections: [] }],
      addonIds: [],
      attachments: [],
      customFieldValues: [],
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.materialNeeded).toBe(false);
      expect(parsed.data.materialOrdered).toBe(true);
    }
  });
});
