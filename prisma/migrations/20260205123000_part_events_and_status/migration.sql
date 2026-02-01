-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_OrderPart" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "partNumber" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "materialId" TEXT,
    "currentDepartmentId" TEXT,
    "notes" TEXT,
    "stockSize" TEXT,
    "cutLength" TEXT,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    CONSTRAINT "OrderPart_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OrderPart_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OrderPart_currentDepartmentId_fkey" FOREIGN KEY ("currentDepartmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_OrderPart" ("cutLength", "id", "materialId", "notes", "orderId", "partNumber", "quantity", "stockSize") SELECT "cutLength", "id", "materialId", "notes", "orderId", "partNumber", "quantity", "stockSize" FROM "OrderPart";
DROP TABLE "OrderPart";
ALTER TABLE "new_OrderPart" RENAME TO "OrderPart";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateTable
CREATE TABLE "PartEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "meta" JSON,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PartEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PartEvent_partId_fkey" FOREIGN KEY ("partId") REFERENCES "OrderPart" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PartEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PartEvent_orderId_idx" ON "PartEvent"("orderId");

-- CreateIndex
CREATE INDEX "PartEvent_partId_idx" ON "PartEvent"("partId");

-- CreateIndex
CREATE INDEX "PartEvent_userId_idx" ON "PartEvent"("userId");
