import { z } from 'zod';

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
export const OrderPartCreate = z.object({
  partNumber: z.string().trim().min(1),
  quantity: z.coerce.number().int().min(1),
  materialId: z.string().trim().optional(),
  notes: z.string().trim().max(500).optional(),
});

export const OrderCreate = z.object({
  orderNumber: z.string().trim().optional(),
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
  attachments: z
    .array(
      z.object({
        url: z.string().min(1),
        label: z.string().trim().optional(),
        mimeType: z.string().trim().optional(),
      })
    )
    .default([]),
  notes: z.string().trim().max(1000).optional(),
});

export type OrderCreateInput = z.infer<typeof OrderCreate>;

export const OrderAttachmentCreate = z.object({
  url: z.string().trim().min(1),
  label: z.string().trim().max(200).optional(),
  mimeType: z.string().trim().max(200).optional(),
});

export type OrderAttachmentCreateInput = z.infer<typeof OrderAttachmentCreate>;

export const OrderUpdate = z.object({
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
