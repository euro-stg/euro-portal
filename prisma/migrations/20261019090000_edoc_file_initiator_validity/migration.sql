-- E Document: Inisiator + Masa Berlaku (Tetap/Temporer) per file (2026-10-19).
ALTER TABLE "EDocFile" ADD COLUMN     "validityType" TEXT NOT NULL DEFAULT 'TETAP',
ADD COLUMN     "initiatorId" TEXT,
ADD COLUMN     "initiatorJobPositionName" TEXT;

ALTER TABLE "EDocFile" ADD CONSTRAINT "EDocFile_initiatorId_fkey" FOREIGN KEY ("initiatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill data lama: masa berlaku dari End Date, inisiator = pengupload (jabatan saat ini —
-- jabatan asli saat dokumen dibuat tidak pernah tersimpan sebelumnya).
UPDATE "EDocFile" SET "validityType" = 'TEMPORER' WHERE "endDate" IS NOT NULL;
UPDATE "EDocFile" f SET "initiatorId" = f."uploadedBy", "initiatorJobPositionName" = u."jobPositionName"
FROM "User" u WHERE u.id = f."uploadedBy" AND f."initiatorId" IS NULL;
