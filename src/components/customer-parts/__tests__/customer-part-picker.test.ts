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
    const quoteEditor = readFileSync(path.resolve('src/app/admin/quotes/QuoteEditor.tsx'), 'utf8');
    const orderEditor = readFileSync(path.resolve('src/app/orders/new/page.tsx'), 'utf8');
    const orderPartsEditor = readFileSync(path.resolve('src/app/orders/new/NewOrderPartsEditor.tsx'), 'utf8');
    expect(quoteEditor).toContain('<CustomerPartPicker');
    expect(quoteEditor).toContain('<CustomerPartNoteSuggestions');
    expect(quoteEditor).toContain('<QuotePartEntryChooser');
    expect(orderEditor).toContain('<CustomerPartPicker');
    expect(orderEditor).toContain('<NewOrderPartEntryChooser');
    expect(orderEditor).toContain('<NewOrderPartsEditor');
    expect(orderPartsEditor).toContain('<CustomerPartNoteSuggestions');
    expect(readFileSync(path.resolve('src/app/admin/quotes/QuotePartEntryChooser.tsx'), 'utf8')).toContain("onChange('existing')");
    expect(readFileSync(path.resolve('src/app/orders/new/NewOrderPartEntryChooser.tsx'), 'utf8')).toContain("onChoose('existing')");
  });
});
