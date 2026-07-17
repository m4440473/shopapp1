-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceQuoteId" TEXT,
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
    CONSTRAINT "Order_sourceQuoteId_fkey" FOREIGN KEY ("sourceQuoteId") REFERENCES "Quote" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Order_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Order_assignedMachinistId_fkey" FOREIGN KEY ("assignedMachinistId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("assignedMachinistId", "business", "customerId", "dueDate", "id", "materialNeeded", "materialOrdered", "modelIncluded", "orderNumber", "poNumber", "priority", "receivedDate", "status", "vendorId") SELECT "assignedMachinistId", "business", "customerId", "dueDate", "id", "materialNeeded", "materialOrdered", "modelIncluded", "orderNumber", "poNumber", "priority", "receivedDate", "status", "vendorId" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE UNIQUE INDEX "Order_sourceQuoteId_key" ON "Order"("sourceQuoteId");
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
