import { beforeEach, describe, expect, it, vi } from 'vitest';

const listQuoteNumbersForDateStamp = vi.hoisted(() => vi.fn());

vi.mock('../quotes.repo', () => ({
  listQuoteNumbersForDateStamp,
}));

import { generateQuoteNumber, resolveQuoteNumber } from '../quotes.service';

describe('generateQuoteNumber', () => {
  beforeEach(() => {
    listQuoteNumbersForDateStamp.mockReset();
  });

  it('assigns 001 to the first quote of the day using DDMMYY', async () => {
    listQuoteNumbersForDateStamp.mockResolvedValue([]);

    await expect(generateQuoteNumber(new Date(2026, 7, 24, 9, 30))).resolves.toBe('240826-001');
    expect(listQuoteNumbersForDateStamp).toHaveBeenCalledWith('240826');
  });

  it('assigns the next sequence after the highest valid quote number that day', async () => {
    listQuoteNumbersForDateStamp.mockResolvedValue([
      { quoteNumber: '240826-001' },
      { quoteNumber: '240826-003' },
      { quoteNumber: '240826-DRAFT' },
    ]);

    await expect(generateQuoteNumber(new Date(2026, 7, 24, 15, 45))).resolves.toBe('240826-004');
  });

  it('preserves a quote number when the saved quote is edited', async () => {
    await expect(
      resolveQuoteNumber({
        providedQuoteNumber: 'STD-20231015-0001',
        existingQuoteNumber: 'STD-20231015-0001',
      }),
    ).resolves.toBe('STD-20231015-0001');
    expect(listQuoteNumbersForDateStamp).not.toHaveBeenCalled();
  });
});
