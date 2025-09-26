-- Merge checklist items into addons and repoint order checklist rows

-- Ensure every checklist item has a matching add-on entry
INSERT INTO "Addon" ("id", "name", "description", "rateType", "rateCents", "active", "createdAt", "updatedAt")
SELECT ci."id", ci."label", NULL, 'FLAT', 0, ci."active", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ChecklistItem" ci
WHERE NOT EXISTS (
  SELECT 1 FROM "Addon" a WHERE LOWER(a."name") = LOWER(ci."label")
);

-- Build the replacement OrderChecklist table with addon references and timestamps
CREATE TABLE "_new_OrderChecklist" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "orderId" TEXT NOT NULL,
  "addonId" TEXT NOT NULL,
  "toggledById" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderChecklist_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OrderChecklist_addonId_fkey" FOREIGN KEY ("addonId") REFERENCES "Addon" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OrderChecklist_toggledById_fkey" FOREIGN KEY ("toggledById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Copy existing rows using the matching add-on
INSERT INTO "_new_OrderChecklist" ("id", "orderId", "addonId", "toggledById")
SELECT oc."id",
       oc."orderId",
       COALESCE(a."id", a2."id") AS "addonId",
       oc."toggledById"
FROM "OrderChecklist" oc
LEFT JOIN "ChecklistItem" ci ON ci."id" = oc."checklistItemId"
LEFT JOIN "Addon" a ON a."id" = ci."id"
LEFT JOIN "Addon" a2 ON LOWER(a2."name") = LOWER(ci."label")
WHERE ci."id" IS NOT NULL;

-- Replace the original table
DROP TABLE "OrderChecklist";
ALTER TABLE "_new_OrderChecklist" RENAME TO "OrderChecklist";
CREATE UNIQUE INDEX "OrderChecklist_orderId_addonId_key" ON "OrderChecklist"("orderId", "addonId");

-- Checklist items table is no longer needed
DROP TABLE IF EXISTS "ChecklistItem";
