-- CreateTable
CREATE TABLE "PartTimeAdjustment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "userId" TEXT,
    "seconds" INTEGER NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PartTimeAdjustment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PartTimeAdjustment_partId_fkey" FOREIGN KEY ("partId") REFERENCES "OrderPart" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PartTimeAdjustment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OrderPart_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OrderPart_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OrderPart_currentDepartmentId_fkey" FOREIGN KEY ("currentDepartmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_OrderPart" ("createdAt", "currentDepartmentId", "cutLength", "id", "materialId", "notes", "orderId", "partNumber", "quantity", "status", "stockSize", "updatedAt") SELECT "createdAt", "currentDepartmentId", "cutLength", "id", "materialId", "notes", "orderId", "partNumber", "quantity", "status", "stockSize", "updatedAt" FROM "OrderPart";
DROP TABLE "OrderPart";
ALTER TABLE "new_OrderPart" RENAME TO "OrderPart";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "PartTimeAdjustment_orderId_idx" ON "PartTimeAdjustment"("orderId");

-- CreateIndex
CREATE INDEX "PartTimeAdjustment_partId_idx" ON "PartTimeAdjustment"("partId");

-- CreateIndex
CREATE INDEX "PartTimeAdjustment_userId_idx" ON "PartTimeAdjustment"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");

