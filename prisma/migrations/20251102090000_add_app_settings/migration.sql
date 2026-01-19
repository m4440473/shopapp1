PRAGMA foreign_keys=OFF;

CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "companyName" TEXT NOT NULL DEFAULT 'Shopapp1',
    "logoPath" TEXT,
    "themePrimary" TEXT NOT NULL DEFAULT '#0ea5e9',
    "themeAccent" TEXT NOT NULL DEFAULT '#a855f7',
    "attachmentsDir" TEXT NOT NULL DEFAULT '/app/storage',
    "requirePOForQuoteApproval" BOOLEAN NOT NULL DEFAULT true,
    "requirePOForQuoteToOrder" BOOLEAN NOT NULL DEFAULT false,
    "invoiceTemplateId" TEXT NOT NULL DEFAULT 'classic',
    "invoiceOptions" TEXT,
    "updatedAt" DATETIME NOT NULL
);

PRAGMA foreign_keys=ON;
