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
    CONSTRAINT "OrderCharge_partId_fkey" FOREIGN KEY ("partId") REFERENCES "OrderPart" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OrderCharge_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OrderCharge_addonId_fkey" FOREIGN KEY ("addonId") REFERENCES "Addon" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PartAttachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "storagePath" TEXT,
    "label" TEXT,
    "mimeType" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PartAttachment_partId_fkey" FOREIGN KEY ("partId") REFERENCES "OrderPart" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
    "departmentId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Addon_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Addon" ("active", "createdAt", "departmentId", "description", "id", "name", "rateCents", "rateType", "updatedAt") SELECT "active", "createdAt", "departmentId", "description", "id", "name", "rateCents", "rateType", "updatedAt" FROM "Addon";
DROP TABLE "Addon";
ALTER TABLE "new_Addon" RENAME TO "Addon";
CREATE INDEX "Addon_active_idx" ON "Addon"("active");
CREATE UNIQUE INDEX "Addon_name_key" ON "Addon"("name");
CREATE TABLE "new_Department" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Department" ("createdAt", "id", "isActive", "name", "slug", "sortOrder", "updatedAt") SELECT "createdAt", "id", "isActive", "name", "slug", "sortOrder", "updatedAt" FROM "Department";
DROP TABLE "Department";
ALTER TABLE "new_Department" RENAME TO "Department";
CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");
CREATE UNIQUE INDEX "Department_slug_key" ON "Department"("slug");
CREATE TABLE "new_OrderChecklist" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "partId" TEXT,
    "addonId" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "toggledById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OrderChecklist_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrderChecklist_partId_fkey" FOREIGN KEY ("partId") REFERENCES "OrderPart" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OrderChecklist_addonId_fkey" FOREIGN KEY ("addonId") REFERENCES "Addon" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OrderChecklist_toggledById_fkey" FOREIGN KEY ("toggledById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_OrderChecklist" ("addonId", "completed", "createdAt", "id", "orderId", "toggledById", "updatedAt") SELECT "addonId", "completed", "createdAt", "id", "orderId", "toggledById", "updatedAt" FROM "OrderChecklist";
DROP TABLE "OrderChecklist";
ALTER TABLE "new_OrderChecklist" RENAME TO "OrderChecklist";
CREATE UNIQUE INDEX "OrderChecklist_orderId_partId_addonId_key" ON "OrderChecklist"("orderId", "partId", "addonId");
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
CREATE TABLE "new_QuoteAddonSelection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quoteId" TEXT NOT NULL,
    "addonId" TEXT NOT NULL,
    "units" REAL NOT NULL DEFAULT 0,
    "rateTypeSnapshot" TEXT NOT NULL,
    "rateCents" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "notes" TEXT,
    CONSTRAINT "QuoteAddonSelection_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuoteAddonSelection_addonId_fkey" FOREIGN KEY ("addonId") REFERENCES "Addon" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_QuoteAddonSelection" ("addonId", "id", "notes", "quoteId", "rateCents", "rateTypeSnapshot", "totalCents", "units") SELECT "addonId", "id", "notes", "quoteId", "rateCents", "rateTypeSnapshot", "totalCents", "units" FROM "QuoteAddonSelection";
DROP TABLE "QuoteAddonSelection";
ALTER TABLE "new_QuoteAddonSelection" RENAME TO "QuoteAddonSelection";
CREATE TABLE "new_QuoteAttachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quoteId" TEXT NOT NULL,
    "url" TEXT,
    "storagePath" TEXT,
    "label" TEXT,
    "mimeType" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuoteAttachment_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_QuoteAttachment" ("createdAt", "id", "label", "mimeType", "quoteId", "url") SELECT "createdAt", "id", "label", "mimeType", "quoteId", "url" FROM "QuoteAttachment";
DROP TABLE "QuoteAttachment";
ALTER TABLE "new_QuoteAttachment" RENAME TO "QuoteAttachment";
CREATE INDEX "QuoteAttachment_storagePath_idx" ON "QuoteAttachment"("storagePath");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "OrderCharge_orderId_idx" ON "OrderCharge"("orderId");

-- CreateIndex
CREATE INDEX "OrderCharge_partId_idx" ON "OrderCharge"("partId");

-- CreateIndex
CREATE INDEX "OrderCharge_departmentId_idx" ON "OrderCharge"("departmentId");

-- CreateIndex
CREATE INDEX "PartAttachment_partId_idx" ON "PartAttachment"("partId");

-- CreateIndex
CREATE INDEX "PartAttachment_storagePath_idx" ON "PartAttachment"("storagePath");
