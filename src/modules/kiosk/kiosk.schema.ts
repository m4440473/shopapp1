import { z } from 'zod';

export const KioskUnlockInput = z.object({
  userId: z.string().trim().min(1).optional(),
  pin: z.string().trim().regex(/^\d{4,8}$/u, 'PIN must be 4 to 8 digits'),
});

export const KioskPartsSearchInput = z.object({
  departmentId: z.string().trim().min(1),
  q: z.string().trim().optional().default(''),
  take: z.coerce.number().int().min(1).max(50).optional().default(30),
});

export const KioskTimerStartInput = z.object({
  orderId: z.string().trim().min(1),
  partId: z.string().trim().min(1),
  departmentId: z.string().trim().min(1),
});

export const KioskTimerSwitchInput = KioskTimerStartInput.extend({
  stopMode: z.enum(['pause', 'finish']),
});
