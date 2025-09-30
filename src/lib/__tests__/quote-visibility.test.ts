import { describe, expect, it } from 'vitest';

import {
  sanitizeQuoteDetailPricing,
  sanitizeQuoteSummaryPricing,
  type QuoteDetailWithRelations,
  type QuoteSummaryWithRelations,
} from '../quote-visibility';

describe('quote visibility sanitizers', () => {
  const detailBase = {
    id: 'quote-1',
    quoteNumber: 'Q-001',
    business: 'STD',
    companyName: 'Acme Co',
    contactName: null,
    contactEmail: null,
    contactPhone: null,
    customerId: null,
    status: 'DRAFT',
    materialSummary: null,
    purchaseItems: null,
    requirements: null,
    notes: null,
    multiPiece: false,
    basePriceCents: 12500,
    addonsTotalCents: 2500,
    vendorTotalCents: 5000,
    totalCents: 20000,
    metadata: null,
    createdById: 'user-1',
    createdAt: new Date('2023-01-01T00:00:00Z'),
    updatedAt: new Date('2023-01-02T00:00:00Z'),
    createdBy: { id: 'user-1', name: 'Admin', email: 'admin@example.com' },
    customer: { id: 'cust-1', name: 'Acme Customer' },
    parts: [],
    vendorItems: [
      {
        id: 'vendor-1',
        quoteId: 'quote-1',
        vendorId: null,
        vendor: null,
        vendorName: 'Steel Supplier',
        partNumber: 'PN-123',
        partUrl: null,
        basePriceCents: 3200,
        markupPercent: 15,
        finalPriceCents: 3680,
        notes: null,
      },
    ],
    addonSelections: [
      {
        id: 'addon-1',
        quoteId: 'quote-1',
        addonId: 'a-1',
        addon: { id: 'a-1', name: 'Welding', rateType: 'HOURLY', rateCents: 500 },
        units: 4,
        rateTypeSnapshot: 'HOURLY',
        rateCents: 500,
        totalCents: 2000,
        notes: 'High skill',
      },
    ],
    attachments: [],
  } satisfies QuoteDetailWithRelations;

  const summaryBase = {
    id: 'quote-1',
    quoteNumber: 'Q-001',
    business: 'STD',
    companyName: 'Acme Co',
    contactName: null,
    contactEmail: null,
    contactPhone: null,
    customerId: null,
    status: 'DRAFT',
    materialSummary: null,
    purchaseItems: null,
    requirements: null,
    notes: null,
    multiPiece: false,
    basePriceCents: 12500,
    addonsTotalCents: 2500,
    vendorTotalCents: 5000,
    totalCents: 20000,
    metadata: null,
    createdById: 'user-1',
    createdAt: new Date('2023-01-01T00:00:00Z'),
    updatedAt: new Date('2023-01-02T00:00:00Z'),
    createdBy: { id: 'user-1', name: 'Admin', email: 'admin@example.com' },
    customer: { id: 'cust-1', name: 'Acme Customer' },
  } satisfies QuoteSummaryWithRelations;

  it('returns the original detail payload for admins', () => {
    const result = sanitizeQuoteDetailPricing(detailBase, true);
    expect(result).toBe(detailBase);
  });

  it('zeroes sensitive fields on detail payloads for non-admins', () => {
    const result = sanitizeQuoteDetailPricing(detailBase, false);

    expect(result.basePriceCents).toBe(0);
    expect(result.totalCents).toBe(0);
    expect(result.vendorTotalCents).toBe(0);
    expect(result.addonsTotalCents).toBe(0);
    expect(result.vendorItems[0].basePriceCents).toBe(0);
    expect(result.vendorItems[0].finalPriceCents).toBe(0);
    expect(result.addonSelections[0].rateCents).toBe(0);
    expect(result.addonSelections[0].totalCents).toBe(0);
    expect(result.addonSelections[0].addon.rateCents).toBe(0);

    // Ensure the original object is not mutated
    expect(detailBase.vendorItems[0].finalPriceCents).toBe(3680);
    expect(detailBase.addonSelections[0].addon.rateCents).toBe(500);
  });

  it('returns the original summary payload for admins', () => {
    const result = sanitizeQuoteSummaryPricing(summaryBase, true);
    expect(result).toBe(summaryBase);
  });

  it('zeroes totals on summary payloads for non-admins', () => {
    const result = sanitizeQuoteSummaryPricing(summaryBase, false);

    expect(result.basePriceCents).toBe(0);
    expect(result.totalCents).toBe(0);
    expect(result.vendorTotalCents).toBe(0);
    expect(result.addonsTotalCents).toBe(0);
  });
});
