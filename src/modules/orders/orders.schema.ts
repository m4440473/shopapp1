import { z } from 'zod';

import { BUSINESS_CODES } from '@/lib/businesses';

/** Enums mirrored from Prisma */
export const StatusEnum = z.enum([
  'RECEIVED',
  'PROGRAMMING',
  'SETUP',
  'RUNNING',
  'FINISHING',
  'DONE_MACHINING',
  'INSPECTION',
  'SHIPPING',
  'CLOSED',
]);

export const PriorityEnum = z.enum(['LOW','NORMAL','RUSH','HOT']);

/** Query params for GET /api/orders */
export const OrderQuery = z.object({
  q: z.string().trim().optional(),
  status: StatusEnum.optional(),
  priority: PriorityEnum.optional(),
  assignedMachinistId: z.string().trim().optional(),
  customerId: z.string().trim().optional(),
  overdue: z.coerce.boolean().optional(),
  awaitingMaterial: z.coerce.boolean().optional(),
  take: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().trim().optional(),
});

export type OrderQueryInput = z.infer<typeof OrderQuery>;

/** POST body for creating an order */
const OrderPartAddonSelection = z.object({
  addonId: z.string().trim().min(1),
  units: z.coerce.number().min(0).default(1),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const OrderPartCreate = z.object({
  partNumber: z.string().trim().min(1),
  quantity: z.coerce.number().int().min(1),
  materialId: z.string().trim().optional(),
  stockSize: z.string().trim().max(200).optional(),
  cutLength: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(500).optional(),
  addonSelections: z.array(OrderPartAddonSelection).optional().default([]),
});

export const OrderPartUpdate = z
  .object({
    partNumber: z.string().trim().min(1).optional(),
    quantity: z.coerce.number().int().min(1).optional(),
    materialId: z.string().trim().nullable().optional(),
    stockSize: z.string().trim().max(200).nullable().optional(),
    cutLength: z.string().trim().max(200).nullable().optional(),
    notes: z.string().trim().max(500).nullable().optional(),
  })
  .refine((value) => Object.values(value).some((v) => v !== undefined), {
    message: 'At least one field is required to update a part',
  });

const OrderAttachmentMetadata = z
  .object({
    url: z.string().trim().min(1).max(1000).optional(),
    storagePath: z.string().trim().min(1).max(500).optional(),
    label: z.string().trim().max(200).optional(),
    mimeType: z.string().trim().max(200).optional(),
  })
  .refine((value) => Boolean(value.url?.length || value.storagePath?.length), {
    message: 'Provide an attachment URL or uploaded file path',
    path: ['url'],
  });

export const OrderCreate = z.object({
  orderNumber: z.string().trim().optional(),
  business: z.enum(BUSINESS_CODES),
  customerId: z.string().trim().min(1),
  modelIncluded: z.boolean().default(false),
  receivedDate: z.string().min(1),
  dueDate: z.string().min(1),
  priority: PriorityEnum.default('NORMAL'),
  materialNeeded: z.boolean().default(false),
  materialOrdered: z.boolean().default(false),
  vendorId: z.string().trim().optional(),
  poNumber: z.string().trim().optional(),
  assignedMachinistId: z.string().trim().optional(),
  parts: z.array(OrderPartCreate).min(1),
  addonIds: z.array(z.string().trim()).default([]),
  attachments: z.array(OrderAttachmentMetadata).default([]),
  notes: z.string().trim().max(1000).optional(),
  customFieldValues: z
    .array(
      z.object({
        fieldId: z.string().trim().min(1),
        value: z.unknown().optional(),
      })
    )
    .optional(),
});

export type OrderCreateInput = z.infer<typeof OrderCreate>;

export const OrderAttachmentCreate = OrderAttachmentMetadata;

export type OrderAttachmentCreateInput = z.infer<typeof OrderAttachmentCreate>;

export const OrderUpdate = z.object({
  business: z.enum(BUSINESS_CODES).optional(),
  customerId: z.string().trim().min(1).optional(),
  receivedDate: z.string().trim().min(1).optional(),
  dueDate: z.string().trim().min(1).optional(),
  priority: PriorityEnum.optional(),
  vendorId: z.string().trim().optional(),
  poNumber: z.string().trim().optional(),
  materialNeeded: z.boolean().optional(),
  materialOrdered: z.boolean().optional(),
  modelIncluded: z.boolean().optional(),
  assignedMachinistId: z.string().trim().optional(),
});

export type OrderUpdateInput = z.infer<typeof OrderUpdate>;

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
