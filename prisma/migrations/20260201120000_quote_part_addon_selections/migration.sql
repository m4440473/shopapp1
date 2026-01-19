-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_QuoteAddonSelection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quoteId" TEXT NOT NULL,
    "quotePartId" TEXT,
    "addonId" TEXT NOT NULL,
    "units" REAL NOT NULL DEFAULT 0,
    "rateTypeSnapshot" TEXT NOT NULL,
    "rateCents" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "notes" TEXT,
    CONSTRAINT "QuoteAddonSelection_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuoteAddonSelection_quotePartId_fkey" FOREIGN KEY ("quotePartId") REFERENCES "QuotePart" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuoteAddonSelection_addonId_fkey" FOREIGN KEY ("addonId") REFERENCES "Addon" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_QuoteAddonSelection" ("addonId", "id", "notes", "quoteId", "quotePartId", "rateCents", "rateTypeSnapshot", "totalCents", "units")
SELECT "addonId",
       "id",
       "notes",
       "quoteId",
       NULL,
       "rateCents",
       "rateTypeSnapshot",
       "totalCents",
       "units"
FROM "QuoteAddonSelection";
DROP TABLE "QuoteAddonSelection";
ALTER TABLE "new_QuoteAddonSelection" RENAME TO "QuoteAddonSelection";
CREATE INDEX "QuoteAddonSelection_quotePartId_idx" ON "QuoteAddonSelection"("quotePartId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
