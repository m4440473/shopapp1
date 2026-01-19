import { z } from 'zod';

const DECIMAL_REGEX = /^\d+(\.\d+)?$/;

const DecimalString = z.string().trim().refine((value) => DECIMAL_REGEX.test(value), {
  message: 'Expected a decimal string',
});

export const CHARGE_KINDS = ['LABOR', 'ADDON', 'MATERIAL', 'FEE', 'SHIPPING', 'DISCOUNT'] as const;
export const ChargeKind = z.enum(CHARGE_KINDS);

export const PART_ATTACHMENT_KINDS = ['DWG', 'STEP', 'PDF', 'PO', 'IMAGE', 'OTHER'] as const;
export const PartAttachmentKind = z.enum(PART_ATTACHMENT_KINDS);

export const OrderChargeCreate = z
  .object({
    partId: z.string().trim().min(1).optional().nullable(),
    departmentId: z.string().trim().min(1),
    addonId: z.string().trim().min(1).optional().nullable(),
    kind: ChargeKind,
    name: z.string().trim().min(1).max(200),
    description: z.string().trim().max(2000).optional(),
    quantity: DecimalString.default('1'),
    unitPrice: DecimalString.default('0'),
    sortOrder: z.coerce.number().int().min(0).default(0),
  })
  .refine((value) => {
    if (value.kind === 'LABOR' || value.kind === 'ADDON') {
      return Boolean(value.partId);
    }
    return true;
  }, {
    message: 'partId is required for labor or addon charges.',
    path: ['partId'],
  });

export const OrderChargeUpdate = z
  .object({
    partId: z.string().trim().min(1).optional().nullable(),
    departmentId: z.string().trim().min(1).optional(),
    addonId: z.string().trim().min(1).optional().nullable(),
    kind: ChargeKind.optional(),
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(2000).optional().nullable(),
    quantity: DecimalString.optional(),
    unitPrice: DecimalString.optional(),
    sortOrder: z.coerce.number().int().min(0).optional(),
    completed: z.boolean().optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: 'Provide at least one field to update.',
  })
  .refine((value) => {
    if (value.kind === 'LABOR' || value.kind === 'ADDON') {
      return value.partId !== null;
    }
    return true;
  }, {
    message: 'partId is required for labor or addon charges.',
    path: ['partId'],
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

export const PartAttachmentUpdate = z
  .object({
    kind: PartAttachmentKind.optional(),
    url: z.string().trim().min(1).max(1000).optional().nullable(),
    storagePath: z.string().trim().min(1).max(500).optional().nullable(),
    label: z.string().trim().max(200).optional().nullable(),
    mimeType: z.string().trim().max(200).optional().nullable(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: 'Provide at least one field to update.',
  })
  .refine((value) => {
    if (value.url === undefined && value.storagePath === undefined) {
      return true;
    }
    return Boolean(value.url?.length || value.storagePath?.length);
  }, {
    message: 'Provide an attachment URL or uploaded file path',
    path: ['url'],
  });

export type OrderChargeCreateInput = z.infer<typeof OrderChargeCreate>;
export type OrderChargeUpdateInput = z.infer<typeof OrderChargeUpdate>;
export type PartAttachmentCreateInput = z.infer<typeof PartAttachmentCreate>;
export type PartAttachmentUpdateInput = z.infer<typeof PartAttachmentUpdate>;
