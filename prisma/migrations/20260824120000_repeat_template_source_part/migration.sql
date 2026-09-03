ALTER TABLE "RepeatOrderTemplate" ADD COLUMN "sourcePartId" TEXT;

CREATE UNIQUE INDEX "RepeatOrderTemplate_sourcePartId_key"
ON "RepeatOrderTemplate"("sourcePartId");
