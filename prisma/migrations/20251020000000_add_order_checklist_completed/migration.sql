-- Add completion tracking to order checklists
ALTER TABLE "OrderChecklist"
ADD COLUMN "completed" BOOLEAN NOT NULL DEFAULT false;

-- Ensure updatedAt continues to auto-update via trigger if present; no change needed for existing rows
