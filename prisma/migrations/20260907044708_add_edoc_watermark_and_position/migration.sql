-- AlterTable
ALTER TABLE "EDocNumberFormat" ADD COLUMN     "fontSize" DOUBLE PRECISION DEFAULT 11,
ADD COLUMN     "positionXMm" DOUBLE PRECISION,
ADD COLUMN     "positionYMm" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "EDocWatermarkConfig" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'green',
    "positionXMm" DOUBLE PRECISION NOT NULL,
    "positionYMm" DOUBLE PRECISION NOT NULL,
    "fontSize" DOUBLE PRECISION NOT NULL DEFAULT 24,

    CONSTRAINT "EDocWatermarkConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EDocWatermarkConfig_categoryId_key" ON "EDocWatermarkConfig"("categoryId");

-- AddForeignKey
ALTER TABLE "EDocWatermarkConfig" ADD CONSTRAINT "EDocWatermarkConfig_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "EDocCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
