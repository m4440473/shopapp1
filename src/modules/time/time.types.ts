export type TimeEntry = {
  id: string;
  orderId: string;
  partId: string | null;
  userId: string;
  operation: string;
  startedAt: Date;
  endedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type TimeEntryStartInput = {
  orderId: string;
  partId?: string | null;
  operation: string;
};

export type TimeEntryResumeInput = {
  entryId: string;
};

export type TimeEntryClosedEditInput = {
  entryId: string;
  startedAt: Date;
  endedAt: Date;
  reason: string;
};
