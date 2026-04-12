-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'STUDENT', 'WARDEN', 'DOCTOR', 'MESS_MANAGER', 'MAINTENANCE_STAFF', 'HOUSEKEEPING_STAFF', 'SECURITY_GUARD');

-- CreateEnum
CREATE TYPE "RoomType" AS ENUM ('SINGLE', 'DOUBLE', 'TRIPLE', 'DORMITORY');

-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('ACTIVE', 'UNDER_MAINTENANCE', 'CLOSED');

-- CreateEnum
CREATE TYPE "EntryAction" AS ENUM ('ENTRY', 'EXIT');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MedicalUrgency" AS ENUM ('NORMAL', 'URGENT', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "MedicalStatus" AS ENUM ('OPEN', 'ASSIGNED', 'RESOLVED', 'ESCALATED');

-- CreateEnum
CREATE TYPE "ParcelStatus" AS ENUM ('RECEIVED', 'NOTIFIED', 'PICKUP_REQUESTED', 'COLLECTED');

-- CreateEnum
CREATE TYPE "MaintenanceCategory" AS ENUM ('ELECTRICAL', 'PLUMBING', 'FURNITURE', 'CIVIL', 'OTHER');

-- CreateEnum
CREATE TYPE "HousekeepingCategory" AS ENUM ('ROOM_CLEANING', 'BATHROOM', 'CORRIDOR', 'COMMON_AREA', 'OTHER');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'AWAITING_PARTS', 'RESOLVED');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'ON_LEAVE', 'LATE_RETURN', 'UNVERIFIED');

-- CreateEnum
CREATE TYPE "Department" AS ENUM ('COMPUTER_ENGINEERING', 'COMPUTER_ENGINEERING_REGIONAL', 'AIML', 'ENTC', 'CIVIL', 'IT', 'ARCHITECTURE', 'DIPLOMA');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('LEAVE_APPROVAL', 'LEAVE_REJECTION', 'GUEST_APPROVAL', 'GUEST_REJECTION', 'MEDICAL_UPDATE', 'PARCEL_ARRIVED', 'PARCEL_COLLECTED', 'EMERGENCY_ALERT', 'NOTICE', 'PAYMENT_DUE', 'MAINTENANCE_UPDATE', 'HOUSEKEEPING_UPDATE', 'GENERAL');

-- CreateEnum
CREATE TYPE "AlertPriority" AS ENUM ('NORMAL', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ScanValidationStatus" AS ENUM ('SUCCESS', 'INVALID_TOKEN', 'EXPIRED_TOKEN', 'OUT_OF_RANGE', 'SESSION_ERROR');

-- CreateEnum
CREATE TYPE "MissingReportStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'FOUND', 'CLOSED');

-- CreateEnum
CREATE TYPE "ShiftTiming" AS ENUM ('DAY', 'NIGHT', 'BOTH');

-- CreateTable
CREATE TABLE "Hostel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Hostel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "hostel_id" TEXT,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "first_login" BOOLEAN NOT NULL DEFAULT true,
    "created_by_admin_id" TEXT,
    "temporary_password_issued_at" TIMESTAMP(3),
    "temporary_password_encrypted" TEXT,
    "credentials_emailed_at" TIMESTAMP(3),
    "credentials_email_status" TEXT,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "hostel_id" TEXT NOT NULL,
    "enrollment_no" TEXT NOT NULL,
    "department" "Department" NOT NULL,
    "course_branch" TEXT,
    "year_of_study" INTEGER NOT NULL,
    "hostel_joining_date" TIMESTAMP(3),
    "assigned_warden_id" TEXT,
    "mess_plan_enabled" BOOLEAN NOT NULL DEFAULT true,
    "date_of_birth" TIMESTAMP(3),
    "profile_pic_url" TEXT,
    "id_proof_url" TEXT,
    "gate_pass_id" TEXT,
    "qr_gate_id" TEXT,
    "leave_balance" INTEGER NOT NULL DEFAULT 15,
    "medical_notes" TEXT,
    "permanent_address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "aadhaar_no" TEXT,
    "college_id_no" TEXT,
    "guardian_name" TEXT,
    "guardian_phone" TEXT,
    "guardian_relation" TEXT,
    "guardian_email" TEXT,
    "emergency_contact_name" TEXT,
    "emergency_contact_phone" TEXT,
    "blood_group" TEXT,
    "known_allergies" TEXT,
    "medical_conditions" TEXT,
    "current_status" "EntryAction" NOT NULL DEFAULT 'ENTRY',
    "last_scan_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WardenProfile" (
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
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WardenProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HostelBlock" (
    "id" TEXT NOT NULL,
    "hostel_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HostelBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Floor" (
    "id" TEXT NOT NULL,
    "block_id" TEXT NOT NULL,
    "floor_number" INTEGER NOT NULL,
    "name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Floor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "floor_id" TEXT NOT NULL,
    "room_number" TEXT NOT NULL,
    "room_type" "RoomType" NOT NULL DEFAULT 'DOUBLE',
    "capacity" INTEGER NOT NULL DEFAULT 2,
    "current_occupancy" INTEGER NOT NULL DEFAULT 0,
    "status" "RoomStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomAllocation" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "bed_number" INTEGER NOT NULL,
    "allocated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vacated_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "allocated_by" TEXT,

    CONSTRAINT "RoomAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QrToken" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "is_used" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "QrToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntryExitLog" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "qr_token_id" TEXT,
    "action_type" "EntryAction" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scan_date" DATE,
    "scan_time" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "distance_from_gate" DOUBLE PRECISION,
    "qr_generated_at" TIMESTAMP(3),
    "qr_expires_at" TIMESTAMP(3),
    "validation_status" "ScanValidationStatus" NOT NULL DEFAULT 'SUCCESS',
    "failure_reason" TEXT,
    "gate_id" TEXT,
    "verified_by_user_id" TEXT,
    "verified_by_role" "Role",
    "remarks" TEXT,
    "allowed_time" TEXT,
    "actual_scanned_time" TEXT,
    "is_late" BOOLEAN NOT NULL DEFAULT false,
    "is_flagged" BOOLEAN NOT NULL DEFAULT false,
    "late_reason" TEXT,
    "student_name_snapshot" TEXT,
    "enrollment_no_snapshot" TEXT,
    "hostel_id_snapshot" TEXT,
    "floor_number_snapshot" INTEGER,
    "room_number_snapshot" TEXT,

    CONSTRAINT "EntryExitLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NightLeaveRequest" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "departure_at" TIMESTAMP(3) NOT NULL,
    "return_at" TIMESTAMP(3) NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "warden_remark" TEXT,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NightLeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuestRequest" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "guest_name" TEXT NOT NULL,
    "guest_phone" TEXT,
    "relationship" TEXT NOT NULL,
    "purpose" TEXT,
    "expected_visit_at" TIMESTAMP(3) NOT NULL,
    "expected_duration" INTEGER NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "warden_remark" TEXT,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "checked_in_at" TIMESTAMP(3),
    "checked_out_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuestRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicalRequest" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "symptoms" TEXT NOT NULL,
    "urgency" "MedicalUrgency" NOT NULL DEFAULT 'NORMAL',
    "status" "MedicalStatus" NOT NULL DEFAULT 'OPEN',
    "doctor_id" TEXT,
    "doctor_notes" TEXT,
    "prescription" TEXT,
    "escalated_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParcelRecord" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sender_name" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "ParcelStatus" NOT NULL DEFAULT 'RECEIVED',
    "pickup_requested_at" TIMESTAMP(3),
    "collected_at" TIMESTAMP(3),
    "delivered_by" TEXT,
    "student_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "warden_remark" TEXT,

    CONSTRAINT "ParcelRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodMenu" (
    "id" TEXT NOT NULL,
    "menu_date" DATE NOT NULL,
    "meal_type" TEXT NOT NULL,
    "items" TEXT NOT NULL,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FoodMenu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessTimetable" (
    "id" TEXT NOT NULL,
    "week_start_date" DATE NOT NULL,
    "structured_menu" JSONB NOT NULL,
    "image_url" TEXT,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessTimetable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodRating" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "menu_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FoodRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeRecord" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "fee_type" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "is_paid" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeeRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "fee_record_id" TEXT NOT NULL,
    "amount_paid" DECIMAL(10,2) NOT NULL,
    "payment_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payment_mode" TEXT,
    "receipt_no" TEXT,
    "recorded_by" TEXT,
    "remarks" TEXT,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceRequest" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "category" "MaintenanceCategory" NOT NULL DEFAULT 'OTHER',
    "description" TEXT NOT NULL,
    "urgency" TEXT NOT NULL DEFAULT 'NORMAL',
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "assigned_to" TEXT,
    "warden_remark" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HousekeepingRequest" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "category" "HousekeepingCategory" NOT NULL DEFAULT 'OTHER',
    "description" TEXT NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "assigned_to" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HousekeepingRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Suggestion" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "is_anonymous" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Suggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MissingReport" (
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
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MissingReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "event_date" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notice" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "target_role" "Role",
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,

    CONSTRAINT "Notice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmergencyNotification" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "priority" "AlertPriority" NOT NULL DEFAULT 'HIGH',
    "target_block_id" TEXT,
    "target_role" "Role",
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "EmergencyNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "recipient_id" TEXT NOT NULL,
    "sender_id" TEXT,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "module_source" TEXT,
    "reference_id" TEXT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "emergency_id" TEXT,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceRecord" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "attendance_date" DATE NOT NULL,
    "attendance_status" "AttendanceStatus" NOT NULL,
    "night_attendance_marked_at" TIMESTAMP(3),
    "is_on_approved_leave" BOOLEAN NOT NULL DEFAULT false,
    "leave_request_id" TEXT,
    "entry_exit_reference" TEXT,
    "late_return_flag" BOOLEAN NOT NULL DEFAULT false,
    "manual_override_flag" BOOLEAN NOT NULL DEFAULT false,
    "warden_remark" TEXT,
    "verified_by_warden_id" TEXT,
    "is_finalized" BOOLEAN NOT NULL DEFAULT false,
    "finalized_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action_type" TEXT NOT NULL,
    "target_type" TEXT,
    "target_id" TEXT,
    "ip_address" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "recipient_email" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "template_type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "failure_reason" TEXT,
    "sent_by_user_id" TEXT,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_created_by_admin_id_idx" ON "User"("created_by_admin_id");

-- CreateIndex
CREATE INDEX "User_hostel_id_idx" ON "User"("hostel_id");

-- CreateIndex
CREATE UNIQUE INDEX "Student_user_id_key" ON "Student"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "Student_enrollment_no_key" ON "Student"("enrollment_no");

-- CreateIndex
CREATE UNIQUE INDEX "Student_gate_pass_id_key" ON "Student"("gate_pass_id");

-- CreateIndex
CREATE UNIQUE INDEX "Student_qr_gate_id_key" ON "Student"("qr_gate_id");

-- CreateIndex
CREATE INDEX "Student_enrollment_no_idx" ON "Student"("enrollment_no");

-- CreateIndex
CREATE INDEX "Student_hostel_id_idx" ON "Student"("hostel_id");

-- CreateIndex
CREATE INDEX "Student_assigned_warden_id_idx" ON "Student"("assigned_warden_id");

-- CreateIndex
CREATE INDEX "Student_current_status_idx" ON "Student"("current_status");

-- CreateIndex
CREATE UNIQUE INDEX "WardenProfile_user_id_key" ON "WardenProfile"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "WardenProfile_warden_id_key" ON "WardenProfile"("warden_id");

-- CreateIndex
CREATE INDEX "WardenProfile_assigned_hostel_idx" ON "WardenProfile"("assigned_hostel");

-- CreateIndex
CREATE UNIQUE INDEX "HostelBlock_hostel_id_name_key" ON "HostelBlock"("hostel_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Floor_block_id_floor_number_key" ON "Floor"("block_id", "floor_number");

-- CreateIndex
CREATE INDEX "Room_status_idx" ON "Room"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Room_floor_id_room_number_key" ON "Room"("floor_id", "room_number");

-- CreateIndex
CREATE UNIQUE INDEX "RoomAllocation_student_id_key" ON "RoomAllocation"("student_id");

-- CreateIndex
CREATE INDEX "RoomAllocation_room_id_idx" ON "RoomAllocation"("room_id");

-- CreateIndex
CREATE INDEX "RoomAllocation_is_active_idx" ON "RoomAllocation"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "QrToken_token_hash_key" ON "QrToken"("token_hash");

-- CreateIndex
CREATE INDEX "QrToken_student_id_idx" ON "QrToken"("student_id");

-- CreateIndex
CREATE INDEX "QrToken_expires_at_idx" ON "QrToken"("expires_at");

-- CreateIndex
CREATE INDEX "EntryExitLog_student_id_idx" ON "EntryExitLog"("student_id");

-- CreateIndex
CREATE INDEX "EntryExitLog_timestamp_idx" ON "EntryExitLog"("timestamp");

-- CreateIndex
CREATE INDEX "EntryExitLog_action_type_idx" ON "EntryExitLog"("action_type");

-- CreateIndex
CREATE INDEX "EntryExitLog_scan_date_idx" ON "EntryExitLog"("scan_date");

-- CreateIndex
CREATE INDEX "EntryExitLog_is_late_idx" ON "EntryExitLog"("is_late");

-- CreateIndex
CREATE INDEX "EntryExitLog_is_flagged_idx" ON "EntryExitLog"("is_flagged");

-- CreateIndex
CREATE INDEX "EntryExitLog_verified_by_user_id_idx" ON "EntryExitLog"("verified_by_user_id");

-- CreateIndex
CREATE INDEX "NightLeaveRequest_student_id_idx" ON "NightLeaveRequest"("student_id");

-- CreateIndex
CREATE INDEX "NightLeaveRequest_status_idx" ON "NightLeaveRequest"("status");

-- CreateIndex
CREATE INDEX "NightLeaveRequest_departure_at_idx" ON "NightLeaveRequest"("departure_at");

-- CreateIndex
CREATE INDEX "NightLeaveRequest_reviewed_by_idx" ON "NightLeaveRequest"("reviewed_by");

-- CreateIndex
CREATE INDEX "GuestRequest_student_id_idx" ON "GuestRequest"("student_id");

-- CreateIndex
CREATE INDEX "GuestRequest_status_idx" ON "GuestRequest"("status");

-- CreateIndex
CREATE INDEX "GuestRequest_reviewed_by_idx" ON "GuestRequest"("reviewed_by");

-- CreateIndex
CREATE INDEX "MedicalRequest_student_id_idx" ON "MedicalRequest"("student_id");

-- CreateIndex
CREATE INDEX "MedicalRequest_status_idx" ON "MedicalRequest"("status");

-- CreateIndex
CREATE INDEX "MedicalRequest_urgency_idx" ON "MedicalRequest"("urgency");

-- CreateIndex
CREATE INDEX "ParcelRecord_student_id_idx" ON "ParcelRecord"("student_id");

-- CreateIndex
CREATE INDEX "ParcelRecord_status_idx" ON "ParcelRecord"("status");

-- CreateIndex
CREATE INDEX "FoodMenu_menu_date_idx" ON "FoodMenu"("menu_date");

-- CreateIndex
CREATE UNIQUE INDEX "FoodMenu_menu_date_meal_type_key" ON "FoodMenu"("menu_date", "meal_type");

-- CreateIndex
CREATE UNIQUE INDEX "MessTimetable_week_start_date_key" ON "MessTimetable"("week_start_date");

-- CreateIndex
CREATE INDEX "MessTimetable_week_start_date_idx" ON "MessTimetable"("week_start_date");

-- CreateIndex
CREATE INDEX "FoodRating_menu_id_idx" ON "FoodRating"("menu_id");

-- CreateIndex
CREATE UNIQUE INDEX "FoodRating_student_id_menu_id_key" ON "FoodRating"("student_id", "menu_id");

-- CreateIndex
CREATE INDEX "FeeRecord_student_id_idx" ON "FeeRecord"("student_id");

-- CreateIndex
CREATE INDEX "FeeRecord_is_paid_idx" ON "FeeRecord"("is_paid");

-- CreateIndex
CREATE INDEX "FeeRecord_due_date_idx" ON "FeeRecord"("due_date");

-- CreateIndex
CREATE INDEX "Payment_student_id_idx" ON "Payment"("student_id");

-- CreateIndex
CREATE INDEX "Payment_fee_record_id_idx" ON "Payment"("fee_record_id");

-- CreateIndex
CREATE INDEX "Payment_recorded_by_idx" ON "Payment"("recorded_by");

-- CreateIndex
CREATE INDEX "MaintenanceRequest_student_id_idx" ON "MaintenanceRequest"("student_id");

-- CreateIndex
CREATE INDEX "MaintenanceRequest_status_idx" ON "MaintenanceRequest"("status");

-- CreateIndex
CREATE INDEX "MaintenanceRequest_assigned_to_idx" ON "MaintenanceRequest"("assigned_to");

-- CreateIndex
CREATE INDEX "HousekeepingRequest_student_id_idx" ON "HousekeepingRequest"("student_id");

-- CreateIndex
CREATE INDEX "HousekeepingRequest_status_idx" ON "HousekeepingRequest"("status");

-- CreateIndex
CREATE INDEX "HousekeepingRequest_assigned_to_idx" ON "HousekeepingRequest"("assigned_to");

-- CreateIndex
CREATE INDEX "MissingReport_student_id_idx" ON "MissingReport"("student_id");

-- CreateIndex
CREATE INDEX "MissingReport_status_idx" ON "MissingReport"("status");

-- CreateIndex
CREATE INDEX "MissingReport_created_at_idx" ON "MissingReport"("created_at");

-- CreateIndex
CREATE INDEX "MissingReport_reviewed_by_idx" ON "MissingReport"("reviewed_by");

-- CreateIndex
CREATE INDEX "Notice_target_role_idx" ON "Notice"("target_role");

-- CreateIndex
CREATE INDEX "Notice_published_at_idx" ON "Notice"("published_at");

-- CreateIndex
CREATE INDEX "EmergencyNotification_created_at_idx" ON "EmergencyNotification"("created_at");

-- CreateIndex
CREATE INDEX "EmergencyNotification_priority_idx" ON "EmergencyNotification"("priority");

-- CreateIndex
CREATE INDEX "Notification_recipient_id_idx" ON "Notification"("recipient_id");

-- CreateIndex
CREATE INDEX "Notification_is_read_idx" ON "Notification"("is_read");

-- CreateIndex
CREATE INDEX "Notification_created_at_idx" ON "Notification"("created_at");

-- CreateIndex
CREATE INDEX "AttendanceRecord_attendance_date_idx" ON "AttendanceRecord"("attendance_date");

-- CreateIndex
CREATE INDEX "AttendanceRecord_attendance_status_idx" ON "AttendanceRecord"("attendance_status");

-- CreateIndex
CREATE INDEX "AttendanceRecord_is_finalized_idx" ON "AttendanceRecord"("is_finalized");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_student_id_attendance_date_key" ON "AttendanceRecord"("student_id", "attendance_date");

-- CreateIndex
CREATE INDEX "AuditLog_user_id_idx" ON "AuditLog"("user_id");

-- CreateIndex
CREATE INDEX "AuditLog_action_type_idx" ON "AuditLog"("action_type");

-- CreateIndex
CREATE INDEX "AuditLog_created_at_idx" ON "AuditLog"("created_at");

-- CreateIndex
CREATE INDEX "EmailLog_recipient_email_idx" ON "EmailLog"("recipient_email");

-- CreateIndex
CREATE INDEX "EmailLog_status_idx" ON "EmailLog"("status");

-- CreateIndex
CREATE INDEX "EmailLog_sent_at_idx" ON "EmailLog"("sent_at");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_hostel_id_fkey" FOREIGN KEY ("hostel_id") REFERENCES "Hostel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_assigned_warden_id_fkey" FOREIGN KEY ("assigned_warden_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WardenProfile" ADD CONSTRAINT "WardenProfile_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HostelBlock" ADD CONSTRAINT "HostelBlock_hostel_id_fkey" FOREIGN KEY ("hostel_id") REFERENCES "Hostel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Floor" ADD CONSTRAINT "Floor_block_id_fkey" FOREIGN KEY ("block_id") REFERENCES "HostelBlock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_floor_id_fkey" FOREIGN KEY ("floor_id") REFERENCES "Floor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomAllocation" ADD CONSTRAINT "RoomAllocation_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomAllocation" ADD CONSTRAINT "RoomAllocation_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QrToken" ADD CONSTRAINT "QrToken_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntryExitLog" ADD CONSTRAINT "EntryExitLog_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntryExitLog" ADD CONSTRAINT "EntryExitLog_qr_token_id_fkey" FOREIGN KEY ("qr_token_id") REFERENCES "QrToken"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntryExitLog" ADD CONSTRAINT "EntryExitLog_verified_by_user_id_fkey" FOREIGN KEY ("verified_by_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NightLeaveRequest" ADD CONSTRAINT "NightLeaveRequest_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NightLeaveRequest" ADD CONSTRAINT "NightLeaveRequest_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestRequest" ADD CONSTRAINT "GuestRequest_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestRequest" ADD CONSTRAINT "GuestRequest_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalRequest" ADD CONSTRAINT "MedicalRequest_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalRequest" ADD CONSTRAINT "MedicalRequest_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParcelRecord" ADD CONSTRAINT "ParcelRecord_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParcelRecord" ADD CONSTRAINT "ParcelRecord_delivered_by_fkey" FOREIGN KEY ("delivered_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodRating" ADD CONSTRAINT "FoodRating_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodRating" ADD CONSTRAINT "FoodRating_menu_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "FoodMenu"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeRecord" ADD CONSTRAINT "FeeRecord_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_fee_record_id_fkey" FOREIGN KEY ("fee_record_id") REFERENCES "FeeRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HousekeepingRequest" ADD CONSTRAINT "HousekeepingRequest_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HousekeepingRequest" ADD CONSTRAINT "HousekeepingRequest_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HousekeepingRequest" ADD CONSTRAINT "HousekeepingRequest_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissingReport" ADD CONSTRAINT "MissingReport_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissingReport" ADD CONSTRAINT "MissingReport_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notice" ADD CONSTRAINT "Notice_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyNotification" ADD CONSTRAINT "EmergencyNotification_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_emergency_id_fkey" FOREIGN KEY ("emergency_id") REFERENCES "EmergencyNotification"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_leave_request_id_fkey" FOREIGN KEY ("leave_request_id") REFERENCES "NightLeaveRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_verified_by_warden_id_fkey" FOREIGN KEY ("verified_by_warden_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_sent_by_user_id_fkey" FOREIGN KEY ("sent_by_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
