-- EDocFile.businessUnitCode (single) -> businessUnitCodes (array); branchId (single) ->
-- branchIds (array). A file can legitimately belong to more than one Business Unit/Branch.
-- Existing single values are preserved by wrapping them in a 1-element array (NULL -> {}).
ALTER TABLE "EDocFile" ADD COLUMN "businessUnitCodes" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "EDocFile" ADD COLUMN "branchIds" TEXT[] NOT NULL DEFAULT '{}';

UPDATE "EDocFile"
SET "businessUnitCodes" = ARRAY["businessUnitCode"]
WHERE "businessUnitCode" IS NOT NULL;

UPDATE "EDocFile"
SET "branchIds" = ARRAY["branchId"]
WHERE "branchId" IS NOT NULL;

ALTER TABLE "EDocFile" DROP COLUMN "businessUnitCode";
ALTER TABLE "EDocFile" DROP COLUMN "branchId";

-- requiresNumber now defaults to true for new rows (existing rows keep whatever value
-- they already have — not force-migrated).
ALTER TABLE "EDocFile" ALTER COLUMN "requiresNumber" SET DEFAULT true;
