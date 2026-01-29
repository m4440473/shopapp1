import type { TimeEntry } from '@prisma/client';

export type { TimeEntry };

export type TimeEntryStartInput = {
  orderId: string;
  partId?: string | null;
  operation: string;
};

export type TimeEntryResumeInput = {
  entryId: string;
};
