-- CreateTable
CREATE TABLE "OrderCharge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "partId" TEXT,
    "departmentId" TEXT NOT NULL,
    "addonId" TEXT,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DECIMAL NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OrderCharge_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrderCharge_partId_fkey" FOREIGN KEY ("partId") REFERENCES "OrderPart" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrderCharge_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OrderCharge_addonId_fkey" FOREIGN KEY ("addonId") REFERENCES "Addon" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PartAttachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "url" TEXT,
    "storagePath" TEXT,
    "label" TEXT,
    "mimeType" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PartAttachment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PartAttachment_partId_fkey" FOREIGN KEY ("partId") REFERENCES "OrderPart" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_OrderChecklist" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "partId" TEXT,
    "chargeId" TEXT,
    "departmentId" TEXT,
    "addonId" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "toggledById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OrderChecklist_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrderChecklist_partId_fkey" FOREIGN KEY ("partId") REFERENCES "OrderPart" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OrderChecklist_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "OrderCharge" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OrderChecklist_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OrderChecklist_addonId_fkey" FOREIGN KEY ("addonId") REFERENCES "Addon" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OrderChecklist_toggledById_fkey" FOREIGN KEY ("toggledById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_OrderChecklist" ("addonId", "completed", "createdAt", "departmentId", "id", "orderId", "toggledById", "updatedAt")
SELECT "OrderChecklist"."addonId",
       "OrderChecklist"."completed",
       "OrderChecklist"."createdAt",
       "Addon"."departmentId",
       "OrderChecklist"."id",
       "OrderChecklist"."orderId",
       "OrderChecklist"."toggledById",
       "OrderChecklist"."updatedAt"
FROM "OrderChecklist"
LEFT JOIN "Addon" ON "Addon"."id" = "OrderChecklist"."addonId";
DROP TABLE "OrderChecklist";
ALTER TABLE "new_OrderChecklist" RENAME TO "OrderChecklist";
CREATE UNIQUE INDEX "OrderChecklist_orderId_addonId_partId_key" ON "OrderChecklist"("orderId", "addonId", "partId");
CREATE UNIQUE INDEX "OrderChecklist_orderId_chargeId_key" ON "OrderChecklist"("orderId", "chargeId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "OrderCharge_orderId_idx" ON "OrderCharge"("orderId");

-- CreateIndex
CREATE INDEX "OrderCharge_partId_idx" ON "OrderCharge"("partId");

-- CreateIndex
CREATE INDEX "OrderCharge_departmentId_idx" ON "OrderCharge"("departmentId");

-- CreateIndex
CREATE INDEX "PartAttachment_orderId_idx" ON "PartAttachment"("orderId");

-- CreateIndex
CREATE INDEX "PartAttachment_partId_idx" ON "PartAttachment"("partId");

-- CreateIndex
CREATE INDEX "PartAttachment_storagePath_idx" ON "PartAttachment"("storagePath");
