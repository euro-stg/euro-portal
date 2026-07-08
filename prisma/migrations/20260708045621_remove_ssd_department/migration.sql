-- DropForeignKey
ALTER TABLE "SsdLetter" DROP CONSTRAINT "SsdLetter_departmentId_fkey";

-- AlterTable
ALTER TABLE "SsdLetter" DROP COLUMN "departmentId";

-- DropTable
DROP TABLE "SsdDepartment";
