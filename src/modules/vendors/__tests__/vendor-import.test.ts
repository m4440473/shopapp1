import { describe, expect, it } from 'vitest';
import { detectHeaderRow } from '@/modules/vendors/vendor-import';

describe('vendor-import helpers', () => {
  it('detects a header row with company/phone/contact fields', () => {
    const rows = [
      ['Steel Suppliers', '', ''],
      ['Company', 'Phone', 'Contact'],
      ['Southern Tool Steel', '800-647-5188', 'Heather Rankhorn'],
    ];

    expect(detectHeaderRow(rows)).toBe(2);
  });
});
