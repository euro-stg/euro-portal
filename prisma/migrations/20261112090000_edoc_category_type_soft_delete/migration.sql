-- Soft delete Category Type E Document (2026-11-12)
ALTER TABLE "EDocCategoryType" ADD COLUMN "deletedAt" TIMESTAMP(3);
