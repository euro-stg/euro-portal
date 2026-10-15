-- Euro Update: opsi blast notifikasi (aplikasi / email) per post saat dipublish (2026-10-15).
ALTER TABLE "EuPost" ADD COLUMN     "notifyInApp" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notifyEmail" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notifyBranchIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "notifyOrgIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "notifyPositionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "notifyBusinessUnitCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "notifiedAt" TIMESTAMP(3),
ADD COLUMN     "notifiedCount" INTEGER;
