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
    "role" TEXT NOT NULL DEFAULT 'user',
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
CREATE TABLE "Authenticator" (
    "credentialID" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "credentialPublicKey" TEXT NOT NULL,
    "counter" INTEGER NOT NULL,
    "credentialDeviceType" TEXT NOT NULL,
    "credentialBackedUp" BOOLEAN NOT NULL,
    "transports" TEXT,

    CONSTRAINT "Authenticator_pkey" PRIMARY KEY ("userId","credentialID")
);

-- CreateTable
CREATE TABLE "UserPageAccess" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPageAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pages" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "disabledBy" TEXT,
    "status" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "disabledAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "ApprovalTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "appType" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ApprovalTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalTemplateStep" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "approverRoleId" TEXT NOT NULL,

    CONSTRAINT "ApprovalTemplateStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalRequest" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "appType" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "submittedBy" TEXT NOT NULL,
    "currentStep" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalRequestStep" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "approverRoleId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT,
    "note" TEXT,
    "actionAt" TIMESTAMP(3),

    CONSTRAINT "ApprovalRequestStep_pkey" PRIMARY KEY ("id")
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

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
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
CREATE UNIQUE INDEX "Authenticator_credentialID_key" ON "Authenticator"("credentialID");

-- CreateIndex
CREATE UNIQUE INDEX "UserPageAccess_userId_pageId_key" ON "UserPageAccess"("userId", "pageId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "RoleModule_roleId_moduleId_key" ON "RoleModule"("roleId", "moduleId");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalTemplateStep_templateId_order_key" ON "ApprovalTemplateStep"("templateId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalRequestStep_requestId_order_key" ON "ApprovalRequestStep"("requestId", "order");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Authenticator" ADD CONSTRAINT "Authenticator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPageAccess" ADD CONSTRAINT "UserPageAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPageAccess" ADD CONSTRAINT "UserPageAccess_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleModule" ADD CONSTRAINT "RoleModule_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleModule" ADD CONSTRAINT "RoleModule_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalTemplateStep" ADD CONSTRAINT "ApprovalTemplateStep_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ApprovalTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalTemplateStep" ADD CONSTRAINT "ApprovalTemplateStep_approverRoleId_fkey" FOREIGN KEY ("approverRoleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ApprovalTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_submittedBy_fkey" FOREIGN KEY ("submittedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequestStep" ADD CONSTRAINT "ApprovalRequestStep_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ApprovalRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequestStep" ADD CONSTRAINT "ApprovalRequestStep_approverRoleId_fkey" FOREIGN KEY ("approverRoleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequestStep" ADD CONSTRAINT "ApprovalRequestStep_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
