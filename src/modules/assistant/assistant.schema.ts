import { z } from 'zod';

export const chatRequestSchema = z.object({
  conversationId: z.string().uuid().optional(),
  message: z.string().trim().min(1).max(6000),
}).strict();

export const searchSchema = z.object({
  mode: z.enum(['orders', 'procurement', 'quotes', 'customers', 'files']),
  query: z.string().max(200).default(''),
  customer: z.string().max(120).default(''),
  material: z.string().max(100).default(''),
  finish: z.string().max(100).default(''),
  orderNumber: z.string().max(100).default(''),
  partNumber: z.string().max(100).default(''),
  fromYear: z.number().int().min(1900).max(2200).optional(),
  toYear: z.number().int().min(1900).max(2200).optional(),
  overdue: z.boolean().default(false),
  activeOnly: z.boolean().default(false),
  materialStatus: z.enum(['UNREVIEWED', 'NEED_TO_ORDER', 'WAITING_ON_STOCK', 'IN_STOCK', 'NOT_REQUIRED']).optional(),
  conversion: z.enum(['any', 'unconverted', 'never_ordered']).default('any'),
  offset: z.number().int().min(0).max(1000000).default(0),
}).strict();
export type Search = z.infer<typeof searchSchema>;
