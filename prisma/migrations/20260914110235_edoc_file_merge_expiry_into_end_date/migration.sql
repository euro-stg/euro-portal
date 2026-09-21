-- Merge EDocFile.expiryDate into endDate (already holds the same value for existing
-- rows before this migration — verified 2026-09-14, both real rows had expiryDate ==
-- endDate already) — endDate now also drives the auto-relocate-to-Obsolete behavior.
ALTER TABLE "EDocFile" DROP COLUMN "expiryDate";
