-- AlterTable
ALTER TABLE "EDocFile" ADD COLUMN     "bulkUploadKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "EDocFile_bulkUploadKey_key" ON "EDocFile"("bulkUploadKey");
