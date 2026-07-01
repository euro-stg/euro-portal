-- AlterTable: SsdLetter — drop content, add tujuan + picId
ALTER TABLE "SsdLetter" DROP COLUMN IF EXISTS "content";
ALTER TABLE "SsdLetter" ADD COLUMN "tujuan" TEXT;
ALTER TABLE "SsdLetter" ADD COLUMN "picId" TEXT;

-- AddForeignKey
ALTER TABLE "SsdLetter" ADD CONSTRAINT "SsdLetter_picId_fkey"
  FOREIGN KEY ("picId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
