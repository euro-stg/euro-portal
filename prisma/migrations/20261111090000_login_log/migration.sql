-- Statistik login (2026-11-11)
ALTER TABLE "User" ADD COLUMN "lastLoginAt" TIMESTAMP(3),
ADD COLUMN "loginCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "LoginLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "employeeId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "appName" TEXT,
    "success" BOOLEAN NOT NULL,
    "reason" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LoginLog_userId_createdAt_idx" ON "LoginLog"("userId", "createdAt");
CREATE INDEX "LoginLog_createdAt_idx" ON "LoginLog"("createdAt");

ALTER TABLE "LoginLog" ADD CONSTRAINT "LoginLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill "terakhir login" dari jejak yang sudah ada: sesi portal yang masih tersimpan, sesi &
-- redirect SSO, dan ApiLog SSO yang berhasil. Perkiraan minimal — user yang sudah logout dan
-- tidak memakai SSO tidak meninggalkan jejak.
UPDATE "User" u SET "lastLoginAt" = x.t
FROM (
  SELECT "userId", MAX("createdAt") AS t FROM (
    SELECT "userId", "createdAt" FROM "Session"
    UNION ALL SELECT "userId", "createdAt" FROM "SsoSession"
    UNION ALL SELECT "userId", "createdAt" FROM "SsoRedirectToken"
    UNION ALL SELECT "userId", "createdAt" FROM "ApiLog" WHERE "status" = 'SUCCESS' AND "userId" IS NOT NULL
  ) a GROUP BY "userId"
) x
WHERE x."userId" = u."id";
