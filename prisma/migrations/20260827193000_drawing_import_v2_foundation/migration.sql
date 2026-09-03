-- Drawing Import V2 is additive. Existing drawing, quote, order, and attachment
-- records remain untouched and the legacy importer can continue to operate.

CREATE TABLE "DrawingImportJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "idempotencyKey" TEXT NOT NULL,
    "createdById" TEXT,
    "destination" TEXT NOT NULL,
    "business" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "draftReference" TEXT NOT NULL,
    "intakeMode" TEXT NOT NULL,
    "assemblyMultiplier" INTEGER NOT NULL DEFAULT 1,
    "pipelineVersion" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "stage" TEXT NOT NULL DEFAULT 'queued',
    "configJson" TEXT NOT NULL,
    "countsJson" TEXT,
    "timingJson" TEXT,
    "estimatedCostUsd" REAL NOT NULL DEFAULT 0,
    "actualCostUsd" REAL NOT NULL DEFAULT 0,
    "softBudgetUsd" REAL NOT NULL,
    "hardBudgetUsd" REAL NOT NULL,
    "errorSummary" TEXT,
    "cancelRequestedAt" DATETIME,
    "startedAt" DATETIME,
    "firstPageReadyAt" DATETIME,
    "completedAt" DATETIME,
    "lastHeartbeatAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DrawingImportJob_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "DrawingImportSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "sourceKind" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "archivePath" TEXT,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "pageCount" INTEGER,
    "warningsJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DrawingImportSource_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "DrawingImportJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "DrawingImportPage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourcePageNumber" INTEGER NOT NULL,
    "sourceFilename" TEXT NOT NULL,
    "canonicalPdfStoragePath" TEXT,
    "previewStoragePath" TEXT,
    "contentSha256" TEXT NOT NULL,
    "perceptualHash" TEXT,
    "width" REAL NOT NULL,
    "height" REAL NOT NULL,
    "rotation" INTEGER NOT NULL DEFAULT 0,
    "classification" TEXT NOT NULL DEFAULT 'uncertain',
    "classificationConfidence" REAL NOT NULL DEFAULT 0,
    "localExtractionJson" TEXT,
    "finalExtractionJson" TEXT,
    "reviewStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "routeTier" TEXT NOT NULL DEFAULT 'local',
    "warningsJson" TEXT,
    "duplicateOfPageId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DrawingImportPage_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "DrawingImportJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DrawingImportPage_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "DrawingImportSource" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DrawingImportPage_duplicateOfPageId_fkey" FOREIGN KEY ("duplicateOfPageId") REFERENCES "DrawingImportPage" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "DrawingExtractionAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pageId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "routeTier" TEXT NOT NULL,
    "parserVersion" TEXT,
    "profileVersion" TEXT,
    "promptVersion" TEXT,
    "requestedModel" TEXT,
    "resolvedModel" TEXT,
    "reasoningEffort" TEXT,
    "serviceTier" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "cachedInputTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheWriteTokens" INTEGER,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "reasoningTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostUsd" REAL NOT NULL DEFAULT 0,
    "calculatedCostUsd" REAL NOT NULL DEFAULT 0,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "responseId" TEXT,
    "resultJson" TEXT,
    "warningsJson" TEXT,
    "errorSummary" TEXT,
    "supersedesAttemptId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DrawingExtractionAttempt_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "DrawingImportPage" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DrawingExtractionAttempt_supersedesAttemptId_fkey" FOREIGN KEY ("supersedesAttemptId") REFERENCES "DrawingExtractionAttempt" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "DrawingImportBomRow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "sourcePageId" TEXT NOT NULL,
    "rowIndex" INTEGER NOT NULL,
    "item" TEXT,
    "childPartNumber" TEXT,
    "description" TEXT,
    "quantityPerParent" INTEGER,
    "material" TEXT,
    "revision" TEXT,
    "parentAssemblyPartNumber" TEXT,
    "sourceRegionJson" TEXT NOT NULL,
    "rawCellsJson" TEXT NOT NULL,
    "warningsJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DrawingImportBomRow_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "DrawingImportJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DrawingImportBomRow_sourcePageId_fkey" FOREIGN KEY ("sourcePageId") REFERENCES "DrawingImportPage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "DrawingImportBomEdge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bomRowId" TEXT NOT NULL,
    "parentPageId" TEXT,
    "childPageId" TEXT,
    "quantityPerParent" INTEGER,
    "status" TEXT NOT NULL,
    "warningsJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DrawingImportBomEdge_bomRowId_fkey" FOREIGN KEY ("bomRowId") REFERENCES "DrawingImportBomRow" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DrawingImportBomEdge_parentPageId_fkey" FOREIGN KEY ("parentPageId") REFERENCES "DrawingImportPage" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DrawingImportBomEdge_childPageId_fkey" FOREIGN KEY ("childPageId") REFERENCES "DrawingImportPage" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "DrawingTitleBlockProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileIdentifier" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "businessCode" TEXT,
    "customerId" TEXT,
    "expectedLayoutJson" TEXT NOT NULL,
    "anchorsJson" TEXT NOT NULL,
    "fieldRulesJson" TEXT NOT NULL,
    "validationStatsJson" TEXT,
    "validationState" TEXT NOT NULL DEFAULT 'PROPOSED',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DrawingTitleBlockProfile_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DrawingTitleBlockProfile_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

ALTER TABLE "OrderPart" ADD COLUMN "finalPartLength" TEXT;
ALTER TABLE "OrderPart" ADD COLUMN "drawingImportPageId" TEXT REFERENCES "DrawingImportPage" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "QuotePart" ADD COLUMN "finalPartLength" TEXT;
ALTER TABLE "QuotePart" ADD COLUMN "drawingImportPageId" TEXT REFERENCES "DrawingImportPage" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "DrawingImportJob_idempotencyKey_key" ON "DrawingImportJob"("idempotencyKey");
CREATE INDEX "DrawingImportJob_status_updatedAt_idx" ON "DrawingImportJob"("status", "updatedAt");
CREATE INDEX "DrawingImportJob_createdById_createdAt_idx" ON "DrawingImportJob"("createdById", "createdAt");
CREATE INDEX "DrawingImportJob_draftReference_idx" ON "DrawingImportJob"("draftReference");
CREATE INDEX "DrawingImportSource_jobId_idx" ON "DrawingImportSource"("jobId");
CREATE INDEX "DrawingImportSource_sha256_idx" ON "DrawingImportSource"("sha256");
CREATE INDEX "DrawingImportSource_storagePath_idx" ON "DrawingImportSource"("storagePath");
CREATE UNIQUE INDEX "DrawingImportPage_sourceId_sourcePageNumber_key" ON "DrawingImportPage"("sourceId", "sourcePageNumber");
CREATE INDEX "DrawingImportPage_jobId_reviewStatus_idx" ON "DrawingImportPage"("jobId", "reviewStatus");
CREATE INDEX "DrawingImportPage_contentSha256_idx" ON "DrawingImportPage"("contentSha256");
CREATE INDEX "DrawingImportPage_duplicateOfPageId_idx" ON "DrawingImportPage"("duplicateOfPageId");
CREATE UNIQUE INDEX "DrawingExtractionAttempt_idempotencyKey_key" ON "DrawingExtractionAttempt"("idempotencyKey");
CREATE INDEX "DrawingExtractionAttempt_pageId_stage_idx" ON "DrawingExtractionAttempt"("pageId", "stage");
CREATE INDEX "DrawingExtractionAttempt_requestedModel_idx" ON "DrawingExtractionAttempt"("requestedModel");
CREATE INDEX "DrawingExtractionAttempt_supersedesAttemptId_idx" ON "DrawingExtractionAttempt"("supersedesAttemptId");
CREATE UNIQUE INDEX "DrawingImportBomRow_sourcePageId_rowIndex_key" ON "DrawingImportBomRow"("sourcePageId", "rowIndex");
CREATE INDEX "DrawingImportBomRow_jobId_idx" ON "DrawingImportBomRow"("jobId");
CREATE INDEX "DrawingImportBomRow_childPartNumber_idx" ON "DrawingImportBomRow"("childPartNumber");
CREATE INDEX "DrawingImportBomRow_parentAssemblyPartNumber_idx" ON "DrawingImportBomRow"("parentAssemblyPartNumber");
CREATE UNIQUE INDEX "DrawingImportBomEdge_bomRowId_key" ON "DrawingImportBomEdge"("bomRowId");
CREATE INDEX "DrawingImportBomEdge_parentPageId_idx" ON "DrawingImportBomEdge"("parentPageId");
CREATE INDEX "DrawingImportBomEdge_childPageId_idx" ON "DrawingImportBomEdge"("childPageId");
CREATE INDEX "DrawingImportBomEdge_status_idx" ON "DrawingImportBomEdge"("status");
CREATE UNIQUE INDEX "DrawingTitleBlockProfile_profileIdentifier_version_key" ON "DrawingTitleBlockProfile"("profileIdentifier", "version");
CREATE INDEX "DrawingTitleBlockProfile_customerId_isActive_idx" ON "DrawingTitleBlockProfile"("customerId", "isActive");
CREATE INDEX "DrawingTitleBlockProfile_businessCode_isActive_idx" ON "DrawingTitleBlockProfile"("businessCode", "isActive");
CREATE INDEX "DrawingTitleBlockProfile_validationState_idx" ON "DrawingTitleBlockProfile"("validationState");
CREATE INDEX "OrderPart_drawingImportPageId_idx" ON "OrderPart"("drawingImportPageId");
CREATE INDEX "QuotePart_drawingImportPageId_idx" ON "QuotePart"("drawingImportPageId");
