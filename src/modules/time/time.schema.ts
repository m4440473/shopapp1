import { z } from 'zod';

export const TimeEntryStart = z.object({
  orderId: z.string().trim().min(1),
  partId: z.string().trim().min(1).nullable().optional(),
  operation: z.string().trim().min(1),
});

export const TimeEntryResume = z.object({
  entryId: z.string().trim().min(1),
});
