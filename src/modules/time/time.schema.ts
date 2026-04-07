import { z } from 'zod';

export const TimeEntryStart = z.object({
  orderId: z.string().trim().min(1),
  partId: z.string().trim().min(1).nullable().optional(),
  departmentId: z.string().trim().min(1),
  operation: z.string().trim().min(1).optional().default('Part Work'),
});

export const TimeEntryResume = z.object({
  entryId: z.string().trim().min(1),
});

export const TimeEntryStop = z.object({
  entryId: z.string().trim().min(1),
});


export const TimeEntryClosedEdit = z.object({
  entryId: z.string().trim().min(1),
  startedAt: z.coerce.date(),
  endedAt: z.coerce.date(),
  reason: z.string().trim().min(5),
}).refine((value) => value.endedAt.getTime() > value.startedAt.getTime(), {
  message: 'endedAt must be later than startedAt',
  path: ['endedAt'],
});
