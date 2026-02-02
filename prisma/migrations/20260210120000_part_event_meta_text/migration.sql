-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PartEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "meta" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PartEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PartEvent_partId_fkey" FOREIGN KEY ("partId") REFERENCES "OrderPart" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PartEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PartEvent" ("createdAt", "id", "message", "meta", "orderId", "partId", "type", "userId") SELECT "createdAt", "id", "message", "meta", "orderId", "partId", "type", "userId" FROM "PartEvent";
DROP TABLE "PartEvent";
ALTER TABLE "new_PartEvent" RENAME TO "PartEvent";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "PartEvent_orderId_idx" ON "PartEvent"("orderId");

-- CreateIndex
CREATE INDEX "PartEvent_partId_idx" ON "PartEvent"("partId");

-- CreateIndex
CREATE INDEX "PartEvent_userId_idx" ON "PartEvent"("userId");
