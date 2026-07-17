-- Preserve one active timer total per employee across every department.
CREATE UNIQUE INDEX "TimeEntry_one_open_per_user"
ON "TimeEntry"("userId")
WHERE "endedAt" IS NULL;

-- Record who operated the trusted console separately from whose labor is timed.
CREATE TABLE "TimeEntryAction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timeEntryId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TimeEntryAction_timeEntryId_fkey"
      FOREIGN KEY ("timeEntryId") REFERENCES "TimeEntry" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TimeEntryAction_actorUserId_fkey"
      FOREIGN KEY ("actorUserId") REFERENCES "User" ("id")
      ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "TimeEntryAction_timeEntryId_createdAt_idx"
ON "TimeEntryAction"("timeEntryId", "createdAt");

CREATE INDEX "TimeEntryAction_actorUserId_idx"
ON "TimeEntryAction"("actorUserId");
