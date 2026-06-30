-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "name" TEXT,
    "password" TEXT,
    "joinDate" TIMESTAMP(3),
    "resignDate" TIMESTAMP(3),
    "status" TEXT,
    "organizationId" TEXT,
    "organizationName" TEXT,
    "jobPositionId" TEXT,
    "jobPositionName" TEXT,
    "branchId" TEXT,
    "branchName" TEXT,
    "age" INTEGER,
    "image" TEXT,
    "talentaImageKey" TEXT,
    "phone" TEXT,
    "mobilePhone" TEXT,
    "email" TEXT,
    "lastName" TEXT,
    "gender" TEXT,
    "birthPlace" TEXT,
    "birthDate" TIMESTAMP(3),
    "address" TEXT,
    "religion" TEXT,
    "bloodType" TEXT,
    "maritalStatus" TEXT,
    "identityType" TEXT,
    "identityNumber" TEXT,
    "jobLevel" TEXT,
    "employmentStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refreshToken" TEXT,
    "accessToken" TEXT,
    "expiresAt" INTEGER,
    "tokenType" TEXT,
    "scope" TEXT,
    "idToken" TEXT,
    "sessionState" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "appId" TEXT,
    "description" TEXT,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "appId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Module" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "icon" TEXT,
    "color" TEXT,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'module',
    "appId" TEXT,
    "isExternal" BOOLEAN NOT NULL DEFAULT false,
    "externalUrl" TEXT,
    "group" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Module_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleModule" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,

    CONSTRAINT "RoleModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SdRequest" (
    "id" TEXT NOT NULL,
    "requestNo" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "refAppId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "picId" TEXT,
    "estimatedCompletedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SdRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SdItDocument" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "SdItDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SdProgress" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "SdProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SdEnvironment" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "username" TEXT,
    "password" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SdEnvironment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SdUat" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "note" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "SdUat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SdAttachment" (
    "id" TEXT NOT NULL,
    "requestId" TEXT,
    "itDocId" TEXT,
    "uatRevisionId" TEXT,
    "category" TEXT NOT NULL DEFAULT 'REQUEST',
    "name" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "mimeType" TEXT,
    "size" INTEGER,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SdAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SdUatRevision" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "iteration" INTEGER NOT NULL,
    "note" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SdUatRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SdActivity" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SdActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SdApprovalTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SdApprovalTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SdApprovalTemplateStep" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "step" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "jobPositionId" TEXT,
    "jobPositionName" TEXT,
    "organizationId" TEXT,
    "organizationName" TEXT,
    "branchId" TEXT,
    "branchName" TEXT,

    CONSTRAINT "SdApprovalTemplateStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SdApprovalRequest" (
    "id" TEXT NOT NULL,
    "sdRequestId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "submittedBy" TEXT NOT NULL,
    "currentStep" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "templateId" TEXT NOT NULL,

    CONSTRAINT "SdApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SdApprovalRequestStep" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "step" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "jobPositionId" TEXT,
    "jobPositionName" TEXT,
    "organizationId" TEXT,
    "organizationName" TEXT,
    "branchId" TEXT,
    "branchName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "actorId" TEXT,
    "note" TEXT,
    "actedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SdApprovalRequestStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "refId" TEXT,
    "appType" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppTokenRole" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "AppTokenRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppToken" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "token" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "moduleId" TEXT,
    "roleId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "AppToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SsoSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "appTokenId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SsoSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiLog" (
    "id" TEXT NOT NULL,
    "appTokenId" TEXT,
    "appName" TEXT,
    "userId" TEXT,
    "method" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "statusCode" INTEGER,
    "reason" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "duration" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentBranchId" TEXT,
    "address" TEXT,
    "regencyName" TEXT,
    "provinceName" TEXT,
    "postalCode" INTEGER,
    "phone" TEXT,
    "faxNumber" TEXT,
    "kluCode" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobPosition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER,
    "description" TEXT,
    "parentJobId" TEXT,
    "branchId" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobPosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncLog" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'user',
    "trigger" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "processed" INTEGER,
    "created" INTEGER,
    "updated" INTEGER,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "SyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemConfig" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "SsdCategory" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hasDraft" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SsdCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SsdDepartment" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SsdDepartment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SsdCounter" (
    "id" TEXT NOT NULL,
    "categoryCode" TEXT NOT NULL,
    "companyCode" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "seq" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SsdCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SsdLetter" (
    "id" TEXT NOT NULL,
    "letterNo" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "fileDraft" TEXT,
    "fileFinal" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SsdLetter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SsdApprovalTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SsdApprovalTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SsdApprovalTemplateStep" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "step" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "jobPositionId" TEXT,
    "jobPositionName" TEXT,
    "organizationId" TEXT,
    "organizationName" TEXT,
    "branchId" TEXT,
    "branchName" TEXT,

    CONSTRAINT "SsdApprovalTemplateStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SsdApproval" (
    "id" TEXT NOT NULL,
    "letterId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "submittedBy" TEXT NOT NULL,
    "currentStep" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "templateId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "SsdApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SsdApprovalStep" (
    "id" TEXT NOT NULL,
    "approvalId" TEXT NOT NULL,
    "step" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "jobPositionId" TEXT,
    "jobPositionName" TEXT,
    "organizationId" TEXT,
    "organizationName" TEXT,
    "branchId" TEXT,
    "branchName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "actorId" TEXT,
    "note" TEXT,
    "actedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SsdApprovalStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SsdActivity" (
    "id" TEXT NOT NULL,
    "letterId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SsdActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SsoRedirectToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "appTokenId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SsoRedirectToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_employeeId_key" ON "User"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_appId_key" ON "Role"("name", "appId");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_roleId_key" ON "UserRole"("userId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_appId_key" ON "UserRole"("userId", "appId");

-- CreateIndex
CREATE UNIQUE INDEX "RoleModule_roleId_moduleId_key" ON "RoleModule"("roleId", "moduleId");

-- CreateIndex
CREATE UNIQUE INDEX "SdRequest_requestNo_key" ON "SdRequest"("requestNo");

-- CreateIndex
CREATE UNIQUE INDEX "SdItDocument_requestId_key" ON "SdItDocument"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "SdUat_requestId_key" ON "SdUat"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "SdApprovalTemplateStep_templateId_step_key" ON "SdApprovalTemplateStep"("templateId", "step");

-- CreateIndex
CREATE UNIQUE INDEX "SdApprovalRequest_sdRequestId_key" ON "SdApprovalRequest"("sdRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "SdApprovalRequestStep_requestId_step_key" ON "SdApprovalRequestStep"("requestId", "step");

-- CreateIndex
CREATE UNIQUE INDEX "AppTokenRole_name_key" ON "AppTokenRole"("name");

-- CreateIndex
CREATE UNIQUE INDEX "AppToken_token_key" ON "AppToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "AppToken_moduleId_key" ON "AppToken"("moduleId");

-- CreateIndex
CREATE UNIQUE INDEX "SsoSession_token_key" ON "SsoSession"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Company_code_key" ON "Company"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_token_key" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "SsdCategory_code_key" ON "SsdCategory"("code");

-- CreateIndex
CREATE UNIQUE INDEX "SsdDepartment_code_key" ON "SsdDepartment"("code");

-- CreateIndex
CREATE UNIQUE INDEX "SsdCounter_categoryCode_companyCode_year_key" ON "SsdCounter"("categoryCode", "companyCode", "year");

-- CreateIndex
CREATE UNIQUE INDEX "SsdLetter_letterNo_key" ON "SsdLetter"("letterNo");

-- CreateIndex
CREATE UNIQUE INDEX "SsdApprovalTemplateStep_templateId_step_key" ON "SsdApprovalTemplateStep"("templateId", "step");

-- CreateIndex
CREATE UNIQUE INDEX "SsdApproval_letterId_key" ON "SsdApproval"("letterId");

-- CreateIndex
CREATE UNIQUE INDEX "SsdApprovalStep_approvalId_step_key" ON "SsdApprovalStep"("approvalId", "step");

-- CreateIndex
CREATE INDEX "EmailLog_createdAt_idx" ON "EmailLog"("createdAt");

-- CreateIndex
CREATE INDEX "EmailLog_status_idx" ON "EmailLog"("status");

-- CreateIndex
CREATE INDEX "EmailLog_source_idx" ON "EmailLog"("source");

-- CreateIndex
CREATE UNIQUE INDEX "SsoRedirectToken_token_key" ON "SsoRedirectToken"("token");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Module" ADD CONSTRAINT "Module_appId_fkey" FOREIGN KEY ("appId") REFERENCES "Module"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleModule" ADD CONSTRAINT "RoleModule_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleModule" ADD CONSTRAINT "RoleModule_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SdRequest" ADD CONSTRAINT "SdRequest_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SdRequest" ADD CONSTRAINT "SdRequest_picId_fkey" FOREIGN KEY ("picId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SdRequest" ADD CONSTRAINT "SdRequest_refAppId_fkey" FOREIGN KEY ("refAppId") REFERENCES "Module"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SdItDocument" ADD CONSTRAINT "SdItDocument_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "SdRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SdItDocument" ADD CONSTRAINT "SdItDocument_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SdItDocument" ADD CONSTRAINT "SdItDocument_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SdProgress" ADD CONSTRAINT "SdProgress_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "SdRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SdEnvironment" ADD CONSTRAINT "SdEnvironment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "SdRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SdUat" ADD CONSTRAINT "SdUat_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "SdRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SdUat" ADD CONSTRAINT "SdUat_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SdAttachment" ADD CONSTRAINT "SdAttachment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "SdRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SdAttachment" ADD CONSTRAINT "SdAttachment_itDocId_fkey" FOREIGN KEY ("itDocId") REFERENCES "SdItDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SdAttachment" ADD CONSTRAINT "SdAttachment_uatRevisionId_fkey" FOREIGN KEY ("uatRevisionId") REFERENCES "SdUatRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SdAttachment" ADD CONSTRAINT "SdAttachment_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SdUatRevision" ADD CONSTRAINT "SdUatRevision_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "SdRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SdUatRevision" ADD CONSTRAINT "SdUatRevision_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SdActivity" ADD CONSTRAINT "SdActivity_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "SdRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SdActivity" ADD CONSTRAINT "SdActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SdApprovalTemplateStep" ADD CONSTRAINT "SdApprovalTemplateStep_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SdApprovalTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SdApprovalRequest" ADD CONSTRAINT "SdApprovalRequest_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SdApprovalTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SdApprovalRequest" ADD CONSTRAINT "SdApprovalRequest_submittedBy_fkey" FOREIGN KEY ("submittedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SdApprovalRequest" ADD CONSTRAINT "SdApprovalRequest_sdRequestId_fkey" FOREIGN KEY ("sdRequestId") REFERENCES "SdRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SdApprovalRequestStep" ADD CONSTRAINT "SdApprovalRequestStep_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "SdApprovalRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SdApprovalRequestStep" ADD CONSTRAINT "SdApprovalRequestStep_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppToken" ADD CONSTRAINT "AppToken_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppToken" ADD CONSTRAINT "AppToken_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppToken" ADD CONSTRAINT "AppToken_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "AppTokenRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsoSession" ADD CONSTRAINT "SsoSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsoSession" ADD CONSTRAINT "SsoSession_appTokenId_fkey" FOREIGN KEY ("appTokenId") REFERENCES "AppToken"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiLog" ADD CONSTRAINT "ApiLog_appTokenId_fkey" FOREIGN KEY ("appTokenId") REFERENCES "AppToken"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsdLetter" ADD CONSTRAINT "SsdLetter_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "SsdCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsdLetter" ADD CONSTRAINT "SsdLetter_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "SsdDepartment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsdLetter" ADD CONSTRAINT "SsdLetter_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsdLetter" ADD CONSTRAINT "SsdLetter_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsdApprovalTemplateStep" ADD CONSTRAINT "SsdApprovalTemplateStep_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SsdApprovalTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsdApproval" ADD CONSTRAINT "SsdApproval_letterId_fkey" FOREIGN KEY ("letterId") REFERENCES "SsdLetter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsdApproval" ADD CONSTRAINT "SsdApproval_submittedBy_fkey" FOREIGN KEY ("submittedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsdApproval" ADD CONSTRAINT "SsdApproval_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SsdApprovalTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsdApprovalStep" ADD CONSTRAINT "SsdApprovalStep_approvalId_fkey" FOREIGN KEY ("approvalId") REFERENCES "SsdApproval"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsdApprovalStep" ADD CONSTRAINT "SsdApprovalStep_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsdActivity" ADD CONSTRAINT "SsdActivity_letterId_fkey" FOREIGN KEY ("letterId") REFERENCES "SsdLetter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsdActivity" ADD CONSTRAINT "SsdActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsoRedirectToken" ADD CONSTRAINT "SsoRedirectToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsoRedirectToken" ADD CONSTRAINT "SsoRedirectToken_appTokenId_fkey" FOREIGN KEY ("appTokenId") REFERENCES "AppToken"("id") ON DELETE CASCADE ON UPDATE CASCADE;
