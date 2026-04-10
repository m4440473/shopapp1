import { z } from 'zod';

export const RepeatOrderTemplateListQuery = z.object({
  customerId: z.string().trim().optional(),
  take: z.coerce.number().int().min(1).max(100).default(50),
});

export const RepeatOrderTemplateCreateFromOrder = z.object({
  name: z.string().trim().min(1).max(200).optional(),
});

export const RepeatOrderTemplateCreateOrder = z.object({
  orderNumber: z.string().trim().optional(),
  dueDate: z.string().trim().optional(),
  priority: z.enum(['LOW', 'NORMAL', 'RUSH', 'HOT']).optional(),
  vendorId: z.string().trim().optional(),
  poNumber: z.string().trim().optional(),
  assignedMachinistId: z.string().trim().optional(),
  materialNeeded: z.boolean().optional(),
  materialOrdered: z.boolean().optional(),
  modelIncluded: z.boolean().optional(),
  notes: z.string().trim().max(2000).optional(),
  parts: z.array(
    z.object({
      templatePartId: z.string().trim().min(1),
      partNumber: z.string().trim().min(1).optional(),
      quantity: z.coerce.number().int().min(1).optional(),
      materialId: z.string().trim().nullable().optional(),
      stockSize: z.string().trim().max(200).nullable().optional(),
      cutLength: z.string().trim().max(200).nullable().optional(),
      notes: z.string().trim().max(2000).nullable().optional(),
      workInstructions: z.string().trim().max(4000).nullable().optional(),
    })
  ).optional(),
});

export type RepeatOrderTemplateListQueryInput = z.infer<typeof RepeatOrderTemplateListQuery>;
export type RepeatOrderTemplateCreateFromOrderInput = z.infer<typeof RepeatOrderTemplateCreateFromOrder>;
export type RepeatOrderTemplateCreateOrderInput = z.infer<typeof RepeatOrderTemplateCreateOrder>;
