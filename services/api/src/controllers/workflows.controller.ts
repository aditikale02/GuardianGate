import { Request, Response } from "express";
import crypto from "crypto";
import {
  MedicalStatus,
  MedicalUrgency,
  ParcelStatus,
  RequestStatus,
  Role,
} from "@prisma/client";
import { z } from "zod";
import { prisma } from "../prisma";
import { AuthRequest } from "../middleware/auth";

const isoDateString = z.string().refine((value) => !Number.isNaN(new Date(value).getTime()), {
  message: "Invalid date",
});

const actionSchema = z.object({
  action: z.enum(["approve", "reject"]),
  remark: z.string().max(300).optional(),
});

const nightLeaveSchema = z.object({
  reason: z.string().min(2),
  destination: z.string().min(2),
  departure_at: isoDateString,
  return_at: isoDateString,
});

const guestSchema = z.object({
  guest_name: z.string().min(2),
  relationship: z.string().min(2),
  guest_phone: z.string().min(6).optional(),
  purpose: z.string().max(200).optional(),
  expected_visit_at: isoDateString,
  expected_duration: z.number().int().positive().max(720).optional(),
});

const parcelSchema = z.object({
  description: z.string().min(2),
  sender_name: z.string().max(120).optional(),
  warden_remark: z.string().max(300).optional(),
});

const parcelStatusSchema = z.object({
  status: z.nativeEnum(ParcelStatus),
  remark: z.string().max(300).optional(),
});

const medicalSchema = z.object({
  symptoms: z.string().min(2),
  urgency: z.nativeEnum(MedicalUrgency).optional(),
});

const medicalStatusSchema = z.object({
  status: z.nativeEnum(MedicalStatus),
  doctor_notes: z.string().max(400).optional(),
  prescription: z.string().max(400).optional(),
});

const suggestionSchema = z.object({
  category: z.string().min(2),
  content: z.string().min(4),
  is_anonymous: z.boolean().optional(),
});

const suggestionReplySchema = z.object({
  message: z.string().min(2).max(400),
});

const menuSchema = z.object({
  menu_date: isoDateString,
  meal_type: z.string().min(2).max(50),
  items: z.array(z.string().min(1)).min(1),
});

const ratingSchema = z.object({
  menu_id: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(300).optional(),
});

const messTimetableSchema = z.object({
  week_start_date: isoDateString.optional(),
  structured_menu: z.record(z.string(), z.record(z.string(), z.array(z.string()))),
  image_url: z.string().url().optional().nullable(),
});

const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

const MEALS = ["breakfast", "lunch", "snacks", "dinner"] as const;

type DayKey = (typeof DAYS)[number];
type MealKey = (typeof MEALS)[number];
type StructuredTimetable = Record<DayKey, Record<MealKey, string[]>>;

const buildDefaultTimetable = (): StructuredTimetable => ({
  monday: { breakfast: [], lunch: [], snacks: [], dinner: [] },
  tuesday: { breakfast: [], lunch: [], snacks: [], dinner: [] },
  wednesday: { breakfast: [], lunch: [], snacks: [], dinner: [] },
  thursday: { breakfast: [], lunch: [], snacks: [], dinner: [] },
  friday: { breakfast: [], lunch: [], snacks: [], dinner: [] },
  saturday: { breakfast: [], lunch: [], snacks: [], dinner: [] },
  sunday: { breakfast: [], lunch: [], snacks: [], dinner: [] },
});

const normalizeTimetable = (input: Record<string, Record<string, string[]>>) => {
  const base = buildDefaultTimetable();
  for (const day of DAYS) {
    const dayValue = input[day] || {};
    for (const meal of MEALS) {
      const mealValue = Array.isArray(dayValue[meal]) ? dayValue[meal] : [];
      base[day][meal] = mealValue.map((item) => String(item).trim()).filter(Boolean);
    }
  }
  return base;
};

const getWeekStartUtc = (source: Date) => {
  const date = new Date(Date.UTC(source.getUTCFullYear(), source.getUTCMonth(), source.getUTCDate()));
  const day = date.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + offset);
  return date;
};

const missingReportSchema = z.object({
  title: z.string().min(2).max(120),
  description: z.string().min(4).max(1000),
  location: z.string().max(200).optional(),
  last_seen_at: isoDateString.optional(),
  image_url: z.string().url().optional(),
});

const missingReportStatusSchema = z.object({
  status: z.enum(["OPEN", "IN_REVIEW", "FOUND", "CLOSED"]),
  resolution_notes: z.string().max(600).optional(),
});

const toJsonValidationError = <TInput, TOutput>(
  res: Response,
  result: z.SafeParseReturnType<TInput, TOutput>,
): result is z.SafeParseError<TInput> => {
  if (result.success) return false;
  res.status(400).json({ errors: result.error.errors });
  return true;
};

const ensureStudent = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ message: "Not authenticated" });
    return null;
  }

  const student = await prisma.student.findUnique({
    where: { user_id: req.user.id },
    include: {
      room_allocation: {
        include: {
          room: true,
        },
      },
    },
  });

  if (!student) {
    res.status(403).json({ message: "Student profile not found" });
    return null;
  }

  return student;
};

const isAdminLike = (req: AuthRequest) =>
  req.user?.role === Role.ADMIN || req.user?.role === Role.WARDEN;

export const createNightLeaveRequest = async (req: AuthRequest, res: Response) => {
  const student = await ensureStudent(req, res);
  if (!student) return;

  const parsed = nightLeaveSchema.safeParse(req.body);
  if (toJsonValidationError(res, parsed)) return;

  const created = await prisma.nightLeaveRequest.create({
    data: {
      student_id: student.id,
      reason: parsed.data.reason,
      destination: parsed.data.destination,
      departure_at: new Date(parsed.data.departure_at),
      return_at: new Date(parsed.data.return_at),
    },
  });

  res.status(201).json({
    id: created.id,
    status: created.status,
  });
};

export const listMyNightLeaveRequests = async (req: AuthRequest, res: Response) => {
  const student = await ensureStudent(req, res);
  if (!student) return;

  const rows = await prisma.nightLeaveRequest.findMany({
    where: { student_id: student.id },
    orderBy: { created_at: "desc" },
  });

  res.json({
    rows: rows.map((row) => ({
      id: row.id,
      reason: row.reason,
      destination: row.destination,
      departure_at: row.departure_at.toISOString(),
      return_at: row.return_at.toISOString(),
      status: row.status,
      warden_remark: row.warden_remark,
    })),
  });
};

export const listNightLeaveRequests = async (_req: AuthRequest, res: Response) => {
  const rows = await prisma.nightLeaveRequest.findMany({
    orderBy: { created_at: "desc" },
    include: {
      student: {
        include: {
          user: {
            select: {
              full_name: true,
            },
          },
          room_allocation: {
            include: {
              room: {
                select: {
                  room_number: true,
                },
              },
            },
          },
        },
      },
    },
  });

  res.json({
    rows: rows.map((row) => ({
      id: row.id,
      student: row.student.user.full_name,
      room: row.student.room_allocation?.room.room_number ?? "N/A",
      reason: row.reason,
      destination: row.destination,
      departure_at: row.departure_at.toISOString(),
      return_at: row.return_at.toISOString(),
      status: row.status,
      warden_remark: row.warden_remark,
    })),
  });
};

export const decideNightLeaveRequest = async (req: AuthRequest, res: Response) => {
  if (!req.user || !isAdminLike(req)) {
    res.status(403).json({ message: "Insufficient permissions" });
    return;
  }

  const parsed = actionSchema.safeParse(req.body);
  if (toJsonValidationError(res, parsed)) return;

  const updated = await prisma.nightLeaveRequest.update({
    where: { id: req.params.id },
    data: {
      status: parsed.data.action === "approve" ? RequestStatus.APPROVED : RequestStatus.REJECTED,
      warden_remark: parsed.data.remark,
      reviewed_by: req.user.id,
      reviewed_at: new Date(),
    },
  });

  res.json({ id: updated.id, status: updated.status });
};

export const createGuestRequest = async (req: AuthRequest, res: Response) => {
  const student = await ensureStudent(req, res);
  if (!student) return;

  const parsed = guestSchema.safeParse(req.body);
  if (toJsonValidationError(res, parsed)) return;

  const created = await prisma.guestRequest.create({
    data: {
      student_id: student.id,
      guest_name: parsed.data.guest_name,
      relationship: parsed.data.relationship,
      guest_phone: parsed.data.guest_phone,
      purpose: parsed.data.purpose,
      expected_visit_at: new Date(parsed.data.expected_visit_at),
      expected_duration: parsed.data.expected_duration ?? 120,
    },
  });

  res.status(201).json({ id: created.id, status: created.status });
};

export const listMyGuestRequests = async (req: AuthRequest, res: Response) => {
  const student = await ensureStudent(req, res);
  if (!student) return;

  const rows = await prisma.guestRequest.findMany({
    where: { student_id: student.id },
    orderBy: { created_at: "desc" },
  });

  res.json({
    rows: rows.map((row) => ({
      id: row.id,
      guest_name: row.guest_name,
      relationship: row.relationship,
      guest_phone: row.guest_phone,
      purpose: row.purpose,
      expected_visit_at: row.expected_visit_at.toISOString(),
      expected_duration: row.expected_duration,
      status: row.status,
      checked_in_at: row.checked_in_at?.toISOString() ?? null,
      checked_out_at: row.checked_out_at?.toISOString() ?? null,
      warden_remark: row.warden_remark,
    })),
  });
};

export const listGuestRequests = async (_req: AuthRequest, res: Response) => {
  const rows = await prisma.guestRequest.findMany({
    orderBy: { created_at: "desc" },
    include: {
      student: {
        include: {
          user: {
            select: { full_name: true },
          },
          room_allocation: {
            include: {
              room: {
                select: { room_number: true },
              },
            },
          },
        },
      },
    },
  });

  res.json({
    rows: rows.map((row) => ({
      id: row.id,
      student: row.student.user.full_name,
      room: row.student.room_allocation?.room.room_number ?? "N/A",
      guest_name: row.guest_name,
      relationship: row.relationship,
      guest_phone: row.guest_phone,
      purpose: row.purpose,
      expected_visit_at: row.expected_visit_at.toISOString(),
      status: row.status,
    })),
  });
};

export const decideGuestRequest = async (req: AuthRequest, res: Response) => {
  if (!req.user || !isAdminLike(req)) {
    res.status(403).json({ message: "Insufficient permissions" });
    return;
  }

  const parsed = actionSchema.safeParse(req.body);
  if (toJsonValidationError(res, parsed)) return;

  const nextStatus = parsed.data.action === "approve" ? RequestStatus.APPROVED : RequestStatus.REJECTED;
  const updated = await prisma.guestRequest.update({
    where: { id: req.params.id },
    data: {
      status: nextStatus,
      reviewed_by: req.user.id,
      reviewed_at: new Date(),
      checked_in_at: nextStatus === RequestStatus.APPROVED ? new Date() : undefined,
      warden_remark: parsed.data.remark,
    },
  });

  res.json({ id: updated.id, status: updated.status });
};

export const createParcelRequest = async (req: AuthRequest, res: Response) => {
  const student = await ensureStudent(req, res);
  if (!student) return;

  const parsed = parcelSchema.safeParse(req.body);
  if (toJsonValidationError(res, parsed)) return;

  const created = await prisma.parcelRecord.create({
    data: {
      student_id: student.id,
      description: parsed.data.description,
      sender_name: parsed.data.sender_name,
      status: ParcelStatus.PICKUP_REQUESTED,
      pickup_requested_at: new Date(),
      warden_remark: parsed.data.warden_remark,
    },
  });

  res.status(201).json({ id: created.id, status: created.status });
};

export const listMyParcels = async (req: AuthRequest, res: Response) => {
  const student = await ensureStudent(req, res);
  if (!student) return;

  const rows = await prisma.parcelRecord.findMany({
    where: { student_id: student.id },
    orderBy: { received_at: "desc" },
  });

  res.json({
    rows: rows.map((row) => ({
      id: row.id,
      description: row.description,
      sender_name: row.sender_name,
      status: row.status,
      received_at: row.received_at.toISOString(),
      collected_at: row.collected_at?.toISOString() ?? null,
      warden_remark: row.warden_remark,
    })),
  });
};

export const listParcels = async (_req: AuthRequest, res: Response) => {
  const rows = await prisma.parcelRecord.findMany({
    orderBy: { received_at: "desc" },
    include: {
      student: {
        include: {
          user: {
            select: { full_name: true },
          },
          room_allocation: {
            include: {
              room: {
                select: { room_number: true },
              },
            },
          },
        },
      },
    },
  });

  res.json({
    rows: rows.map((row) => ({
      id: row.id,
      student: row.student.user.full_name,
      room: row.student.room_allocation?.room.room_number ?? "N/A",
      description: row.description,
      sender_name: row.sender_name,
      status: row.status,
      received_at: row.received_at.toISOString(),
    })),
  });
};

export const updateParcelStatus = async (req: AuthRequest, res: Response) => {
  if (!req.user || !isAdminLike(req)) {
    res.status(403).json({ message: "Insufficient permissions" });
    return;
  }

  const parsed = parcelStatusSchema.safeParse(req.body);
  if (toJsonValidationError(res, parsed)) return;

  const updated = await prisma.parcelRecord.update({
    where: { id: req.params.id },
    data: {
      status: parsed.data.status,
      collected_at: parsed.data.status === ParcelStatus.COLLECTED ? new Date() : undefined,
      warden_remark: parsed.data.remark,
    },
  });

  res.json({ id: updated.id, status: updated.status });
};

export const createMedicalRequest = async (req: AuthRequest, res: Response) => {
  const student = await ensureStudent(req, res);
  if (!student) return;

  const parsed = medicalSchema.safeParse(req.body);
  if (toJsonValidationError(res, parsed)) return;

  const created = await prisma.medicalRequest.create({
    data: {
      student_id: student.id,
      symptoms: parsed.data.symptoms,
      urgency: parsed.data.urgency ?? MedicalUrgency.NORMAL,
    },
  });

  res.status(201).json({ id: created.id, status: created.status });
};

export const listMyMedicalRequests = async (req: AuthRequest, res: Response) => {
  const student = await ensureStudent(req, res);
  if (!student) return;

  const rows = await prisma.medicalRequest.findMany({
    where: { student_id: student.id },
    orderBy: { created_at: "desc" },
  });

  res.json({
    rows: rows.map((row) => ({
      id: row.id,
      symptoms: row.symptoms,
      urgency: row.urgency,
      status: row.status,
      doctor_notes: row.doctor_notes,
      created_at: row.created_at.toISOString(),
    })),
  });
};

export const listMedicalRequests = async (_req: AuthRequest, res: Response) => {
  const rows = await prisma.medicalRequest.findMany({
    orderBy: { created_at: "desc" },
    include: {
      student: {
        include: {
          user: {
            select: { full_name: true },
          },
          room_allocation: {
            include: {
              room: {
                select: { room_number: true },
              },
            },
          },
        },
      },
    },
  });

  res.json({
    rows: rows.map((row) => ({
      id: row.id,
      student: row.student.user.full_name,
      room: row.student.room_allocation?.room.room_number ?? "N/A",
      symptoms: row.symptoms,
      urgency: row.urgency,
      status: row.status,
      created_at: row.created_at.toISOString(),
    })),
  });
};

export const updateMedicalRequestStatus = async (req: AuthRequest, res: Response) => {
  if (!req.user || !isAdminLike(req)) {
    res.status(403).json({ message: "Insufficient permissions" });
    return;
  }

  const parsed = medicalStatusSchema.safeParse(req.body);
  if (toJsonValidationError(res, parsed)) return;

  const updated = await prisma.medicalRequest.update({
    where: { id: req.params.id },
    data: {
      status: parsed.data.status,
      doctor_notes: parsed.data.doctor_notes,
      prescription: parsed.data.prescription,
      resolved_at: parsed.data.status === MedicalStatus.RESOLVED ? new Date() : undefined,
    },
  });

  res.json({ id: updated.id, status: updated.status });
};

export const createSuggestion = async (req: AuthRequest, res: Response) => {
  const student = await ensureStudent(req, res);
  if (!student) return;

  const parsed = suggestionSchema.safeParse(req.body);
  if (toJsonValidationError(res, parsed)) return;

  const title = `${parsed.data.category} feedback`;
  const created = await prisma.suggestion.create({
    data: {
      student_id: student.id,
      title,
      content: parsed.data.content,
      is_anonymous: parsed.data.is_anonymous ?? false,
    },
  });

  res.status(201).json({ id: created.id });
};

const buildSuggestionStatusMap = async (ids: string[]) => {
  if (ids.length === 0) return new Map<string, { status: string; response?: string }>();

  const replies = await prisma.notification.findMany({
    where: {
      module_source: "SUGGESTION_REPLY",
      reference_id: { in: ids },
    },
    orderBy: { created_at: "desc" },
  });

  const map = new Map<string, { status: string; response?: string }>();
  for (const reply of replies) {
    if (!reply.reference_id || map.has(reply.reference_id)) continue;
    map.set(reply.reference_id, { status: "responded", response: reply.message });
  }
  return map;
};

export const listMySuggestions = async (req: AuthRequest, res: Response) => {
  const student = await ensureStudent(req, res);
  if (!student) return;

  const rows = await prisma.suggestion.findMany({
    where: { student_id: student.id },
    orderBy: { created_at: "desc" },
  });

  const statusMap = await buildSuggestionStatusMap(rows.map((row) => row.id));

  res.json({
    rows: rows.map((row) => {
      const status = statusMap.get(row.id);
      return {
        id: row.id,
        category: row.title.replace(/\sfeedback$/i, ""),
        content: row.content,
        is_anonymous: row.is_anonymous,
        created_at: row.created_at.toISOString(),
        status: status?.status ?? "pending",
        response: status?.response ?? null,
      };
    }),
  });
};

export const listSuggestions = async (_req: AuthRequest, res: Response) => {
  const rows = await prisma.suggestion.findMany({
    orderBy: { created_at: "desc" },
    include: {
      student: {
        include: {
          user: {
            select: { full_name: true },
          },
        },
      },
    },
  });

  const statusMap = await buildSuggestionStatusMap(rows.map((row) => row.id));

  res.json({
    rows: rows.map((row) => {
      const status = statusMap.get(row.id);
      return {
        id: row.id,
        category: row.title.replace(/\sfeedback$/i, ""),
        content: row.content,
        student: row.is_anonymous ? "Anonymous" : row.student.user.full_name,
        status: status?.status ?? "pending",
        response: status?.response ?? null,
        created_at: row.created_at.toISOString(),
      };
    }),
  });
};

export const respondSuggestion = async (req: AuthRequest, res: Response) => {
  if (!req.user || !isAdminLike(req)) {
    res.status(403).json({ message: "Insufficient permissions" });
    return;
  }

  const parsed = suggestionReplySchema.safeParse(req.body);
  if (toJsonValidationError(res, parsed)) return;

  const suggestion = await prisma.suggestion.findUnique({
    where: { id: req.params.id },
    include: { student: true },
  });

  if (!suggestion) {
    res.status(404).json({ message: "Suggestion not found" });
    return;
  }

  const notification = await prisma.notification.create({
    data: {
      recipient_id: suggestion.student.user_id,
      sender_id: req.user.id,
      type: "GENERAL",
      title: "Suggestion Response",
      message: parsed.data.message,
      module_source: "SUGGESTION_REPLY",
      reference_id: suggestion.id,
    },
  });

  res.json({ id: notification.id, status: "responded" });
};

export const listTodayMenus = async (_req: Request, res: Response) => {
  const now = new Date();
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const menus = await prisma.foodMenu.findMany({
    where: { menu_date: dayStart },
    orderBy: { meal_type: "asc" },
  });

  res.json({
    rows: menus.map((menu) => ({
      id: menu.id,
      menu_date: menu.menu_date.toISOString(),
      meal_type: menu.meal_type,
      items: menu.items.split("|").map((item) => item.trim()).filter(Boolean),
    })),
  });
};

export const upsertMenu = async (req: AuthRequest, res: Response) => {
  if (!req.user || !isAdminLike(req)) {
    res.status(403).json({ message: "Insufficient permissions" });
    return;
  }

  const parsed = menuSchema.safeParse(req.body);
  if (toJsonValidationError(res, parsed)) return;

  const date = new Date(parsed.data.menu_date);
  const dayStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

  const updated = await prisma.foodMenu.upsert({
    where: {
      menu_date_meal_type: {
        menu_date: dayStart,
        meal_type: parsed.data.meal_type,
      },
    },
    create: {
      menu_date: dayStart,
      meal_type: parsed.data.meal_type,
      items: parsed.data.items.join(" | "),
      created_by: req.user.id,
    },
    update: {
      items: parsed.data.items.join(" | "),
      created_by: req.user.id,
    },
  });

  res.json({ id: updated.id, meal_type: updated.meal_type });
};

export const submitFoodRating = async (req: AuthRequest, res: Response) => {
  const student = await ensureStudent(req, res);
  if (!student) return;

  const parsed = ratingSchema.safeParse(req.body);
  if (toJsonValidationError(res, parsed)) return;

  const updated = await prisma.foodRating.upsert({
    where: {
      student_id_menu_id: {
        student_id: student.id,
        menu_id: parsed.data.menu_id,
      },
    },
    create: {
      student_id: student.id,
      menu_id: parsed.data.menu_id,
      rating: parsed.data.rating,
      comment: parsed.data.comment,
    },
    update: {
      rating: parsed.data.rating,
      comment: parsed.data.comment,
    },
  });

  res.json({ id: updated.id, rating: updated.rating });
};

export const getMessFeedbackSummary = async (_req: AuthRequest, res: Response) => {
  const now = new Date();
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const menus = await prisma.foodMenu.findMany({
    where: { menu_date: dayStart },
    include: {
      ratings: true,
    },
  });

  res.json({
    rows: menus.map((menu) => {
      const ratings = menu.ratings;
      const count = ratings.length;
      const avg = count === 0 ? 0 : ratings.reduce((acc, item) => acc + item.rating, 0) / count;
      const likes = ratings.filter((item) => item.rating >= 4).length;
      const dislikes = ratings.filter((item) => item.rating <= 2).length;

      return {
        meal_type: menu.meal_type,
        avg_rating: Number(avg.toFixed(1)),
        likes,
        dislikes,
      };
    }),
  });
};

type MessTimetableRow = {
  id: string;
  week_start_date: Date;
  structured_menu: unknown;
  image_url: string | null;
  updated_by: string | null;
  updated_at: Date;
};

export const getMessTimetable = async (req: AuthRequest, res: Response) => {
  const weekStartQuery =
    typeof req.query.week_start === "string" && req.query.week_start.trim().length > 0
      ? new Date(req.query.week_start)
      : new Date();

  const weekStart = getWeekStartUtc(weekStartQuery);

  const rows = await prisma.$queryRawUnsafe<MessTimetableRow[]>(
    `
      SELECT *
      FROM "MessTimetable"
      WHERE "week_start_date" = $1
      LIMIT 1
    `,
    weekStart,
  );

  const row = rows[0];
  const structuredMenu = row
    ? normalizeTimetable((row.structured_menu as Record<string, Record<string, string[]>>) || {})
    : buildDefaultTimetable();

  res.json({
    week_start_date: weekStart.toISOString().slice(0, 10),
    structured_menu: structuredMenu,
    image_url: row?.image_url ?? null,
    updated_by: row?.updated_by ?? null,
    updated_at: row?.updated_at?.toISOString() ?? null,
  });
};

export const upsertMessTimetable = async (req: AuthRequest, res: Response) => {
  if (!req.user || !isAdminLike(req)) {
    res.status(403).json({ message: "Insufficient permissions" });
    return;
  }

  const parsed = messTimetableSchema.safeParse(req.body);
  if (toJsonValidationError(res, parsed)) return;

  const sourceDate = parsed.data.week_start_date ? new Date(parsed.data.week_start_date) : new Date();
  const weekStart = getWeekStartUtc(sourceDate);
  const normalized = normalizeTimetable(parsed.data.structured_menu);
  const now = new Date();

  const existing = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT "id" FROM "MessTimetable" WHERE "week_start_date" = $1 LIMIT 1`,
    weekStart,
  );

  if (existing[0]) {
    await prisma.$queryRawUnsafe(
      `
        UPDATE "MessTimetable"
        SET "structured_menu" = $1, "image_url" = $2, "updated_by" = $3, "updated_at" = $4
        WHERE "id" = $5
      `,
      JSON.stringify(normalized),
      parsed.data.image_url || null,
      req.user.full_name,
      now,
      existing[0].id,
    );
  } else {
    await prisma.$queryRawUnsafe(
      `
        INSERT INTO "MessTimetable" (
          "id", "week_start_date", "structured_menu", "image_url", "updated_by", "created_at", "updated_at"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      crypto.randomUUID(),
      weekStart,
      JSON.stringify(normalized),
      parsed.data.image_url || null,
      req.user.full_name,
      now,
      now,
    );
  }

  res.json({
    week_start_date: weekStart.toISOString().slice(0, 10),
    structured_menu: normalized,
    image_url: parsed.data.image_url || null,
  });
};

type MissingReportRow = {
  id: string;
  student_id: string;
  title: string;
  description: string;
  location: string | null;
  last_seen_at: Date | null;
  image_url: string | null;
  status: string;
  resolution_notes: string | null;
  reviewed_by: string | null;
  resolved_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export const createMissingReport = async (req: AuthRequest, res: Response) => {
  const student = await ensureStudent(req, res);
  if (!student) return;

  const parsed = missingReportSchema.safeParse(req.body);
  if (toJsonValidationError(res, parsed)) return;

  const id = crypto.randomUUID();
  const createdAt = new Date();
  const updatedAt = createdAt;
  const lastSeenAt = parsed.data.last_seen_at
    ? new Date(parsed.data.last_seen_at)
    : null;

  const rows = await prisma.$queryRawUnsafe<MissingReportRow[]>(
    `
      INSERT INTO "MissingReport" (
        "id", "student_id", "title", "description", "location", "last_seen_at", "image_url", "status", "created_at", "updated_at"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'OPEN', $8, $9)
      RETURNING *
    `,
    id,
    student.id,
    parsed.data.title,
    parsed.data.description,
    parsed.data.location || null,
    lastSeenAt,
    parsed.data.image_url || null,
    createdAt,
    updatedAt,
  );

  const created = rows[0];
  res.status(201).json({
    id: created.id,
    status: created.status,
    created_at: created.created_at.toISOString(),
  });
};

export const listMyMissingReports = async (req: AuthRequest, res: Response) => {
  const student = await ensureStudent(req, res);
  if (!student) return;

  const rows = await prisma.$queryRawUnsafe<MissingReportRow[]>(
    `
      SELECT *
      FROM "MissingReport"
      WHERE "student_id" = $1
      ORDER BY "created_at" DESC
    `,
    student.id,
  );

  res.json({
    rows: rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      location: row.location,
      last_seen_at: row.last_seen_at?.toISOString() ?? null,
      image_url: row.image_url,
      status: row.status,
      resolution_notes: row.resolution_notes,
      reviewed_by: row.reviewed_by,
      resolved_at: row.resolved_at?.toISOString() ?? null,
      created_at: row.created_at.toISOString(),
      updated_at: row.updated_at.toISOString(),
    })),
  });
};

type MissingReportAdminRow = MissingReportRow & {
  student_name: string;
  hostel_id: string;
  room_number: string | null;
};

export const listMissingReports = async (_req: AuthRequest, res: Response) => {
  const rows = await prisma.$queryRawUnsafe<MissingReportAdminRow[]>(`
    SELECT
      mr.*,
      u.full_name AS student_name,
      s.hostel_id,
      r.room_number
    FROM "MissingReport" mr
    INNER JOIN "Student" s ON s.id = mr."student_id"
    INNER JOIN "User" u ON u.id = s."user_id"
    LEFT JOIN "RoomAllocation" ra ON ra."student_id" = s.id AND ra."is_active" = true
    LEFT JOIN "Room" r ON r.id = ra."room_id"
    ORDER BY mr."created_at" DESC
  `);

  res.json({
    rows: rows.map((row) => ({
      id: row.id,
      student: row.student_name,
      hostel_id: row.hostel_id,
      room: row.room_number || "N/A",
      title: row.title,
      description: row.description,
      location: row.location,
      last_seen_at: row.last_seen_at?.toISOString() ?? null,
      image_url: row.image_url,
      status: row.status,
      resolution_notes: row.resolution_notes,
      reviewed_by: row.reviewed_by,
      resolved_at: row.resolved_at?.toISOString() ?? null,
      created_at: row.created_at.toISOString(),
    })),
  });
};

export const updateMissingReportStatus = async (
  req: AuthRequest,
  res: Response,
) => {
  if (!req.user || !isAdminLike(req)) {
    res.status(403).json({ message: "Insufficient permissions" });
    return;
  }

  const parsed = missingReportStatusSchema.safeParse(req.body);
  if (toJsonValidationError(res, parsed)) return;

  const now = new Date();
  const rows = await prisma.$queryRawUnsafe<MissingReportRow[]>(
    `
      UPDATE "MissingReport"
      SET
        "status" = $1,
        "resolution_notes" = $2,
        "reviewed_by" = $3,
        "resolved_at" = $4,
        "updated_at" = $5
      WHERE "id" = $6
      RETURNING *
    `,
    parsed.data.status,
    parsed.data.resolution_notes || null,
    req.user.full_name,
    parsed.data.status === "FOUND" || parsed.data.status === "CLOSED" ? now : null,
    now,
    req.params.id,
  );

  if (!rows[0]) {
    res.status(404).json({ message: "Missing report not found" });
    return;
  }

  res.json({
    id: rows[0].id,
    status: rows[0].status,
    resolution_notes: rows[0].resolution_notes,
    reviewed_by: rows[0].reviewed_by,
  });
};
