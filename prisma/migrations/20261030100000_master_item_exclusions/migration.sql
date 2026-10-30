-- Master Item: pengecualian company/business (2026-10-30). Isian awal — bisa diubah di
-- Pengaturan → ERP. Company yang sudah tidak dipakai & business SEMPVRNA tidak masuk Master Item.
INSERT INTO "SystemConfig" ("key", "value", "updatedAt") VALUES
  ('erp.exclude.companies', '["DMI","SKIN+ MBS","SLIM+","Euromedica Group"]', CURRENT_TIMESTAMP),
  ('erp.exclude.businesses', '["SEMPVRNA"]', CURRENT_TIMESTAMP),
  ('erp.exclude.noCompany', 'true', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

-- Hapus item yang sudah terlanjur masuk dari company/business tersebut.
DELETE FROM "MasterItem"
WHERE "company" IS NULL
   OR "company" IN ('DMI', 'SKIN+ MBS', 'SLIM+', 'Euromedica Group')
   OR "business" IN ('SEMPVRNA');
