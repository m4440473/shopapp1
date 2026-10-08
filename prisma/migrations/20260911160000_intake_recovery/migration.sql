CREATE TABLE "IntakeDraft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "dataJson" TEXT,
    "lastMutationId" TEXT NOT NULL,
    "clearedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "IntakeDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "IntakeDraft_userId_kind_key_key" ON "IntakeDraft"("userId", "kind", "key");
ALTER TABLE "Order" ADD COLUMN "submissionKey" TEXT;
ALTER TABLE "Order" ADD COLUMN "submissionPayloadHash" TEXT;
ALTER TABLE "Quote" ADD COLUMN "submissionKey" TEXT;
ALTER TABLE "Quote" ADD COLUMN "submissionPayloadHash" TEXT;
CREATE UNIQUE INDEX "Order_submissionKey_key" ON "Order"("submissionKey");
CREATE UNIQUE INDEX "Quote_submissionKey_key" ON "Quote"("submissionKey");
