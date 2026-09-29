-- Master Pricelist stops being parsed/structured item rows and becomes a plain file
-- attachment per Business Unit (2026-09-29, same-day revision of the earlier per-BU item
-- redesign). No data migration needed — EDocImPricelistItem never held real production
-- data (wiped in the prior migration the same day, per user's confirmed choice).

-- DropTable
DROP TABLE "EDocImPricelistItem";

-- CreateTable
CREATE TABLE "EDocImPricelistFile" (
    "id" TEXT NOT NULL,
    "businessUnitCode" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL,
    "uploadedBy" TEXT NOT NULL,

    CONSTRAINT "EDocImPricelistFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EDocImPricelistFile_businessUnitCode_key" ON "EDocImPricelistFile"("businessUnitCode");

-- AddForeignKey
ALTER TABLE "EDocImPricelistFile" ADD CONSTRAINT "EDocImPricelistFile_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
