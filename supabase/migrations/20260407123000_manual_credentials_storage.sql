-- Adds secure temporary credential storage for manual account handover.
ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "temporary_password_encrypted" TEXT;

-- Optional tracking status values used by admin provisioning flow.
-- Existing rows remain valid; this only normalizes legacy nulls when present.
UPDATE "User"
SET "credentials_email_status" = 'MANUAL_HANDOVER_PENDING'
WHERE "credentials_email_status" IS NULL
  AND "first_login" = true
  AND "role" IN ('STUDENT', 'WARDEN');
