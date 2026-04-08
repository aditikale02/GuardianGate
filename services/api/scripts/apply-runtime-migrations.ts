import "../src/config/env.config";
import { prisma } from "../src/prisma";

const statements = [
  `
  DO $$
  BEGIN
    IF EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'User_role_key'
    ) THEN
      ALTER TABLE "User" DROP CONSTRAINT "User_role_key";
    END IF;
  EXCEPTION
    WHEN undefined_table THEN NULL;
    WHEN undefined_object THEN NULL;
  END $$;
  `,
  `DROP INDEX IF EXISTS "User_role_key";`,
  `
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
  `,
  `
  DO $$
  BEGIN
    CREATE TYPE "MissingReportStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'FOUND', 'CLOSED');
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END $$;
  `,
  `
  CREATE TABLE IF NOT EXISTS "MissingReport" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT,
    "last_seen_at" TIMESTAMP(3),
    "image_url" TEXT,
    "status" "MissingReportStatus" NOT NULL DEFAULT 'OPEN',
    "resolution_notes" TEXT,
    "reviewed_by" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MissingReport_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MissingReport_student_id_fkey"
      FOREIGN KEY ("student_id") REFERENCES "Student"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE
  );
  `,
  `CREATE INDEX IF NOT EXISTS "MissingReport_student_id_idx" ON "MissingReport"("student_id");`,
  `CREATE INDEX IF NOT EXISTS "MissingReport_status_idx" ON "MissingReport"("status");`,
  `CREATE INDEX IF NOT EXISTS "MissingReport_created_at_idx" ON "MissingReport"("created_at");`,
  `ALTER TABLE "EntryExitLog" ADD COLUMN IF NOT EXISTS "scan_date" DATE;`,
  `ALTER TABLE "EntryExitLog" ADD COLUMN IF NOT EXISTS "scan_time" TEXT;`,
  `ALTER TABLE "EntryExitLog" ADD COLUMN IF NOT EXISTS "qr_generated_at" TIMESTAMP(3);`,
  `ALTER TABLE "EntryExitLog" ADD COLUMN IF NOT EXISTS "qr_expires_at" TIMESTAMP(3);`,
  `ALTER TABLE "EntryExitLog" ADD COLUMN IF NOT EXISTS "verified_by_user_id" TEXT;`,
  `ALTER TABLE "EntryExitLog" ADD COLUMN IF NOT EXISTS "verified_by_role" "Role";`,
  `ALTER TABLE "EntryExitLog" ADD COLUMN IF NOT EXISTS "remarks" TEXT;`,
  `ALTER TABLE "EntryExitLog" ADD COLUMN IF NOT EXISTS "allowed_time" TEXT;`,
  `ALTER TABLE "EntryExitLog" ADD COLUMN IF NOT EXISTS "actual_scanned_time" TEXT;`,
  `ALTER TABLE "EntryExitLog" ADD COLUMN IF NOT EXISTS "is_late" BOOLEAN NOT NULL DEFAULT false;`,
  `ALTER TABLE "EntryExitLog" ADD COLUMN IF NOT EXISTS "is_flagged" BOOLEAN NOT NULL DEFAULT false;`,
  `ALTER TABLE "EntryExitLog" ADD COLUMN IF NOT EXISTS "late_reason" TEXT;`,
  `ALTER TABLE "EntryExitLog" ADD COLUMN IF NOT EXISTS "student_name_snapshot" TEXT;`,
  `ALTER TABLE "EntryExitLog" ADD COLUMN IF NOT EXISTS "enrollment_no_snapshot" TEXT;`,
  `ALTER TABLE "EntryExitLog" ADD COLUMN IF NOT EXISTS "hostel_id_snapshot" TEXT;`,
  `ALTER TABLE "EntryExitLog" ADD COLUMN IF NOT EXISTS "floor_number_snapshot" INTEGER;`,
  `ALTER TABLE "EntryExitLog" ADD COLUMN IF NOT EXISTS "room_number_snapshot" TEXT;`,
  `
  DO $$
  BEGIN
    ALTER TABLE "EntryExitLog"
      ADD CONSTRAINT "EntryExitLog_verified_by_user_id_fkey"
      FOREIGN KEY ("verified_by_user_id") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END $$;
  `,
  `CREATE INDEX IF NOT EXISTS "EntryExitLog_scan_date_idx" ON "EntryExitLog"("scan_date");`,
  `CREATE INDEX IF NOT EXISTS "EntryExitLog_is_late_idx" ON "EntryExitLog"("is_late");`,
  `CREATE INDEX IF NOT EXISTS "EntryExitLog_is_flagged_idx" ON "EntryExitLog"("is_flagged");`,
  `CREATE INDEX IF NOT EXISTS "EntryExitLog_verified_by_user_id_idx" ON "EntryExitLog"("verified_by_user_id");`,
  `CREATE INDEX IF NOT EXISTS "EntryExitLog_enrollment_no_snapshot_idx" ON "EntryExitLog"("enrollment_no_snapshot");`,
  `CREATE INDEX IF NOT EXISTS "EntryExitLog_hostel_id_snapshot_idx" ON "EntryExitLog"("hostel_id_snapshot");`,
  `CREATE INDEX IF NOT EXISTS "EntryExitLog_room_number_snapshot_idx" ON "EntryExitLog"("room_number_snapshot");`,
  `
  CREATE TABLE IF NOT EXISTS "MessTimetable" (
    "id" TEXT NOT NULL,
    "week_start_date" DATE NOT NULL,
    "structured_menu" JSONB NOT NULL,
    "image_url" TEXT,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MessTimetable_pkey" PRIMARY KEY ("id")
  );
  `,
  `CREATE UNIQUE INDEX IF NOT EXISTS "MessTimetable_week_start_date_key" ON "MessTimetable"("week_start_date");`,
  `CREATE INDEX IF NOT EXISTS "MessTimetable_week_start_date_idx" ON "MessTimetable"("week_start_date");`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "last_login_at" TIMESTAMP(3);`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "created_by_admin_id" TEXT;`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "temporary_password_issued_at" TIMESTAMP(3);`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "credentials_emailed_at" TIMESTAMP(3);`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "credentials_email_status" TEXT;`,
  `ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "course_branch" TEXT;`,
  `ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "hostel_joining_date" TIMESTAMP(3);`,
  `ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "assigned_warden_id" TEXT;`,
  `ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "mess_plan_enabled" BOOLEAN NOT NULL DEFAULT true;`,
  `ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "id_proof_url" TEXT;`,
  `ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "gate_pass_id" TEXT;`,
  `ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "qr_gate_id" TEXT;`,
  `ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "leave_balance" INTEGER NOT NULL DEFAULT 15;`,
  `ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "medical_notes" TEXT;`,
  `
  DO $$
  BEGIN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'Student'
        AND column_name = 'department'
        AND udt_name <> 'Department'
    ) THEN
      ALTER TABLE "Student"
      ALTER COLUMN "department" TYPE "Department"
      USING (
        CASE
          WHEN "department"::text IN ('Computer Engineering', 'COMPUTER_ENGINEERING') THEN 'COMPUTER_ENGINEERING'::"Department"
          WHEN "department"::text IN ('Computer Engineering Regional', 'COMPUTER_ENGINEERING_REGIONAL') THEN 'COMPUTER_ENGINEERING_REGIONAL'::"Department"
          WHEN "department"::text = 'AIML' THEN 'AIML'::"Department"
          WHEN "department"::text = 'ENTC' THEN 'ENTC'::"Department"
          WHEN "department"::text = 'Civil' OR "department"::text = 'CIVIL' THEN 'CIVIL'::"Department"
          WHEN "department"::text = 'IT' THEN 'IT'::"Department"
          WHEN "department"::text = 'Architecture' OR "department"::text = 'ARCHITECTURE' THEN 'ARCHITECTURE'::"Department"
          WHEN "department"::text = 'Diploma' OR "department"::text = 'DIPLOMA' THEN 'DIPLOMA'::"Department"
          ELSE 'COMPUTER_ENGINEERING'::"Department"
        END
      );
    END IF;
  EXCEPTION
    WHEN undefined_column THEN NULL;
    WHEN undefined_table THEN NULL;
  END $$;
  `,
  `
  DO $$
  BEGIN
    ALTER TABLE "Student"
      ADD CONSTRAINT "Student_assigned_warden_id_fkey"
      FOREIGN KEY ("assigned_warden_id") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END $$;
  `,
  `CREATE INDEX IF NOT EXISTS "Student_assigned_warden_id_idx" ON "Student"("assigned_warden_id");`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Student_gate_pass_id_key" ON "Student"("gate_pass_id");`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Student_qr_gate_id_key" ON "Student"("qr_gate_id");`,
  `
  DO $$
  BEGIN
    CREATE TYPE "ShiftTiming" AS ENUM ('DAY', 'NIGHT', 'BOTH');
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END $$;
  `,
  `
  CREATE TABLE IF NOT EXISTS "WardenProfile" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "warden_id" TEXT NOT NULL,
    "alternate_phone" TEXT,
    "gender" TEXT,
    "assigned_hostel" TEXT NOT NULL,
    "assigned_block" TEXT,
    "assigned_floor" TEXT,
    "shift_timing" "ShiftTiming" NOT NULL DEFAULT 'DAY',
    "joining_date" TIMESTAMP(3),
    "experience_years" INTEGER,
    "can_approve_leave" BOOLEAN NOT NULL DEFAULT true,
    "can_manage_guest_entries" BOOLEAN NOT NULL DEFAULT true,
    "can_manage_parcel_requests" BOOLEAN NOT NULL DEFAULT true,
    "can_access_student_records" BOOLEAN NOT NULL DEFAULT true,
    "can_send_notices" BOOLEAN NOT NULL DEFAULT true,
    "can_handle_medical_requests" BOOLEAN NOT NULL DEFAULT true,
    "profile_photo_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WardenProfile_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WardenProfile_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "User"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE
  );
  `,
  `CREATE UNIQUE INDEX IF NOT EXISTS "WardenProfile_user_id_key" ON "WardenProfile"("user_id");`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "WardenProfile_warden_id_key" ON "WardenProfile"("warden_id");`,
  `CREATE INDEX IF NOT EXISTS "WardenProfile_assigned_hostel_idx" ON "WardenProfile"("assigned_hostel");`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "temporary_password_encrypted" TEXT;`,
  `CREATE INDEX IF NOT EXISTS "User_created_by_admin_id_idx" ON "User"("created_by_admin_id");`,
];

const run = async () => {
  try {
    await prisma.$connect();
    for (const statement of statements) {
      await prisma.$executeRawUnsafe(statement);
    }
    console.log("Runtime migrations applied successfully.");
  } catch (error) {
    console.error("Failed to apply runtime migrations:", error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
};

void run();
