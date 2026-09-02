import { describe, expect, it } from 'vitest';

import { getDocumentHeaderPreset, normalizeDocumentHeaderOptions } from '@/lib/document-header';

describe('document header options', () => {
  it('provides known letterhead details for Sterling and C&R', () => {
    expect(getDocumentHeaderPreset('STD')).toMatchObject({
      businessName: 'Sterling Tool & Die, Inc.',
      addressLine1: '100 Tococo Ct',
      addressLine2: 'Wilmore, KY 40390',
      phone: '859-858-9327',
    });
    expect(getDocumentHeaderPreset('CRM')).toMatchObject({
      businessName: 'C&R Machine & Fabrication, LLC',
      addressLine1: '744 Richmond Avenue',
      addressLine2: 'Nicholasville, KY 40356',
      phone: '859-887-4311',
    });
  });

  it('uses the shared email for all three businesses', () => {
    for (const code of ['STD', 'CRM', 'PC']) {
      expect(getDocumentHeaderPreset(code).email).toBe('acct.mgr@crmachinefab.com');
    }
  });

  it('preserves intentionally blank fields while filling omitted fields from the business preset', () => {
    expect(normalizeDocumentHeaderOptions({ phone: '', businessName: 'Custom Letterhead' }, 'STD')).toEqual({
      businessName: 'Custom Letterhead',
      addressLine1: '100 Tococo Ct',
      addressLine2: 'Wilmore, KY 40390',
      phone: '',
      email: 'acct.mgr@crmachinefab.com',
    });
  });
});
