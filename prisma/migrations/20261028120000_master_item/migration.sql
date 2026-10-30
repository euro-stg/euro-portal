-- Master Item (2026-10-28): salinan item ERP untuk validasi & sinkronisasi item IM.
-- CreateTable
CREATE TABLE "MasterItem" (
    "id" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "itemGroup" TEXT NOT NULL,
    "stockUom" TEXT,
    "erpDisabled" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "erpModified" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "MasterItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MasterItem_itemCode_key" ON "MasterItem"("itemCode");

-- CreateIndex
CREATE INDEX "MasterItem_nameKey_idx" ON "MasterItem"("nameKey");

-- CreateIndex
CREATE INDEX "MasterItem_status_idx" ON "MasterItem"("status");

-- CreateIndex
CREATE INDEX "MasterItem_itemGroup_idx" ON "MasterItem"("itemGroup");

