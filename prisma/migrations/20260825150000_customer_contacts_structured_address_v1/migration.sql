-- Preserve the legacy Customer contact/address columns for backwards-compatible
-- reads while adding normalized contacts and shipping-address components.
ALTER TABLE "Customer" ADD COLUMN "addressLine1" TEXT;
ALTER TABLE "Customer" ADD COLUMN "addressLine2" TEXT;
ALTER TABLE "Customer" ADD COLUMN "city" TEXT;
ALTER TABLE "Customer" ADD COLUMN "stateProvince" TEXT;
ALTER TABLE "Customer" ADD COLUMN "postalCode" TEXT;
ALTER TABLE "Customer" ADD COLUMN "country" TEXT;

CREATE TABLE "CustomerContact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CustomerContact_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Existing quote snapshots can differ from the legacy Customer contact, so they
-- intentionally remain unlinked. This backfill only establishes a primary
-- contact for future selection and preserves every legacy scalar value.
INSERT INTO "CustomerContact" (
    "id", "customerId", "name", "phone", "email", "isPrimary", "sortOrder", "createdAt", "updatedAt"
)
SELECT
    'legacy-' || "id",
    "id",
    COALESCE(NULLIF(TRIM("contact"), ''), NULLIF(TRIM("email"), ''), 'Primary contact'),
    NULLIF(TRIM("phone"), ''),
    NULLIF(TRIM("email"), ''),
    true,
    0,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Customer"
WHERE NULLIF(TRIM("contact"), '') IS NOT NULL
   OR NULLIF(TRIM("phone"), '') IS NOT NULL
   OR NULLIF(TRIM("email"), '') IS NOT NULL;

ALTER TABLE "Quote" ADD COLUMN "customerContactId" TEXT REFERENCES "CustomerContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- SQLite cannot add a non-constant CURRENT_TIMESTAMP default to an existing
-- table. Rebuild Order so new rows receive a real creation timestamp, while
-- existing rows use their historically closest equivalent, receivedDate.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceQuoteId" TEXT,
    "orderNumber" TEXT NOT NULL,
    "business" TEXT NOT NULL DEFAULT 'STD',
    "customerId" TEXT NOT NULL,
    "customerContactId" TEXT,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Order_sourceQuoteId_fkey" FOREIGN KEY ("sourceQuoteId") REFERENCES "Quote" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Order_customerContactId_fkey" FOREIGN KEY ("customerContactId") REFERENCES "CustomerContact" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Order_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Order_assignedMachinistId_fkey" FOREIGN KEY ("assignedMachinistId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Order" (
    "id", "sourceQuoteId", "orderNumber", "business", "customerId", "status", "priority", "dueDate", "receivedDate",
    "modelIncluded", "materialNeeded", "materialOrdered", "vendorId", "poNumber", "assignedMachinistId", "createdAt"
)
SELECT
    "id", "sourceQuoteId", "orderNumber", "business", "customerId", "status", "priority", "dueDate", "receivedDate",
    "modelIncluded", "materialNeeded", "materialOrdered", "vendorId", "poNumber", "assignedMachinistId", "receivedDate"
FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE UNIQUE INDEX "Order_sourceQuoteId_key" ON "Order"("sourceQuoteId");
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

CREATE INDEX "CustomerContact_customerId_sortOrder_idx" ON "CustomerContact"("customerId", "sortOrder");
CREATE INDEX "CustomerContact_customerId_name_idx" ON "CustomerContact"("customerId", "name");
CREATE INDEX "CustomerContact_email_idx" ON "CustomerContact"("email");
CREATE INDEX "Quote_customerContactId_idx" ON "Quote"("customerContactId");
CREATE INDEX "Order_customerContactId_idx" ON "Order"("customerContactId");
