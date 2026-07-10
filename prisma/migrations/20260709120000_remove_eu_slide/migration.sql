-- DropForeignKey
ALTER TABLE "EuSlide" DROP CONSTRAINT IF EXISTS "EuSlide_postId_fkey";

-- DropTable
DROP TABLE IF EXISTS "EuSlide";
