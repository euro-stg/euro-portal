-- Master Item: field tambahan dari ERP + harga standar (2026-10-30).
-- AlterTable
ALTER TABLE "MasterItem" ADD COLUMN     "business" TEXT,
ADD COLUMN     "company" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "isSalesItem" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "qtyPackage" DOUBLE PRECISION,
ADD COLUMN     "standardPrice" DOUBLE PRECISION,
ADD COLUMN     "standardPriceValidFrom" TEXT,
ADD COLUMN     "standardPriceValidUpto" TEXT,
ADD COLUMN     "treatmentType" TEXT;

-- CreateIndex
CREATE INDEX "MasterItem_company_idx" ON "MasterItem"("company");

-- CreateIndex
CREATE INDEX "MasterItem_business_idx" ON "MasterItem"("business");


-- Reset kursor sync supaya sync berikutnya otomatis PENUH dan field baru terisi untuk semua item.
DELETE FROM "SystemConfig" WHERE "key" = 'erp.itemSync.cursor';
