import { z } from 'zod';

import { BUSINESS_CODES } from '@/lib/businesses';

export const QuotePartInput = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  quantity: z.coerce.number().int().min(1).default(1),
  pieceCount: z.coerce.number().int().min(1).default(1),
  notes: z.string().trim().max(2000).optional(),
});

export const QuoteVendorItemInput = z.object({
  vendorId: z.string().trim().max(100).optional(),
  vendorName: z.string().trim().max(200).optional(),
  partNumber: z.string().trim().max(200).optional(),
  partUrl: z.string().trim().max(500).optional(),
  basePriceCents: z.coerce.number().int().min(0).default(0),
  markupPercent: z.coerce.number().min(0).max(1000).default(0),
  finalPriceCents: z.coerce.number().int().min(0).default(0),
  notes: z.string().trim().max(2000).optional(),
});

export const QuoteAddonSelectionInput = z.object({
  addonId: z.string().trim().min(1),
  units: z.coerce.number().min(0).default(0),
  notes: z.string().trim().max(2000).optional(),
});

export const QuoteAttachmentInput = z
  .object({
    url: z.string().trim().min(1).max(500).optional(),
    storagePath: z.string().trim().min(1).max(500).optional(),
    label: z.string().trim().max(200).optional(),
    mimeType: z.string().trim().max(200).optional(),
  })
  .refine((value) => Boolean(value.url?.length || value.storagePath?.length), {
    message: 'Attachment requires a URL or uploaded file',
    path: ['url'],
  });

export const QuoteCreate = z.object({
  business: z.enum(BUSINESS_CODES),
  quoteNumber: z.string().trim().max(50).optional(),
  companyName: z.string().trim().min(1).max(200),
  contactName: z.string().trim().max(200).optional(),
  contactEmail: z.string().trim().email().max(200).optional(),
  contactPhone: z.string().trim().max(50).optional(),
  customerId: z.string().trim().optional(),
  status: z.string().trim().max(40).default('DRAFT'),
  materialSummary: z.string().trim().max(4000).optional(),
  purchaseItems: z.string().trim().max(4000).optional(),
  requirements: z.string().trim().max(4000).optional(),
  notes: z.string().trim().max(4000).optional(),
  multiPiece: z.boolean().optional(),
  basePriceCents: z.coerce.number().int().min(0).default(0),
  parts: z.array(QuotePartInput).default([]),
  vendorItems: z.array(QuoteVendorItemInput).default([]),
  addonSelections: z.array(QuoteAddonSelectionInput).default([]),
  attachments: z.array(QuoteAttachmentInput).default([]),
});

export const QuoteUpdate = QuoteCreate;

export type QuoteCreateInput = z.infer<typeof QuoteCreate>;
export type QuoteUpdateInput = z.infer<typeof QuoteUpdate>;
export type QuotePartInputType = z.infer<typeof QuotePartInput>;
export type QuoteVendorItemInputType = z.infer<typeof QuoteVendorItemInput>;
export type QuoteAddonSelectionInputType = z.infer<typeof QuoteAddonSelectionInput>;
export type QuoteAttachmentInputType = z.infer<typeof QuoteAttachmentInput>;
