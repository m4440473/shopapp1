-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TimeEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "partId" TEXT,
    "departmentId" TEXT,
    "userId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TimeEntry_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TimeEntry_partId_fkey" FOREIGN KEY ("partId") REFERENCES "OrderPart" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TimeEntry_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TimeEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_TimeEntry" ("createdAt", "endedAt", "id", "operation", "orderId", "partId", "startedAt", "updatedAt", "userId") SELECT "createdAt", "endedAt", "id", "operation", "orderId", "partId", "startedAt", "updatedAt", "userId" FROM "TimeEntry";
DROP TABLE "TimeEntry";
ALTER TABLE "new_TimeEntry" RENAME TO "TimeEntry";
CREATE INDEX "TimeEntry_userId_endedAt_idx" ON "TimeEntry"("userId", "endedAt");
CREATE INDEX "TimeEntry_userId_departmentId_endedAt_idx" ON "TimeEntry"("userId", "departmentId", "endedAt");
CREATE INDEX "TimeEntry_orderId_idx" ON "TimeEntry"("orderId");
CREATE INDEX "TimeEntry_partId_idx" ON "TimeEntry"("partId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

