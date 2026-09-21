-- CreateTable
CREATE TABLE "EDocFileBlastFolder" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "EDocFileBlastFolder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EDocFileBlastFolder_folderId_idx" ON "EDocFileBlastFolder"("folderId");

-- CreateIndex
CREATE UNIQUE INDEX "EDocFileBlastFolder_fileId_folderId_key" ON "EDocFileBlastFolder"("fileId", "folderId");

-- AddForeignKey
ALTER TABLE "EDocFileBlastFolder" ADD CONSTRAINT "EDocFileBlastFolder_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "EDocFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EDocFileBlastFolder" ADD CONSTRAINT "EDocFileBlastFolder_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "EDocFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EDocFileBlastFolder" ADD CONSTRAINT "EDocFileBlastFolder_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
