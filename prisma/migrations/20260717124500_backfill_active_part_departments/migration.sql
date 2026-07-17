-- Active work must have an explicit floor location so it appears on the TV queue.
-- Historical completed parts are intentionally left unchanged.
UPDATE "OrderPart"
SET "currentDepartmentId" = (
  SELECT "id"
  FROM "Department"
  WHERE "isActive" = 1
    AND lower(trim("name")) <> 'shipping'
  ORDER BY "sortOrder" ASC, "name" ASC
  LIMIT 1
)
WHERE "currentDepartmentId" IS NULL
  AND "status" <> 'COMPLETE'
  AND EXISTS (
    SELECT 1
    FROM "Department"
    WHERE "isActive" = 1
      AND lower(trim("name")) <> 'shipping'
  );
