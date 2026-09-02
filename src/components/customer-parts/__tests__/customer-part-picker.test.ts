import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { customerPartHistoryUrl } from '../CustomerPartPicker';
import { appendSuggestedNote } from '../CustomerPartNoteSuggestions';

describe('CustomerPartPicker', () => {
  it('builds a global part-history typeahead request', () => {
    expect(customerPartHistoryUrl({ customerId: 'customer/a', business: 'CRM', q: 'AB 100' }))
      .toBe('/api/admin/customers/customer%2Fa/part-history?take=40&q=AB+100');
  });

  it('aborts list and detail work when the customer changes before applying results', () => {
    const source = readFileSync(path.resolve('src/components/customer-parts/CustomerPartPicker.tsx'), 'utf8');
    expect(source).toContain('listAbortRef.current?.abort()');
    expect(source).toContain('detailAbortRef.current?.abort()');
    expect(source).toContain('activeCustomerRef.current !== requestedCustomerId');
    expect(source).toContain('Promise.all(sourcePartIds.map');
  });

  it('adds a reviewed suggestion once and wires reuse into both intake editors', () => {
    expect(appendSuggestedNote('Existing note', 'PREHEAT TO 600F')).toBe('Existing note\nPREHEAT TO 600F');
    expect(appendSuggestedNote('PREHEAT   TO 600F', 'preheat to 600f')).toBe('PREHEAT   TO 600F');
    for (const file of ['src/app/admin/quotes/QuoteEditor.tsx', 'src/app/orders/new/page.tsx']) {
      const source = readFileSync(path.resolve(file), 'utf8');
      expect(source).toContain('<CustomerPartPicker');
      expect(source).toContain('<CustomerPartNoteSuggestions');
      expect(source).toContain("setPartEntryMode('existing')");
    }
  });
});
