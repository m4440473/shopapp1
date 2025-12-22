PRAGMA foreign_keys=OFF;

-- QuotePart: add partNumber, materialId, stockSize, cutLength
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
    "stockSize" TEXT,
    "cutLength" TEXT,
    CONSTRAINT "QuotePart_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuotePart_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_QuotePart" ("id", "quoteId", "name", "description", "quantity", "pieceCount", "notes", "partNumber", "materialId", "stockSize", "cutLength")
SELECT "id", "quoteId", "name", "description", "quantity", "pieceCount", "notes", NULL, NULL, NULL, NULL FROM "QuotePart";
DROP TABLE "QuotePart";
ALTER TABLE "new_QuotePart" RENAME TO "QuotePart";

-- OrderPart: add stockSize, cutLength (partNumber/materialId already exist)
CREATE TABLE "new_OrderPart" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "partNumber" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "materialId" TEXT,
    "notes" TEXT,
    "stockSize" TEXT,
    "cutLength" TEXT,
    CONSTRAINT "OrderPart_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OrderPart_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_OrderPart" ("id", "orderId", "partNumber", "quantity", "materialId", "notes", "stockSize", "cutLength")
SELECT "id", "orderId", "partNumber", "quantity", "materialId", "notes", NULL, NULL FROM "OrderPart";
DROP TABLE "OrderPart";
ALTER TABLE "new_OrderPart" RENAME TO "OrderPart";

PRAGMA foreign_keys=ON;
