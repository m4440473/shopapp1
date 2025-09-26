-- Create the add-on catalog and quote tables required by the current schema

CREATE TABLE "Addon" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "rateType" TEXT NOT NULL,
  "rateCents" INTEGER NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "Addon_name_key" ON "Addon"("name");
CREATE INDEX "Addon_active_idx" ON "Addon"("active");

CREATE TABLE "Quote" (
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
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Quote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Quote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Quote_quoteNumber_key" ON "Quote"("quoteNumber");
CREATE INDEX "Quote_status_idx" ON "Quote"("status");
CREATE INDEX "Quote_companyName_idx" ON "Quote"("companyName");

CREATE TABLE "QuotePart" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "quoteId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "pieceCount" INTEGER NOT NULL DEFAULT 1,
  "notes" TEXT,
  CONSTRAINT "QuotePart_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "QuoteVendorItem" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "quoteId" TEXT NOT NULL,
  "vendorId" TEXT,
  "vendorName" TEXT,
  "partNumber" TEXT,
  "partUrl" TEXT,
  "basePriceCents" INTEGER NOT NULL DEFAULT 0,
  "markupPercent" REAL NOT NULL DEFAULT 0,
  "finalPriceCents" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT,
  CONSTRAINT "QuoteVendorItem_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "QuoteVendorItem_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "QuoteAddonSelection" (
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

CREATE TABLE "QuoteAttachment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "quoteId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "label" TEXT,
  "mimeType" TEXT,
  CONSTRAINT "QuoteAttachment_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
