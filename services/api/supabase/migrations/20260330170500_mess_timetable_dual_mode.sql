-- Mess timetable dual-mode support (structured weekly + image reference)

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

CREATE UNIQUE INDEX IF NOT EXISTS "MessTimetable_week_start_date_key"
ON "MessTimetable" ("week_start_date");

CREATE INDEX IF NOT EXISTS "MessTimetable_week_start_date_idx"
ON "MessTimetable" ("week_start_date");