-- CreateTable
CREATE TABLE "EuCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "color" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EuCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EuSlide" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "imageUrl" TEXT NOT NULL,
    "postId" TEXT,
    "linkUrl" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EuSlide_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EuPost" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "isMandatory" BOOLEAN NOT NULL DEFAULT false,
    "targetBranchIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "targetOrgIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "targetPositionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "EuPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EuAttachment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT,
    "size" INTEGER,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EuAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EuReaction" (
    "id" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EuReaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EuComment" (
    "id" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "EuComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EuReadLog" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EuReadLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EuCategory_name_key" ON "EuCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "EuReaction_targetType_targetId_userId_key" ON "EuReaction"("targetType", "targetId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "EuReadLog_postId_userId_key" ON "EuReadLog"("postId", "userId");

-- AddForeignKey
ALTER TABLE "EuSlide" ADD CONSTRAINT "EuSlide_postId_fkey" FOREIGN KEY ("postId") REFERENCES "EuPost"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EuPost" ADD CONSTRAINT "EuPost_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "EuCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EuPost" ADD CONSTRAINT "EuPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EuAttachment" ADD CONSTRAINT "EuAttachment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "EuPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EuReaction" ADD CONSTRAINT "EuReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EuComment" ADD CONSTRAINT "EuComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EuReadLog" ADD CONSTRAINT "EuReadLog_postId_fkey" FOREIGN KEY ("postId") REFERENCES "EuPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EuReadLog" ADD CONSTRAINT "EuReadLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
