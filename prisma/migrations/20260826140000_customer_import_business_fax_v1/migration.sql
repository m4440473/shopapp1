ALTER TABLE "Customer" ADD COLUMN "fax" TEXT;
ALTER TABLE "CustomerContact" ADD COLUMN "fax" TEXT;

CREATE TABLE "CustomerBusiness" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "businessCode" TEXT NOT NULL,
    "sourceFile" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerBusiness_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CustomerBusiness_customerId_businessCode_key" ON "CustomerBusiness"("customerId", "businessCode");
CREATE INDEX "CustomerBusiness_businessCode_idx" ON "CustomerBusiness"("businessCode");
