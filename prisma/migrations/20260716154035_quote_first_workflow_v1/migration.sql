-- CreateTable
CREATE TABLE "QuotePartAttachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quoteId" TEXT NOT NULL,
    "quotePartId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'DWG',
    "url" TEXT,
    "storagePath" TEXT,
    "label" TEXT,
    "mimeType" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuotePartAttachment_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuotePartAttachment_quotePartId_fkey" FOREIGN KEY ("quotePartId") REFERENCES "QuotePart" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_OrderPart" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "partNumber" TEXT NOT NULL,
    "partName" TEXT,
    "quantity" INTEGER NOT NULL,
    "materialId" TEXT,
    "drawingMaterialText" TEXT,
    "drawingFinishText" TEXT,
    "finish" TEXT,
    "materialStatus" TEXT NOT NULL DEFAULT 'UNREVIEWED',
    "inventoryLocation" TEXT,
    "materialNotes" TEXT,
    "procurementVendorId" TEXT,
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
    CONSTRAINT "OrderPart_procurementVendorId_fkey" FOREIGN KEY ("procurementVendorId") REFERENCES "Vendor" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OrderPart_currentDepartmentId_fkey" FOREIGN KEY ("currentDepartmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_OrderPart" ("createdAt", "currentDepartmentId", "cutLength", "id", "instructionsVersion", "materialId", "notes", "orderId", "partName", "partNumber", "quantity", "status", "stockSize", "updatedAt", "workInstructions") SELECT "createdAt", "currentDepartmentId", "cutLength", "id", "instructionsVersion", "materialId", "notes", "orderId", "partName", "partNumber", "quantity", "status", "stockSize", "updatedAt", "workInstructions" FROM "OrderPart";
DROP TABLE "OrderPart";
ALTER TABLE "new_OrderPart" RENAME TO "OrderPart";
CREATE TABLE "new_Quote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quoteNumber" TEXT NOT NULL,
    "business" TEXT NOT NULL DEFAULT 'STD',
    "companyName" TEXT NOT NULL,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "customerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "materialSummary" TEXT,
    "purchaseItems" TEXT,
    "requirements" TEXT,
    "notes" TEXT,
    "multiPiece" BOOLEAN NOT NULL DEFAULT false,
    "basePriceCents" INTEGER NOT NULL DEFAULT 0,
    "addonsTotalCents" INTEGER NOT NULL DEFAULT 0,
    "vendorTotalCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL DEFAULT 0,
    "workflowStep" INTEGER NOT NULL DEFAULT 0,
    "metadata" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Quote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Quote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Quote" ("addonsTotalCents", "basePriceCents", "business", "companyName", "contactEmail", "contactName", "contactPhone", "createdAt", "createdById", "customerId", "id", "materialSummary", "metadata", "multiPiece", "notes", "purchaseItems", "quoteNumber", "requirements", "status", "totalCents", "updatedAt", "vendorTotalCents") SELECT "addonsTotalCents", "basePriceCents", "business", "companyName", "contactEmail", "contactName", "contactPhone", "createdAt", "createdById", "customerId", "id", "materialSummary", "metadata", "multiPiece", "notes", "purchaseItems", "quoteNumber", "requirements", "status", "totalCents", "updatedAt", "vendorTotalCents" FROM "Quote";
DROP TABLE "Quote";
ALTER TABLE "new_Quote" RENAME TO "Quote";
CREATE INDEX "Quote_status_idx" ON "Quote"("status");
CREATE INDEX "Quote_companyName_idx" ON "Quote"("companyName");
CREATE UNIQUE INDEX "Quote_quoteNumber_key" ON "Quote"("quoteNumber");
CREATE TABLE "new_QuotePart" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quoteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "pieceCount" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "partNumber" TEXT,
    "materialId" TEXT,
    "drawingMaterialText" TEXT,
    "drawingFinishText" TEXT,
    "finish" TEXT,
    "stockSize" TEXT,
    "cutLength" TEXT,
    "materialStatus" TEXT NOT NULL DEFAULT 'UNREVIEWED',
    "inventoryLocation" TEXT,
    "materialNotes" TEXT,
    "procurementVendorId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "QuotePart_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuotePart_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "QuotePart_procurementVendorId_fkey" FOREIGN KEY ("procurementVendorId") REFERENCES "Vendor" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_QuotePart" ("cutLength", "description", "id", "materialId", "name", "notes", "partNumber", "pieceCount", "quantity", "quoteId", "stockSize") SELECT "cutLength", "description", "id", "materialId", "name", "notes", "partNumber", "pieceCount", "quantity", "quoteId", "stockSize" FROM "QuotePart";
DROP TABLE "QuotePart";
ALTER TABLE "new_QuotePart" RENAME TO "QuotePart";
CREATE INDEX "QuotePart_quoteId_sortOrder_idx" ON "QuotePart"("quoteId", "sortOrder");
CREATE INDEX "QuotePart_procurementVendorId_idx" ON "QuotePart"("procurementVendorId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "QuotePartAttachment_quoteId_idx" ON "QuotePartAttachment"("quoteId");

-- CreateIndex
CREATE INDEX "QuotePartAttachment_quotePartId_idx" ON "QuotePartAttachment"("quotePartId");

-- CreateIndex
CREATE INDEX "QuotePartAttachment_storagePath_idx" ON "QuotePartAttachment"("storagePath");
