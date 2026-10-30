-- E Document: mapping SKU baris item IM ke Master Item + riwayat item yang dikeluarkan (2026-10-30).
-- CreateTable
CREATE TABLE "EDocImProductSku" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "mappedBy" TEXT NOT NULL,
    "mappedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EDocImProductSku_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EDocImProductRemoval" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "removedBy" TEXT NOT NULL,
    "removedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "restoredAt" TIMESTAMP(3),
    "restoredBy" TEXT,
    "restoredAsId" TEXT,

    CONSTRAINT "EDocImProductRemoval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EDocImProductSku_itemCode_idx" ON "EDocImProductSku"("itemCode");

-- CreateIndex
CREATE UNIQUE INDEX "EDocImProductSku_productId_company_key" ON "EDocImProductSku"("productId", "company");

-- CreateIndex
CREATE INDEX "EDocImProductRemoval_fileId_idx" ON "EDocImProductRemoval"("fileId");

-- CreateIndex
CREATE INDEX "EDocImProductRemoval_removedAt_idx" ON "EDocImProductRemoval"("removedAt");

-- AddForeignKey
ALTER TABLE "EDocImProductSku" ADD CONSTRAINT "EDocImProductSku_productId_fkey" FOREIGN KEY ("productId") REFERENCES "EDocImProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

