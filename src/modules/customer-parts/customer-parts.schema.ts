import { z } from 'zod';

import { BUSINESS_CODES } from '@/lib/businesses';

export const CustomerPartHistoryQuery = z.object({
  business: z.enum(BUSINESS_CODES).optional(),
  q: z.string().trim().max(200).optional(),
  take: z.coerce.number().int().min(1).max(100).default(40),
});

export type CustomerPartHistoryQueryInput = z.infer<typeof CustomerPartHistoryQuery>;
