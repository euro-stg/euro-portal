/*
  Warnings:

  - You are about to drop the column `separator` on the `EDocNumberFormat` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "EDocNumberFormat" DROP COLUMN "separator";

-- AlterTable
ALTER TABLE "EDocNumberFormatSegment" ADD COLUMN     "separatorAfter" TEXT NOT NULL DEFAULT '/';
