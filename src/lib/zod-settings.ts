import { z } from 'zod';
import { normalizeHex } from '@/lib/colors';

export const InvoiceTemplateId = z.enum(['classic', 'minimal', 'bold']);

const HexColor = z
  .string()
  .trim()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Use a hex color like #0ea5e9')
  .transform((value) => normalizeHex(value));

export const InvoiceOptions = z
  .object({
    showLogo: z.boolean().optional(),
    showTerms: z.boolean().optional(),
    showPO: z.boolean().optional(),
    showNotes: z.boolean().optional(),
  })
  .optional();

export const AppSettingsUpdate = z.object({
  companyName: z.string().trim().min(1).max(120).optional(),
  logoPath: z.string().trim().min(1).max(500).nullable().optional(),
  themePrimary: HexColor.optional(),
  themeAccent: HexColor.optional(),
  attachmentsDir: z.string().trim().min(1).max(500).optional(),
  requirePOForQuoteApproval: z.boolean().optional(),
  requirePOForQuoteToOrder: z.boolean().optional(),
  invoiceTemplateId: InvoiceTemplateId.optional(),
  invoiceOptions: InvoiceOptions.transform((value) => (value ? JSON.stringify(value) : undefined)),
});

export type AppSettingsUpdateInput = z.infer<typeof AppSettingsUpdate>;
