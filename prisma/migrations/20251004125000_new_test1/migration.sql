-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Addon" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rateType" TEXT NOT NULL,
    "rateCents" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Addon" ("active", "createdAt", "description", "id", "name", "rateCents", "rateType", "updatedAt") SELECT "active", "createdAt", "description", "id", "name", "rateCents", "rateType", "updatedAt" FROM "Addon";
DROP TABLE "Addon";
ALTER TABLE "new_Addon" RENAME TO "Addon";
CREATE INDEX "Addon_active_idx" ON "Addon"("active");
CREATE UNIQUE INDEX "Addon_name_key" ON "Addon"("name");
CREATE TABLE "new_OrderChecklist" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "addonId" TEXT NOT NULL,
    "toggledById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OrderChecklist_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrderChecklist_addonId_fkey" FOREIGN KEY ("addonId") REFERENCES "Addon" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OrderChecklist_toggledById_fkey" FOREIGN KEY ("toggledById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_OrderChecklist" ("addonId", "createdAt", "id", "orderId", "toggledById", "updatedAt") SELECT "addonId", "createdAt", "id", "orderId", "toggledById", "updatedAt" FROM "OrderChecklist";
DROP TABLE "OrderChecklist";
ALTER TABLE "new_OrderChecklist" RENAME TO "OrderChecklist";
CREATE UNIQUE INDEX "OrderChecklist_orderId_addonId_key" ON "OrderChecklist"("orderId", "addonId");
CREATE TABLE "new_Quote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quoteNumber" TEXT NOT NULL,
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
    "metadata" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Quote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Quote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Quote" ("addonsTotalCents", "basePriceCents", "companyName", "contactEmail", "contactName", "contactPhone", "createdAt", "createdById", "customerId", "id", "materialSummary", "metadata", "multiPiece", "notes", "purchaseItems", "quoteNumber", "requirements", "status", "totalCents", "updatedAt", "vendorTotalCents") SELECT "addonsTotalCents", "basePriceCents", "companyName", "contactEmail", "contactName", "contactPhone", "createdAt", "createdById", "customerId", "id", "materialSummary", "metadata", "multiPiece", "notes", "purchaseItems", "quoteNumber", "requirements", "status", "totalCents", "updatedAt", "vendorTotalCents" FROM "Quote";
DROP TABLE "Quote";
ALTER TABLE "new_Quote" RENAME TO "Quote";
CREATE INDEX "Quote_status_idx" ON "Quote"("status");
CREATE INDEX "Quote_companyName_idx" ON "Quote"("companyName");
CREATE UNIQUE INDEX "Quote_quoteNumber_key" ON "Quote"("quoteNumber");
CREATE TABLE "new_QuoteAttachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quoteId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "label" TEXT,
    "mimeType" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuoteAttachment_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_QuoteAttachment" ("id", "label", "mimeType", "quoteId", "url") SELECT "id", "label", "mimeType", "quoteId", "url" FROM "QuoteAttachment";
DROP TABLE "QuoteAttachment";
ALTER TABLE "new_QuoteAttachment" RENAME TO "QuoteAttachment";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
