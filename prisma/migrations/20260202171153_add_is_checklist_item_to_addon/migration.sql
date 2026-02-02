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
    "isChecklistItem" BOOLEAN NOT NULL DEFAULT true,
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
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
