-- Master Pricelist becomes per-Business-Unit (2026-09-29). Existing data is wiped
-- outright (not migrated into a fallback BU) per explicit product decision — itemName was
-- globally unique before, now it's only unique WITHIN a single businessUnitCode.
DELETE FROM "EDocImPricelistItem";

-- DropIndex
DROP INDEX "EDocImPricelistItem_itemName_key";

-- AlterTable
ALTER TABLE "EDocImPricelistItem" ADD COLUMN     "businessUnitCode" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "EDocImPricelistItem_businessUnitCode_itemName_key" ON "EDocImPricelistItem"("businessUnitCode", "itemName");
