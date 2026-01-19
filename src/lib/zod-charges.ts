import { z } from 'zod';

export const CHARGE_KINDS = ['LABOR', 'ADDON', 'MATERIAL', 'FEE', 'SHIPPING', 'DISCOUNT'] as const;
export const ChargeKind = z.enum(CHARGE_KINDS);

export const PartAttachmentKinds = ['DWG', 'STEP', 'PDF', 'PO', 'IMAGE', 'OTHER'] as const;
export const PartAttachmentKind = z.enum(PartAttachmentKinds);

export const OrderChargeCreate = z.object({
  partId: z.string().trim().min(1).optional().nullable(),
  departmentId: z.string().trim().min(1),
  addonId: z.string().trim().min(1).optional().nullable(),
  kind: ChargeKind,
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  quantity: z.coerce.number().min(0).default(1),
  unitPrice: z.coerce.number().min(0).default(0),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

export const OrderChargeUpdate = z
  .object({
    partId: z.string().trim().min(1).optional().nullable(),
    departmentId: z.string().trim().min(1).optional(),
    addonId: z.string().trim().min(1).optional().nullable(),
    kind: ChargeKind.optional(),
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(2000).optional().nullable(),
    quantity: z.coerce.number().min(0).optional(),
    unitPrice: z.coerce.number().min(0).optional(),
    sortOrder: z.coerce.number().int().min(0).optional(),
    completed: z.boolean().optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: 'Provide at least one field to update.',
  });

export const PartAttachmentCreate = z
  .object({
    kind: PartAttachmentKind,
    url: z.string().trim().min(1).max(1000).optional(),
    storagePath: z.string().trim().min(1).max(500).optional(),
    label: z.string().trim().max(200).optional(),
    mimeType: z.string().trim().max(200).optional(),
  })
  .refine((value) => Boolean(value.url?.length || value.storagePath?.length), {
    message: 'Provide an attachment URL or uploaded file path',
    path: ['url'],
  });

export type OrderChargeCreateInput = z.infer<typeof OrderChargeCreate>;
export type OrderChargeUpdateInput = z.infer<typeof OrderChargeUpdate>;
export type PartAttachmentCreateInput = z.infer<typeof PartAttachmentCreate>;
