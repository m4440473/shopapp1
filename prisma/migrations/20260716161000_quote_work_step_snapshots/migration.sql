ALTER TABLE "QuoteAddonSelection" ADD COLUMN "affectsPriceSnapshot" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "QuoteAddonSelection" ADD COLUMN "isChecklistItemSnapshot" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "QuoteAddonSelection" ADD COLUMN "departmentIdSnapshot" TEXT;
ALTER TABLE "QuoteAddonSelection" ADD COLUMN "nameSnapshot" TEXT;

UPDATE "QuoteAddonSelection"
SET
  "affectsPriceSnapshot" = CASE
    WHEN "rateCents" > 0 AND "units" > 0 AND "totalCents" = 0 THEN false
    ELSE true
  END,
  "isChecklistItemSnapshot" = COALESCE(
    (SELECT "isChecklistItem" FROM "Addon" WHERE "Addon"."id" = "QuoteAddonSelection"."addonId"),
    true
  ),
  "departmentIdSnapshot" = (
    SELECT "departmentId" FROM "Addon" WHERE "Addon"."id" = "QuoteAddonSelection"."addonId"
  ),
  "nameSnapshot" = (
    SELECT "name" FROM "Addon" WHERE "Addon"."id" = "QuoteAddonSelection"."addonId"
  );

-- A double click in the legacy editor could create the same step twice. Keep the
-- first saved row so existing quotes stop billing the duplicate on future reads.
DELETE FROM "QuoteAddonSelection"
WHERE "quotePartId" IS NOT NULL
  AND "id" NOT IN (
    SELECT MIN("id")
    FROM "QuoteAddonSelection"
    WHERE "quotePartId" IS NOT NULL
    GROUP BY "quotePartId", "addonId"
  );

CREATE UNIQUE INDEX "QuoteAddonSelection_quotePartId_addonId_key"
ON "QuoteAddonSelection"("quotePartId", "addonId");
