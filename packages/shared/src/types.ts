import { z } from "zod";

// ─────────────────────────────────────────────
// ENUMS (Match Prisma)
// ─────────────────────────────────────────────

export const RoleEnum = z.enum([
  "ADMIN",
  "STUDENT",
  "WARDEN",
  "DOCTOR",
  "MESS_MANAGER",
  "MAINTENANCE_STAFF",
  "HOUSEKEEPING_STAFF",
  "SECURITY_GUARD",
]);
export type Role = z.infer<typeof RoleEnum>;

export const RoomTypeEnum = z.enum(["SINGLE", "DOUBLE", "TRIPLE", "DORMITORY"]);
export type RoomType = z.infer<typeof RoomTypeEnum>;

export const RoomStatusEnum = z.enum(["ACTIVE", "UNDER_MAINTENANCE", "CLOSED"]);
export type RoomStatus = z.infer<typeof RoomStatusEnum>;

export const EntryActionEnum = z.enum(["ENTRY", "EXIT"]);
export type EntryAction = z.infer<typeof EntryActionEnum>;

export const RequestStatusEnum = z.enum([
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
]);
export type RequestStatus = z.infer<typeof RequestStatusEnum>;

export const MedicalUrgencyEnum = z.enum(["NORMAL", "URGENT", "EMERGENCY"]);
export type MedicalUrgency = z.infer<typeof MedicalUrgencyEnum>;

export const MedicalStatusEnum = z.enum([
  "OPEN",
  "ASSIGNED",
  "RESOLVED",
  "ESCALATED",
]);
export type MedicalStatus = z.infer<typeof MedicalStatusEnum>;

export const ParcelStatusEnum = z.enum([
  "RECEIVED",
  "NOTIFIED",
  "PICKUP_REQUESTED",
  "COLLECTED",
]);
export type ParcelStatus = z.infer<typeof ParcelStatusEnum>;

export const MaintenanceCategoryEnum = z.enum([
  "ELECTRICAL",
  "PLUMBING",
  "FURNITURE",
  "CIVIL",
  "OTHER",
]);
export type MaintenanceCategory = z.infer<typeof MaintenanceCategoryEnum>;

export const HousekeepingCategoryEnum = z.enum([
  "ROOM_CLEANING",
  "BATHROOM",
  "CORRIDOR",
  "COMMON_AREA",
  "OTHER",
]);
export type HousekeepingCategory = z.infer<typeof HousekeepingCategoryEnum>;

export const TaskStatusEnum = z.enum([
  "PENDING",
  "IN_PROGRESS",
  "AWAITING_PARTS",
  "RESOLVED",
]);
export type TaskStatus = z.infer<typeof TaskStatusEnum>;

export const AttendanceStatusEnum = z.enum([
  "PRESENT",
  "ABSENT",
  "ON_LEAVE",
  "LATE_RETURN",
  "UNVERIFIED",
]);
export type AttendanceStatus = z.infer<typeof AttendanceStatusEnum>;

export const NotificationTypeEnum = z.enum([
  "LEAVE_APPROVAL",
  "LEAVE_REJECTION",
  "GUEST_APPROVAL",
  "GUEST_REJECTION",
  "MEDICAL_UPDATE",
  "PARCEL_ARRIVED",
  "PARCEL_COLLECTED",
  "EMERGENCY_ALERT",
  "NOTICE",
  "PAYMENT_DUE",
  "MAINTENANCE_UPDATE",
  "HOUSEKEEPING_UPDATE",
  "GENERAL",
]);
export type NotificationType = z.infer<typeof NotificationTypeEnum>;

export const AlertPriorityEnum = z.enum(["NORMAL", "HIGH", "CRITICAL"]);
export type AlertPriority = z.infer<typeof AlertPriorityEnum>;

export const ScanValidationStatusEnum = z.enum([
  "SUCCESS",
  "INVALID_TOKEN",
  "EXPIRED_TOKEN",
  "OUT_OF_RANGE",
  "SESSION_ERROR",
]);
export type ScanValidationStatus = z.infer<typeof ScanValidationStatusEnum>;

// ─────────────────────────────────────────────
// MODELS
// ─────────────────────────────────────────────

export const UserSchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  email: z.string().email(),
  role: RoleEnum,
  full_name: z.string().min(2),
  phone: z.string().nullable().optional(),
  is_active: z.boolean().default(true),
  first_login: z.boolean().default(true),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
});
export type User = z.infer<typeof UserSchema>;

export const StudentSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  hostel_id: z.string(),
  enrollment_no: z.string(),
  department: z.string(),
  year_of_study: z.number().int().min(1).max(5),
  date_of_birth: z.date().nullable().optional(),
  profile_pic_url: z.string().url().nullable().optional(),
  current_status: EntryActionEnum.default("ENTRY"),
  last_scan_at: z.date().nullable().optional(),
});
export type Student = z.infer<typeof StudentSchema>;

// ─────────────────────────────────────────────
// REQUEST/RESPONSE SCHEMAS
// ─────────────────────────────────────────────

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  client: z.enum(["web", "mobile", "kiosk"]).optional(),
});
export type LoginRequest = z.infer<typeof LoginSchema>;

export const AuthResponseSchema = z.object({
  access_token: z.string(),
  user: UserSchema,
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

export const QRTokenSchema = z.object({
  token: z.string(),
});
export type QRTokenRequest = z.infer<typeof QRTokenSchema>;

export const ScanResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  action_type: EntryActionEnum,
  timestamp: z.string(),
});
export type ScanResponse = z.infer<typeof ScanResponseSchema>;

export const QRCodePayloadSchema = z.object({
  gate_id: z.string(),
  iat: z.number(),
  exp: z.number(),
  nonce: z.string(),
});
export type QRCodePayload = z.infer<typeof QRCodePayloadSchema>;
