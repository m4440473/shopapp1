-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_OrderPart" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "partNumber" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "materialId" TEXT,
    "currentDepartmentId" TEXT,
    "notes" TEXT,
    "stockSize" TEXT,
    "cutLength" TEXT,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderPart_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OrderPart_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OrderPart_currentDepartmentId_fkey" FOREIGN KEY ("currentDepartmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_OrderPart" (
    "cutLength",
    "currentDepartmentId",
    "id",
    "materialId",
    "notes",
    "orderId",
    "partNumber",
    "quantity",
    "status",
    "stockSize",
    "createdAt",
    "updatedAt"
)
SELECT
    "cutLength",
    "currentDepartmentId",
    "id",
    "materialId",
    "notes",
    "orderId",
    "partNumber",
    "quantity",
    "status",
    "stockSize",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "OrderPart";
DROP TABLE "OrderPart";
ALTER TABLE "new_OrderPart" RENAME TO "OrderPart";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
