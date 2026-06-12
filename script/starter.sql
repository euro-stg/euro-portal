-- ============================================================
-- EUROPORTAL — STARTER SQL
-- Inisialisasi data awal untuk deployment production
--
-- Jalankan sekali saat pertama deploy, aman dijalankan ulang
-- (semua operasi idempotent — tidak akan duplikat data)
--
-- Employee ID : sa001
-- Password    : admin123  ← WAJIB DIGANTI setelah pertama login!
--
-- Generate hash password baru:
--   node -e "const b=require('bcryptjs'); b.hash('PASSWORD_BARU',12).then(h=>console.log(h))"
--
-- Cara run:
--   psql $DATABASE_URL -f script/starter.sql
-- ============================================================

WITH

  -- ── 1. Upsert user superadmin ─────────────────────────────────
  upserted_user AS (
    INSERT INTO "User" ("id", "employeeId", "name", "password", "status", "createdAt", "updatedAt")
    VALUES (
      gen_random_uuid(),
      'sa001',
      'Super Admin',
      '$2b$12$VmgEfClrmcZ8YJigshJ7ye7aRPVFL0vBN877pxAO5KtpucINcIqca',
      'active',
      NOW(), NOW()
    )
    ON CONFLICT ("employeeId") DO UPDATE
      SET "name"      = EXCLUDED."name",
          "password"  = EXCLUDED."password",
          "status"    = 'active',
          "updatedAt" = NOW()
    RETURNING id
  ),

  -- ── 2. Role superadmin (portal level, appId = null) ──────────
  inserted_role AS (
    INSERT INTO "Role" ("id", "name", "appId", "isLocked", "status", "createdAt")
    SELECT gen_random_uuid(), 'superadmin', NULL, true, 'active', NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM "Role" WHERE name = 'superadmin' AND "appId" IS NULL
    )
    RETURNING id
  ),

  role_id AS (
    SELECT id FROM inserted_role
    UNION ALL
    SELECT id FROM "Role" WHERE name = 'superadmin' AND "appId" IS NULL
    LIMIT 1
  ),

  -- ── 3. Assign role superadmin ke user ─────────────────────────
  assigned_role AS (
    INSERT INTO "UserRole" ("id", "userId", "roleId", "appId", "createdAt")
    SELECT gen_random_uuid(), u.id, r.id, NULL, NOW()
    FROM upserted_user u, role_id r
    WHERE NOT EXISTS (
      SELECT 1 FROM "UserRole" ur
      WHERE ur."userId" = u.id AND ur."appId" IS NULL
    )
    RETURNING id
  ),

  -- ── 4. Portal sidebar modules (type=module, appId=null) ──────
  --
  --  Superadmin melihat semua module aktif tanpa RoleModule.
  --  Dashboard tidak perlu karena hardcoded di sidebar sebagai "Beranda Portal".
  --
  portal_modules AS (
    INSERT INTO "Module" ("id", "name", "path", "icon", "color", "type", "group", "order", "status", "createdAt")
    SELECT gen_random_uuid(), v.name, v.path, v.icon, v.color, 'module', v.grp, v.ord, 'active', NOW()
    FROM (VALUES
      ('Master User',       '/user/list-user',     'Users',      NULL::text,  'Data Master', 1 ),
      ('Master Role',       '/role/list-role',     'Shield',     NULL::text,  'Data Master', 1 ),
      ('Master Module',     '/module/list-module', 'Package',    NULL::text,  'Data Master', 2 ),
      ('Master Approval',   '/approval/template',  'GitBranch',  NULL::text,  'Pengaturan',  3 ),
      ('Approval Saya',     '/approval/pending',   'CheckCheck', NULL::text,  'Approval',    1 ),
      ('App Token',         '/app-token',          'Key',        'amber',     'Pengaturan',  90),
      ('API Documentation', '/api-docs',           'BookOpen',   'teal',      'Pengaturan',  91)
    ) AS v(name, path, icon, color, grp, ord)
    WHERE NOT EXISTS (
      SELECT 1 FROM "Module" m WHERE m.path = v.path AND m."deletedAt" IS NULL
    )
    RETURNING id
  ),

  -- ── 5. App launcher: Software Development ────────────────────
  sd_app AS (
    INSERT INTO "Module" (
      "id", "name", "path", "icon", "color", "description",
      "type", "appId", "isExternal", "order", "status", "createdAt"
    )
    SELECT
      gen_random_uuid(),
      'Software Development', '/apps/software-development', 'Code2', 'blue',
      'Kelola pengajuan pengembangan aplikasi dan pantau progres',
      'app', NULL, false, 1, 'active', NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM "Module" WHERE path = '/apps/software-development' AND "deletedAt" IS NULL
    )
    RETURNING id
  ),

  sd_app_id AS (
    SELECT id FROM sd_app
    UNION ALL
    SELECT id FROM "Module" WHERE path = '/apps/software-development' AND type = 'app' AND "deletedAt" IS NULL
    LIMIT 1
  ),

  -- ── 6. SD App sub-modules (sidebar dalam app SD) ─────────────
  --
  --  Beranda path = /apps/software-development (sama dgn launcher tapi type=module, appId terisi)
  --  WHERE NOT EXISTS cek path + appId agar tidak konflik dengan launcher.
  --
  sd_submodules AS (
    INSERT INTO "Module" ("id", "name", "path", "icon", "color", "type", "appId", "group", "order", "status", "createdAt")
    SELECT gen_random_uuid(), v.name, v.path, v.icon, v.color, 'module', (SELECT id FROM sd_app_id), v.grp, v.ord, 'active', NOW()
    FROM (VALUES
      ('Beranda',         '/apps/software-development',                  'LayoutDashboard', 'blue',        NULL::text,    0),
      ('Pengajuan',       '/apps/software-development/requests',         'FileText',        NULL::text,    'Transaksi',   1),
      ('Approval Masuk',  '/apps/software-development/approval',         'Workflow',        'amber',       'Approval',    1),
      ('Master Approval', '/apps/software-development/approval/template','Settings2',       'slate',       'Pengaturan',  1)
    ) AS v(name, path, icon, color, grp, ord)
    WHERE NOT EXISTS (
      SELECT 1 FROM "Module" m
      WHERE m.path = v.path
        AND m."appId" = (SELECT id FROM sd_app_id)
        AND m."deletedAt" IS NULL
    )
    RETURNING id
  ),

  -- ── 7. App launchers lainnya ──────────────────────────────────
  other_apps AS (
    INSERT INTO "Module" (
      "id", "name", "path", "icon", "color", "description",
      "type", "appId", "isExternal", "externalUrl", "order", "status", "createdAt"
    )
    SELECT gen_random_uuid(), v.name, v.path, v.icon, v.color, v.dsc, 'app', NULL, v.ext, v.exturl, v.ord, 'active', NOW()
    FROM (VALUES
      (
        'Euro LMS',
        '/apps/euro-lms',
        'BookOpen',
        'emerald',
        'Akses kursus, ikuti pembelajaran, dan pantau progres belajar dengan mudah.',
        false,
        NULL::text,
        2
      ),
      (
        'Clinic Grading',
        '/apps/clinic-grading',
        'Scale',
        'orange',
        'Mendukung evaluasi dan pemeringkatan klinik berbasis indikator kinerja yang terstandarisasi.',
        true,
        'https://clinicgrading.com/sso',
        3
      ),
      (
        'Berita Acara',
        '/apps/berita-acara/',
        'FileText',
        'teal',
        'Kelola pembuatan, persetujuan, dan arsip berita acara secara digital dan terstruktur.',
        false,
        NULL::text,
        4
      ),
      (
        'ID QMS Generator',
        '/apps/id-qms-generator/',
        NULL::text,
        'indigo',
        'Menghasilkan ID dokumen QMS secara otomatis untuk mendukung pengelolaan dokumen yang konsisten dan terstandarisasi.',
        false,
        NULL::text,
        5
      )
    ) AS v(name, path, icon, color, dsc, ext, exturl, ord)
    WHERE NOT EXISTS (
      SELECT 1 FROM "Module" m WHERE m.path = v.path AND m."deletedAt" IS NULL
    )
    RETURNING id
  )

-- ── Hasil eksekusi ────────────────────────────────────────────
SELECT
  (SELECT COUNT(*) FROM upserted_user)   AS user_upserted,
  (SELECT COUNT(*) FROM inserted_role)   AS role_created,
  (SELECT COUNT(*) FROM assigned_role)   AS userrole_assigned,
  (SELECT COUNT(*) FROM portal_modules)  AS portal_modules_inserted,
  (SELECT COUNT(*) FROM sd_app)          AS sd_app_inserted,
  (SELECT COUNT(*) FROM sd_submodules)   AS sd_submodules_inserted,
  (SELECT COUNT(*) FROM other_apps)      AS other_apps_inserted;
