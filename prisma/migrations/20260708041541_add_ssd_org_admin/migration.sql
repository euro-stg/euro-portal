-- AlterTable
ALTER TABLE "SsdLetter" ADD COLUMN     "organizationId" TEXT;

-- CreateTable
CREATE TABLE "SsdOrgAdmin" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SsdOrgAdmin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SsdOrgAdmin_userId_key" ON "SsdOrgAdmin"("userId");

-- AddForeignKey
ALTER TABLE "SsdLetter" ADD CONSTRAINT "SsdLetter_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsdOrgAdmin" ADD CONSTRAINT "SsdOrgAdmin_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsdOrgAdmin" ADD CONSTRAINT "SsdOrgAdmin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
