-- Antrean email blast: kelompok per blast (2026-10-28) — untuk detail & batalkan per blast.
-- Baris lama (kalau ada) dikelompokkan per judul + sumber.
ALTER TABLE "EmailQueue" ADD COLUMN "batchId" TEXT;
UPDATE "EmailQueue" SET "batchId" = 'legacy-' || md5("title" || '|' || "source") WHERE "batchId" IS NULL;
ALTER TABLE "EmailQueue" ALTER COLUMN "batchId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "EmailQueue_batchId_idx" ON "EmailQueue"("batchId");
