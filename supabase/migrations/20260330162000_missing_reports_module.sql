-- Missing reports module

DO $$
BEGIN
  CREATE TYPE "MissingReportStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'FOUND', 'CLOSED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

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

CREATE INDEX IF NOT EXISTS "MissingReport_student_id_idx" ON "MissingReport"("student_id");
CREATE INDEX IF NOT EXISTS "MissingReport_status_idx" ON "MissingReport"("status");
CREATE INDEX IF NOT EXISTS "MissingReport_created_at_idx" ON "MissingReport"("created_at");