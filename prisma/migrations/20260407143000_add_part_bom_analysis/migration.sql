-- CreateTable
CREATE TABLE "PartBomAnalysis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "analyzedById" TEXT,
    "resultJson" TEXT NOT NULL,
    "sourceLabel" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PartBomAnalysis_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PartBomAnalysis_partId_fkey" FOREIGN KEY ("partId") REFERENCES "OrderPart" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PartBomAnalysis_analyzedById_fkey" FOREIGN KEY ("analyzedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PartBomAnalysis_orderId_partId_key" ON "PartBomAnalysis"("orderId", "partId");

-- CreateIndex
CREATE INDEX "PartBomAnalysis_partId_idx" ON "PartBomAnalysis"("partId");

-- CreateIndex
CREATE INDEX "PartBomAnalysis_analyzedById_idx" ON "PartBomAnalysis"("analyzedById");
