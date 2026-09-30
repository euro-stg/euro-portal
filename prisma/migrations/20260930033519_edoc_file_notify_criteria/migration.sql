-- "Kriteria Email Blast" (2026-09-30) — 4 array kolom baru di EDocFile, independen dari
-- Blast folder (EDocFileBlastFolder). Default '{}' aman untuk baris lama (dianggap belum
-- diisi = tidak ada yang di-email untuk file itu).
ALTER TABLE "EDocFile" ADD COLUMN     "notifyBranchIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "notifyOrgIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "notifyPositionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "notifyBusinessUnitCodes" TEXT[] DEFAULT ARRAY[]::TEXT[];
