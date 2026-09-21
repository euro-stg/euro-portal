/*
  Warnings:

  - You are about to drop the column `productName` on the `EDocImProduct` table. All the data in the column will be lost.
  - You are about to drop the column `sku` on the `EDocImProduct` table. All the data in the column will be lost.
  - Added the required column `itemName` to the `EDocImProduct` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "EDocImProduct_sku_idx";

-- AlterTable
ALTER TABLE "EDocImProduct" DROP COLUMN "productName",
DROP COLUMN "sku",
ADD COLUMN     "category" TEXT,
ADD COLUMN     "discountClass" TEXT,
ADD COLUMN     "discountPercent" DOUBLE PRECISION,
ADD COLUMN     "eligibleClient" TEXT,
ADD COLUMN     "imNumber" TEXT,
ADD COLUMN     "imSubject" TEXT,
ADD COLUMN     "itemName" TEXT NOT NULL,
ADD COLUMN     "keyConditions" TEXT,
ADD COLUMN     "normalPrice" DOUBLE PRECISION,
ADD COLUMN     "promoDetail" TEXT,
ADD COLUMN     "promoPrice" DOUBLE PRECISION,
ADD COLUMN     "promoType" TEXT,
ADD COLUMN     "qty" INTEGER,
ADD COLUMN     "validity" TEXT;

-- CreateTable
CREATE TABLE "EDocImPricelistItem" (
    "id" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "category" TEXT,
    "discountClass" TEXT,
    "packaging" TEXT,
    "normalPrice" DOUBLE PRECISION,
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT NOT NULL,

    CONSTRAINT "EDocImPricelistItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EDocImPricelistItem_itemName_key" ON "EDocImPricelistItem"("itemName");

-- CreateIndex
CREATE INDEX "EDocImProduct_itemName_idx" ON "EDocImProduct"("itemName");

-- AddForeignKey
ALTER TABLE "EDocImPricelistItem" ADD CONSTRAINT "EDocImPricelistItem_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
