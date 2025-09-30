PRAGMA foreign_keys=OFF;

CREATE TABLE "Attachment_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "url" TEXT,
    "storagePath" TEXT,
    "label" TEXT,
    "mimeType" TEXT,
    "uploadedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Attachment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Attachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "Attachment_new" ("id", "orderId", "url", "storagePath", "label", "mimeType", "uploadedById", "createdAt")
SELECT "id", "orderId", "url", NULL, "label", "mimeType", "uploadedById", "createdAt"
FROM "Attachment";

DROP TABLE "Attachment";
ALTER TABLE "Attachment_new" RENAME TO "Attachment";

CREATE INDEX "Attachment_storagePath_idx" ON "Attachment"("storagePath");

PRAGMA foreign_keys=ON;
