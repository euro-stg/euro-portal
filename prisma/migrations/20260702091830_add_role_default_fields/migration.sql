-- AlterTable
ALTER TABLE "Role" ADD COLUMN     "defaultOrgId" TEXT,
ADD COLUMN     "defaultPositionId" TEXT,
ADD COLUMN     "defaultScope" TEXT,
ADD COLUMN     "isDefault" BOOLEAN NOT NULL DEFAULT false;
