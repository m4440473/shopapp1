import { z } from 'zod';

export const ProcurementGroupFiltersSchema = z.object({
  overdue: z.boolean().optional(),
  customerId: z.string().trim().min(1).optional(),
  customer: z.string().trim().min(1).max(100).optional(),
  material: z.string().trim().min(1).max(100).optional(),
  vendorId: z.string().trim().min(1).optional(),
  vendor: z.string().trim().min(1).max(100).optional(),
}).strict();

export type ProcurementGroupFiltersInput = z.infer<typeof ProcurementGroupFiltersSchema>;
