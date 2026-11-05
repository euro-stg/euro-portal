-- Jumlah digit nomor urut (2026-11-04): segmen SEQUENCE bisa diberi nol di depan (4 → "0001").
ALTER TABLE "EDocNumberFormatSegment" ADD COLUMN "padLength" INTEGER;

-- Format yang sudah ada langsung memakai 4 digit (permintaan user); bisa diubah per format
-- di Pengaturan → Number Format. Nomor yang sudah terbit tidak berubah.
UPDATE "EDocNumberFormatSegment" SET "padLength" = 4 WHERE "segmentType" = 'SEQUENCE';
