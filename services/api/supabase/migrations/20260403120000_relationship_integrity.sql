-- Relationship integrity hardening
-- Adds nullable FK constraints and supporting indexes for reviewer/assignee/payment audit fields.
-- Uses ON DELETE SET NULL to preserve existing records if referenced users are removed.

CREATE INDEX IF NOT EXISTS "NightLeaveRequest_reviewed_by_idx"
ON "NightLeaveRequest" ("reviewed_by");

CREATE INDEX IF NOT EXISTS "GuestRequest_reviewed_by_idx"
ON "GuestRequest" ("reviewed_by");

CREATE INDEX IF NOT EXISTS "MissingReport_reviewed_by_idx"
ON "MissingReport" ("reviewed_by");

CREATE INDEX IF NOT EXISTS "Payment_recorded_by_idx"
ON "Payment" ("recorded_by");

CREATE INDEX IF NOT EXISTS "MaintenanceRequest_assigned_to_idx"
ON "MaintenanceRequest" ("assigned_to");

CREATE INDEX IF NOT EXISTS "HousekeepingRequest_assigned_to_idx"
ON "HousekeepingRequest" ("assigned_to");

ALTER TABLE "NightLeaveRequest"
DROP CONSTRAINT IF EXISTS "NightLeaveRequest_reviewed_by_fkey";
ALTER TABLE "NightLeaveRequest"
ADD CONSTRAINT "NightLeaveRequest_reviewed_by_fkey"
FOREIGN KEY ("reviewed_by") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "GuestRequest"
DROP CONSTRAINT IF EXISTS "GuestRequest_reviewed_by_fkey";
ALTER TABLE "GuestRequest"
ADD CONSTRAINT "GuestRequest_reviewed_by_fkey"
FOREIGN KEY ("reviewed_by") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MissingReport"
DROP CONSTRAINT IF EXISTS "MissingReport_reviewed_by_fkey";
ALTER TABLE "MissingReport"
ADD CONSTRAINT "MissingReport_reviewed_by_fkey"
FOREIGN KEY ("reviewed_by") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Payment"
DROP CONSTRAINT IF EXISTS "Payment_recorded_by_fkey";
ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_recorded_by_fkey"
FOREIGN KEY ("recorded_by") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MaintenanceRequest"
DROP CONSTRAINT IF EXISTS "MaintenanceRequest_assigned_to_fkey";
ALTER TABLE "MaintenanceRequest"
ADD CONSTRAINT "MaintenanceRequest_assigned_to_fkey"
FOREIGN KEY ("assigned_to") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "HousekeepingRequest"
DROP CONSTRAINT IF EXISTS "HousekeepingRequest_assigned_to_fkey";
ALTER TABLE "HousekeepingRequest"
ADD CONSTRAINT "HousekeepingRequest_assigned_to_fkey"
FOREIGN KEY ("assigned_to") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
