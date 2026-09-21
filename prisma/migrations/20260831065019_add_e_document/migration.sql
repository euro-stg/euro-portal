-- CreateTable
CREATE TABLE "EDocFolderCreator" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedBy" TEXT NOT NULL,

    CONSTRAINT "EDocFolderCreator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EDocDocumentApprover" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedBy" TEXT NOT NULL,

    CONSTRAINT "EDocDocumentApprover_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EDocBusinessUnit" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "EDocBusinessUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EDocBranchPrefixMapping" (
    "id" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "businessUnitCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "EDocBranchPrefixMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EDocFolder" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentFolderId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'NORMAL',
    "createdBy" TEXT NOT NULL,
    "readBranchIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "readOrgIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "readPositionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "readBusinessUnitCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "writeBranchIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "writeOrgIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "writePositionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "writeBusinessUnitCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "EDocFolder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EDocFile" (
    "id" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT NOT NULL,
    "categoryTypeId" TEXT,
    "businessUnitCode" TEXT,
    "branchId" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "obsoleteDestinationFolderId" TEXT,
    "fileUrl" TEXT NOT NULL,
    "requiresNumber" BOOLEAN NOT NULL DEFAULT false,
    "documentNumber" TEXT,
    "mocNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "uploadedBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvalNote" TEXT,
    "mocGeneratedBy" TEXT,
    "mocGeneratedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "EDocFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EDocFileRevisionLog" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "previousFileUrl" TEXT NOT NULL,
    "replacedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "replacedBy" TEXT NOT NULL,

    CONSTRAINT "EDocFileRevisionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EDocCategory" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "EDocCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EDocCategoryType" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "EDocCategoryType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EDocNumberFormat" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT,
    "separator" TEXT NOT NULL DEFAULT '/',
    "sequenceScope" TEXT NOT NULL DEFAULT 'GLOBAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "EDocNumberFormat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EDocNumberFormatSegment" (
    "id" TEXT NOT NULL,
    "numberFormatId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "segmentType" TEXT NOT NULL,
    "literalValue" TEXT,

    CONSTRAINT "EDocNumberFormatSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EDocNumberSequenceCounter" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "seq" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EDocNumberSequenceCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EDocImProduct" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "productName" TEXT,
    "extra" JSONB,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "importedBy" TEXT NOT NULL,

    CONSTRAINT "EDocImProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EDocFeedback" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EDocFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EDocFeedbackQuestion" (
    "id" TEXT NOT NULL,
    "feedbackId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "type" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "options" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "EDocFeedbackQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EDocFeedbackResponse" (
    "id" TEXT NOT NULL,
    "feedbackId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EDocFeedbackResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EDocFeedbackAnswer" (
    "id" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "essayText" TEXT,
    "selectedOptions" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "EDocFeedbackAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EDocFolderCreator_userId_key" ON "EDocFolderCreator"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EDocDocumentApprover_userId_key" ON "EDocDocumentApprover"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EDocBusinessUnit_code_key" ON "EDocBusinessUnit"("code");

-- CreateIndex
CREATE UNIQUE INDEX "EDocBranchPrefixMapping_prefix_key" ON "EDocBranchPrefixMapping"("prefix");

-- CreateIndex
CREATE INDEX "EDocFolder_parentFolderId_idx" ON "EDocFolder"("parentFolderId");

-- CreateIndex
CREATE INDEX "EDocFile_folderId_idx" ON "EDocFile"("folderId");

-- CreateIndex
CREATE INDEX "EDocFile_categoryId_idx" ON "EDocFile"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "EDocCategory_code_key" ON "EDocCategory"("code");

-- CreateIndex
CREATE UNIQUE INDEX "EDocCategoryType_categoryId_code_key" ON "EDocCategoryType"("categoryId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "EDocNumberFormat_categoryId_type_key" ON "EDocNumberFormat"("categoryId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "EDocNumberFormatSegment_numberFormatId_order_key" ON "EDocNumberFormatSegment"("numberFormatId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "EDocNumberSequenceCounter_scope_key_key" ON "EDocNumberSequenceCounter"("scope", "key");

-- CreateIndex
CREATE INDEX "EDocImProduct_fileId_idx" ON "EDocImProduct"("fileId");

-- CreateIndex
CREATE INDEX "EDocImProduct_sku_idx" ON "EDocImProduct"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "EDocFeedback_fileId_key" ON "EDocFeedback"("fileId");

-- CreateIndex
CREATE UNIQUE INDEX "EDocFeedbackResponse_feedbackId_userId_key" ON "EDocFeedbackResponse"("feedbackId", "userId");

-- AddForeignKey
ALTER TABLE "EDocFolderCreator" ADD CONSTRAINT "EDocFolderCreator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EDocFolderCreator" ADD CONSTRAINT "EDocFolderCreator_assignedBy_fkey" FOREIGN KEY ("assignedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EDocDocumentApprover" ADD CONSTRAINT "EDocDocumentApprover_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EDocDocumentApprover" ADD CONSTRAINT "EDocDocumentApprover_assignedBy_fkey" FOREIGN KEY ("assignedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EDocFolder" ADD CONSTRAINT "EDocFolder_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EDocFolder" ADD CONSTRAINT "EDocFolder_parentFolderId_fkey" FOREIGN KEY ("parentFolderId") REFERENCES "EDocFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EDocFile" ADD CONSTRAINT "EDocFile_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "EDocFolder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EDocFile" ADD CONSTRAINT "EDocFile_obsoleteDestinationFolderId_fkey" FOREIGN KEY ("obsoleteDestinationFolderId") REFERENCES "EDocFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EDocFile" ADD CONSTRAINT "EDocFile_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "EDocCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EDocFile" ADD CONSTRAINT "EDocFile_categoryTypeId_fkey" FOREIGN KEY ("categoryTypeId") REFERENCES "EDocCategoryType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EDocFile" ADD CONSTRAINT "EDocFile_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EDocFile" ADD CONSTRAINT "EDocFile_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EDocFileRevisionLog" ADD CONSTRAINT "EDocFileRevisionLog_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "EDocFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EDocFileRevisionLog" ADD CONSTRAINT "EDocFileRevisionLog_replacedBy_fkey" FOREIGN KEY ("replacedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EDocCategoryType" ADD CONSTRAINT "EDocCategoryType_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "EDocCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EDocNumberFormat" ADD CONSTRAINT "EDocNumberFormat_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "EDocCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EDocNumberFormatSegment" ADD CONSTRAINT "EDocNumberFormatSegment_numberFormatId_fkey" FOREIGN KEY ("numberFormatId") REFERENCES "EDocNumberFormat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EDocImProduct" ADD CONSTRAINT "EDocImProduct_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "EDocFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EDocImProduct" ADD CONSTRAINT "EDocImProduct_importedBy_fkey" FOREIGN KEY ("importedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EDocFeedback" ADD CONSTRAINT "EDocFeedback_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "EDocFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EDocFeedback" ADD CONSTRAINT "EDocFeedback_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EDocFeedbackQuestion" ADD CONSTRAINT "EDocFeedbackQuestion_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "EDocFeedback"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EDocFeedbackResponse" ADD CONSTRAINT "EDocFeedbackResponse_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "EDocFeedback"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EDocFeedbackResponse" ADD CONSTRAINT "EDocFeedbackResponse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EDocFeedbackAnswer" ADD CONSTRAINT "EDocFeedbackAnswer_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "EDocFeedbackResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EDocFeedbackAnswer" ADD CONSTRAINT "EDocFeedbackAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "EDocFeedbackQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
