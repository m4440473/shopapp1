PRAGMA foreign_keys=OFF;

CREATE TABLE "Department" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");
CREATE UNIQUE INDEX "Department_slug_key" ON "Department"("slug");

INSERT INTO "Department" ("id", "name", "slug", "sortOrder", "isActive", "createdAt", "updatedAt") VALUES
  ('dept_machining', 'Machining', 'machining', 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('dept_fab', 'Fab', 'fab', 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('dept_paint', 'Paint', 'paint', 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('dept_shipping', 'Shipping', 'shipping', 30, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

ALTER TABLE "Addon" RENAME TO "Addon_old";

CREATE TABLE "Addon" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "rateType" TEXT NOT NULL,
  "rateCents" INTEGER NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "departmentId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Addon_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "Addon" ("id", "name", "description", "rateType", "rateCents", "active", "departmentId", "createdAt", "updatedAt")
SELECT "id", "name", "description", "rateType", "rateCents", "active", 'dept_machining', "createdAt", "updatedAt"
FROM "Addon_old";

DROP TABLE "Addon_old";

CREATE UNIQUE INDEX "Addon_name_key" ON "Addon"("name");
CREATE INDEX "Addon_active_idx" ON "Addon"("active");

PRAGMA foreign_keys=ON;
