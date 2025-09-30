PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderNumber" TEXT NOT NULL,
    "business" TEXT NOT NULL DEFAULT 'STD',
    "customerId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "receivedDate" DATETIME NOT NULL,
    "modelIncluded" BOOLEAN NOT NULL DEFAULT false,
    "materialNeeded" BOOLEAN NOT NULL DEFAULT false,
    "materialOrdered" BOOLEAN NOT NULL DEFAULT false,
    "vendorId" TEXT,
    "poNumber" TEXT,
    "assignedMachinistId" TEXT,
    CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Order_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Order_assignedMachinistId_fkey" FOREIGN KEY ("assignedMachinistId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("id", "orderNumber", "customerId", "status", "priority", "dueDate", "receivedDate", "modelIncluded", "materialNeeded", "materialOrdered", "vendorId", "poNumber", "assignedMachinistId")
SELECT "id", "orderNumber", "customerId", "status", "priority", "dueDate", "receivedDate", "modelIncluded", "materialNeeded", "materialOrdered", "vendorId", "poNumber", "assignedMachinistId" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";

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
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Quote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Quote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Quote" ("id", "quoteNumber", "companyName", "contactName", "contactEmail", "contactPhone", "customerId", "status", "materialSummary", "purchaseItems", "requirements", "notes", "multiPiece", "basePriceCents", "addonsTotalCents", "vendorTotalCents", "totalCents", "metadata", "createdById", "createdAt", "updatedAt")
SELECT "id", "quoteNumber", "companyName", "contactName", "contactEmail", "contactPhone", "customerId", "status", "materialSummary", "purchaseItems", "requirements", "notes", "multiPiece", "basePriceCents", "addonsTotalCents", "vendorTotalCents", "totalCents", "metadata", "createdById", "createdAt", "updatedAt" FROM "Quote";
DROP TABLE "Quote";
ALTER TABLE "new_Quote" RENAME TO "Quote";

PRAGMA foreign_keys=ON;
