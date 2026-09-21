-- AlterTable
ALTER TABLE "EDocImProduct" ADD COLUMN     "sku" TEXT;

-- CreateIndex
CREATE INDEX "EDocImProduct_sku_idx" ON "EDocImProduct"("sku");
