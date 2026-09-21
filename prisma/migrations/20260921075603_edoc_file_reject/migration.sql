-- AlterTable
ALTER TABLE "EDocFile" ADD COLUMN     "rejectedAt" TIMESTAMP(3),
ADD COLUMN     "rejectedBy" TEXT,
ADD COLUMN     "rejectionNote" TEXT;

-- AddForeignKey
ALTER TABLE "EDocFile" ADD CONSTRAINT "EDocFile_rejectedBy_fkey" FOREIGN KEY ("rejectedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
