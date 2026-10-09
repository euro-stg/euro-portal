-- Izin download PDF per file (2026-10-07). Default false juga untuk SEMUA baris lama —
-- disengaja (keputusan user): file existing jadi view-only sampai flag-nya dinyalakan
-- manual lewat Edit file.
ALTER TABLE "EDocFile" ADD COLUMN     "allowDownload" BOOLEAN NOT NULL DEFAULT false;
