-- Phase 2 governance migration
-- 1) Add strict department enum and convert Student.department
-- 2) Deactivate unsupported legacy roles (retain records)
-- 3) Enforce single-admin policy at DB level

DO $$
BEGIN
  CREATE TYPE "Department" AS ENUM (
    'COMPUTER_ENGINEERING',
    'COMPUTER_ENGINEERING_REGIONAL',
    'AIML',
    'ENTC',
    'CIVIL',
    'IT',
    'ARCHITECTURE',
    'DIPLOMA'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Student"
ADD COLUMN IF NOT EXISTS "department_v2" "Department";

UPDATE "Student"
SET "department_v2" = (
  CASE UPPER(COALESCE("department", ''))
    WHEN 'COMPSCI' THEN 'COMPUTER_ENGINEERING'
    WHEN 'COMPUTER ENGINEERING' THEN 'COMPUTER_ENGINEERING'
    WHEN 'COMPUTER_ENGINEERING' THEN 'COMPUTER_ENGINEERING'
    WHEN 'COMPUTER ENGINEERING REGIONAL' THEN 'COMPUTER_ENGINEERING_REGIONAL'
    WHEN 'COMPUTER_ENGINEERING_REGIONAL' THEN 'COMPUTER_ENGINEERING_REGIONAL'
    WHEN 'AIML' THEN 'AIML'
    WHEN 'ENTC' THEN 'ENTC'
    WHEN 'CIVIL' THEN 'CIVIL'
    WHEN 'IT' THEN 'IT'
    WHEN 'ARCHITECTURE' THEN 'ARCHITECTURE'
    WHEN 'DIPLOMA' THEN 'DIPLOMA'
    ELSE 'COMPUTER_ENGINEERING'
  END
)::"Department";

ALTER TABLE "Student"
DROP COLUMN IF EXISTS "department";

ALTER TABLE "Student"
RENAME COLUMN "department_v2" TO "department";

ALTER TABLE "Student"
ALTER COLUMN "department" SET NOT NULL;

UPDATE "User"
SET "is_active" = false
WHERE "role" IN (
  'DOCTOR',
  'MESS_MANAGER',
  'MAINTENANCE_STAFF',
  'HOUSEKEEPING_STAFF',
  'SECURITY_GUARD'
)
AND "is_active" = true;

ALTER TABLE "User"
DROP CONSTRAINT IF EXISTS "user_supported_roles_active_chk";

ALTER TABLE "User"
ADD CONSTRAINT "user_supported_roles_active_chk"
CHECK (
  "role" IN ('ADMIN', 'STUDENT', 'WARDEN')
  OR "is_active" = false
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_single_admin_role_idx"
ON "User" ("role")
WHERE "role" = 'ADMIN';
