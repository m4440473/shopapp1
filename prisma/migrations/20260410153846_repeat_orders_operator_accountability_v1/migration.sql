-- CreateTable
CREATE TABLE "OrderPartAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedById" TEXT,
    "assignmentType" TEXT NOT NULL DEFAULT 'WORKER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "removedAt" DATETIME,
    CONSTRAINT "OrderPartAssignment_partId_fkey" FOREIGN KEY ("partId") REFERENCES "OrderPart" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrderPartAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrderPartAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PartInstructionReceipt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "instructionsVersion" INTEGER NOT NULL,
    "acknowledgedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PartInstructionReceipt_partId_fkey" FOREIGN KEY ("partId") REFERENCES "OrderPart" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PartInstructionReceipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PartInstructionReceipt_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RepeatOrderTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "sourceOrderId" TEXT,
    "name" TEXT NOT NULL,
    "business" TEXT NOT NULL DEFAULT 'STD',
    "vendorId" TEXT,
    "materialNeeded" BOOLEAN NOT NULL DEFAULT false,
    "materialOrdered" BOOLEAN NOT NULL DEFAULT false,
    "modelIncluded" BOOLEAN NOT NULL DEFAULT false,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RepeatOrderTemplate_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RepeatOrderTemplate_sourceOrderId_fkey" FOREIGN KEY ("sourceOrderId") REFERENCES "Order" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RepeatOrderTemplate_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RepeatOrderTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RepeatOrderTemplatePart" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "partNumber" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "materialId" TEXT,
    "workInstructions" TEXT,
    "instructionsVersion" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "stockSize" TEXT,
    "cutLength" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RepeatOrderTemplatePart_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "RepeatOrderTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RepeatOrderTemplatePart_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RepeatOrderTemplateCharge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templatePartId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "addonId" TEXT,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DECIMAL NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RepeatOrderTemplateCharge_templatePartId_fkey" FOREIGN KEY ("templatePartId") REFERENCES "RepeatOrderTemplatePart" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RepeatOrderTemplateCharge_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RepeatOrderTemplateCharge_addonId_fkey" FOREIGN KEY ("addonId") REFERENCES "Addon" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RepeatOrderTemplateAttachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "templatePartId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'OTHER',
    "url" TEXT,
    "storagePath" TEXT,
    "label" TEXT,
    "mimeType" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RepeatOrderTemplateAttachment_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "RepeatOrderTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RepeatOrderTemplateAttachment_templatePartId_fkey" FOREIGN KEY ("templatePartId") REFERENCES "RepeatOrderTemplatePart" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
    "performedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OrderChecklist_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrderChecklist_partId_fkey" FOREIGN KEY ("partId") REFERENCES "OrderPart" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OrderChecklist_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "OrderCharge" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OrderChecklist_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OrderChecklist_addonId_fkey" FOREIGN KEY ("addonId") REFERENCES "Addon" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OrderChecklist_toggledById_fkey" FOREIGN KEY ("toggledById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OrderChecklist_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_OrderChecklist" ("addonId", "chargeId", "completed", "createdAt", "departmentId", "id", "isActive", "orderId", "partId", "toggledById", "updatedAt") SELECT "addonId", "chargeId", "completed", "createdAt", "departmentId", "id", "isActive", "orderId", "partId", "toggledById", "updatedAt" FROM "OrderChecklist";
DROP TABLE "OrderChecklist";
ALTER TABLE "new_OrderChecklist" RENAME TO "OrderChecklist";
CREATE UNIQUE INDEX "OrderChecklist_orderId_addonId_partId_key" ON "OrderChecklist"("orderId", "addonId", "partId");
CREATE UNIQUE INDEX "OrderChecklist_orderId_chargeId_key" ON "OrderChecklist"("orderId", "chargeId");
CREATE TABLE "new_OrderPart" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "partNumber" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "materialId" TEXT,
    "currentDepartmentId" TEXT,
    "notes" TEXT,
    "workInstructions" TEXT,
    "instructionsVersion" INTEGER NOT NULL DEFAULT 1,
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
CREATE INDEX "OrderPartAssignment_partId_idx" ON "OrderPartAssignment"("partId");

-- CreateIndex
CREATE INDEX "OrderPartAssignment_userId_idx" ON "OrderPartAssignment"("userId");

-- CreateIndex
CREATE INDEX "OrderPartAssignment_partId_userId_isActive_idx" ON "OrderPartAssignment"("partId", "userId", "isActive");

-- CreateIndex
CREATE INDEX "PartInstructionReceipt_partId_idx" ON "PartInstructionReceipt"("partId");

-- CreateIndex
CREATE INDEX "PartInstructionReceipt_userId_idx" ON "PartInstructionReceipt"("userId");

-- CreateIndex
CREATE INDEX "PartInstructionReceipt_departmentId_idx" ON "PartInstructionReceipt"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "PartInstructionReceipt_partId_userId_departmentId_instructionsVersion_key" ON "PartInstructionReceipt"("partId", "userId", "departmentId", "instructionsVersion");

-- CreateIndex
CREATE INDEX "RepeatOrderTemplate_customerId_idx" ON "RepeatOrderTemplate"("customerId");

-- CreateIndex
CREATE INDEX "RepeatOrderTemplate_sourceOrderId_idx" ON "RepeatOrderTemplate"("sourceOrderId");

-- CreateIndex
CREATE INDEX "RepeatOrderTemplate_createdById_idx" ON "RepeatOrderTemplate"("createdById");

-- CreateIndex
CREATE INDEX "RepeatOrderTemplatePart_templateId_idx" ON "RepeatOrderTemplatePart"("templateId");

-- CreateIndex
CREATE INDEX "RepeatOrderTemplatePart_materialId_idx" ON "RepeatOrderTemplatePart"("materialId");

-- CreateIndex
CREATE INDEX "RepeatOrderTemplateCharge_templatePartId_idx" ON "RepeatOrderTemplateCharge"("templatePartId");

-- CreateIndex
CREATE INDEX "RepeatOrderTemplateCharge_departmentId_idx" ON "RepeatOrderTemplateCharge"("departmentId");

-- CreateIndex
CREATE INDEX "RepeatOrderTemplateAttachment_templateId_idx" ON "RepeatOrderTemplateAttachment"("templateId");

-- CreateIndex
CREATE INDEX "RepeatOrderTemplateAttachment_templatePartId_idx" ON "RepeatOrderTemplateAttachment"("templatePartId");

-- CreateIndex
CREATE INDEX "RepeatOrderTemplateAttachment_storagePath_idx" ON "RepeatOrderTemplateAttachment"("storagePath");
