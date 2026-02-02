import { describe, expect, it } from 'vitest';

import {
  sanitizePricingForNonAdmin,
  type OrderWithRelations,
  type QuoteDetailWithRelations,
  type QuoteSummaryWithRelations,
} from '../quote-visibility';

describe('pricing visibility sanitization', () => {
  const detailBase: QuoteDetailWithRelations = {
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
    parts: [
      {
        id: 'part-1',
        quoteId: 'quote-1',
        name: 'Bracket',
        description: null,
        quantity: 2,
        pieceCount: 1,
        notes: null,
        partNumber: 'BR-1',
        materialId: null,
        material: null,
        stockSize: null,
        cutLength: null,
        addonSelections: [
          {
            id: 'addon-2',
            quoteId: 'quote-1',
            quotePartId: 'part-1',
            addonId: 'a-2',
            addon: { id: 'a-2', name: 'Deburr', rateType: 'FLAT', rateCents: 250 },
            units: 1,
            rateTypeSnapshot: 'FLAT',
            rateCents: 250,
            totalCents: 250,
            notes: null,
          },
        ],
      },
    ],
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
  };

  const summaryBase: QuoteSummaryWithRelations = {
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
  };

  const orderBase: OrderWithRelations = {
    id: 'order-1',
    orderNumber: 'STD-1001',
    business: 'STD',
    customerId: 'cust-1',
    customer: { id: 'cust-1', name: 'Acme Customer', contact: null, phone: null, email: null, address: null },
    status: 'RECEIVED',
    priority: 'NORMAL',
    dueDate: new Date('2023-01-10T00:00:00Z'),
    receivedDate: new Date('2023-01-01T00:00:00Z'),
    modelIncluded: false,
    materialNeeded: false,
    materialOrdered: false,
    vendorId: null,
    vendor: null,
    poNumber: null,
    assignedMachinistId: null,
    assignedMachinist: null,
    parts: [
      {
        id: 'part-1',
        orderId: 'order-1',
        partNumber: 'BR-1',
        quantity: 1,
        attachments: [
          {
            id: 'part-attach-1',
            kind: 'PO',
            label: 'PO document',
            url: 'https://example.com/po.pdf',
            storagePath: null,
          },
          {
            id: 'part-attach-2',
            kind: 'PDF',
            label: 'Machining drawing',
            url: 'https://example.com/drawing.pdf',
            storagePath: null,
          },
        ],
        charges: [],
      },
    ],
    checklist: [
      {
        id: 'check-1',
        orderId: 'order-1',
        addonId: 'addon-1',
        addon: {
          id: 'addon-1',
          name: 'Weld',
          description: null,
          rateType: 'HOURLY',
          rateCents: 700,
          active: true,
          createdAt: new Date('2023-01-01T00:00:00Z'),
          updatedAt: new Date('2023-01-02T00:00:00Z'),
        },
        completed: false,
        toggledById: null,
        toggledBy: null,
        createdAt: new Date('2023-01-02T00:00:00Z'),
        updatedAt: new Date('2023-01-02T00:00:00Z'),
      },
    ],
    statusHistory: [],
    notes: [],
    attachments: [
      {
        id: 'order-attach-1',
        label: 'Invoice 2024-01',
        url: 'https://example.com/invoice.pdf',
        storagePath: null,
      },
      {
        id: 'order-attach-2',
        label: 'Spec sheet',
        url: 'https://example.com/specs.pdf',
        storagePath: null,
      },
    ],
    partAttachments: [
      {
        id: 'order-part-attach-1',
        kind: 'PO',
        label: 'PO summary',
        url: 'https://example.com/po.pdf',
        storagePath: null,
      },
      {
        id: 'order-part-attach-2',
        kind: 'PDF',
        label: 'Setup notes',
        url: 'https://example.com/setup.pdf',
        storagePath: null,
      },
    ],
  };

  it('returns the original payload for admins', () => {
    expect(sanitizePricingForNonAdmin(detailBase, true)).toBe(detailBase);
    expect(sanitizePricingForNonAdmin(summaryBase, true)).toBe(summaryBase);
  });

  it('removes sensitive fields on detail payloads for non-admins', () => {
    const result = sanitizePricingForNonAdmin(detailBase, false);

    expect('basePriceCents' in result).toBe(false);
    expect('totalCents' in result).toBe(false);
    expect('vendorTotalCents' in result).toBe(false);
    expect('addonsTotalCents' in result).toBe(false);
    expect('basePriceCents' in result.vendorItems[0]).toBe(false);
    expect('finalPriceCents' in result.vendorItems[0]).toBe(false);
    expect((result.addonSelections[0] as any).rateCents).toBeUndefined();
    expect((result.addonSelections[0] as any).totalCents).toBeUndefined();
    expect((result.addonSelections[0].addon as any).rateCents).toBeUndefined();
    expect((result.parts[0].addonSelections[0] as any).rateCents).toBeUndefined();
    expect((result.parts[0].addonSelections[0] as any).totalCents).toBeUndefined();
    expect((result.parts[0].addonSelections[0].addon as any).rateCents).toBeUndefined();

    expect(detailBase.vendorItems[0].finalPriceCents).toBe(3680);
    expect(detailBase.addonSelections[0].addon?.rateCents).toBe(500);
    expect(detailBase.parts[0].addonSelections[0].addon?.rateCents).toBe(250);
  });

  it('removes totals on summary payloads for non-admins', () => {
    const result = sanitizePricingForNonAdmin(summaryBase, false);

    expect('basePriceCents' in result).toBe(false);
    expect('totalCents' in result).toBe(false);
    expect('vendorTotalCents' in result).toBe(false);
    expect('addonsTotalCents' in result).toBe(false);
  });

  it('strips addon pricing from orders for non-admins', () => {
    const result = sanitizePricingForNonAdmin(orderBase, false);

    expect(result.checklist[0].addon?.rateCents).toBeUndefined();
    expect(orderBase.checklist[0].addon?.rateCents).toBe(700);
  });

  it('removes restricted attachments for non-admins', () => {
    const result = sanitizePricingForNonAdmin(orderBase, false);

    expect(result.attachments).toHaveLength(1);
    expect(result.attachments[0].label).toBe('Spec sheet');
    expect(result.parts[0].attachments).toHaveLength(1);
    expect(result.parts[0].attachments[0].label).toBe('Machining drawing');
    expect(result.partAttachments).toHaveLength(1);
    expect(result.partAttachments[0].label).toBe('Setup notes');
  });
});
