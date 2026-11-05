-- Penggantian IM (2026-11-05): IM baru menggantikan IM lama.
CREATE TABLE "EDocFileReplacement" (
    "id" TEXT NOT NULL,
    "newFileId" TEXT NOT NULL,
    "oldFileId" TEXT NOT NULL,
    "obsoleteFolderId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedAt" TIMESTAMP(3),
    "appliedEndDate" TIMESTAMP(3),
    "previousEndDate" TIMESTAMP(3),
    "previousValidityType" TEXT,
    "previousObsoleteFolderId" TEXT,

    CONSTRAINT "EDocFileReplacement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EDocFileReplacement_oldFileId_key" ON "EDocFileReplacement"("oldFileId");
CREATE INDEX "EDocFileReplacement_newFileId_idx" ON "EDocFileReplacement"("newFileId");

ALTER TABLE "EDocFileReplacement" ADD CONSTRAINT "EDocFileReplacement_newFileId_fkey" FOREIGN KEY ("newFileId") REFERENCES "EDocFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EDocFileReplacement" ADD CONSTRAINT "EDocFileReplacement_oldFileId_fkey" FOREIGN KEY ("oldFileId") REFERENCES "EDocFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
