import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { Department, Prisma, Role, ShiftTiming } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../prisma";
import { AuthRequest } from "../middleware/auth";
import {
  decryptTemporaryPassword,
  encryptTemporaryPassword,
} from "../utils/credentials";

const DEPARTMENTS = [
  "Computer Engineering",
  "Computer Engineering Regional",
  "AIML",
  "ENTC",
  "Civil",
  "IT",
  "Architecture",
  "Diploma",
] as const;

const DEPARTMENT_VALUE_MAP: Record<(typeof DEPARTMENTS)[number], Department> = {
  "Computer Engineering": Department.COMPUTER_ENGINEERING,
  "Computer Engineering Regional": Department.COMPUTER_ENGINEERING_REGIONAL,
  AIML: Department.AIML,
  ENTC: Department.ENTC,
  Civil: Department.CIVIL,
  IT: Department.IT,
  Architecture: Department.ARCHITECTURE,
  Diploma: Department.DIPLOMA,
};

const SHIFT_TIMINGS = ["DAY", "NIGHT", "BOTH"] as const;

const createStudentSchema = z.object({
  full_name: z.string().min(2),
  enrollment_no: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  department: z.enum(DEPARTMENTS),
  course_branch: z.string().min(2),
  year_of_study: z.number().int().min(1).max(8),

  hostel_id: z.string().min(2),
  room_number: z.string().min(1),
  block_name: z.string().min(1).optional(),
  floor_label: z.string().min(1).optional(),
  hostel_joining_date: z.string().datetime().optional(),
  assigned_warden_id: z.string().uuid().optional(),
  mess_plan_enabled: z.boolean().default(true),

  guardian_name: z.string().min(2),
  guardian_relation: z.string().min(2),
  guardian_phone: z.string().min(8),
  emergency_contact_phone: z.string().optional(),
  permanent_address: z.string().max(1000).optional(),

  username: z.string().min(3).max(32).optional(),
  password: z.string().min(8).max(128).optional(),
  is_active: z.boolean().default(true),
  profile_photo_base64: z.string().optional(),
  id_proof_base64: z.string().optional(),

  leave_balance: z.number().int().min(0).optional(),
  medical_notes: z.string().max(1200).optional(),
});

const createWardenSchema = z.object({
  full_name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(8),
  alternate_phone: z.string().optional(),
  gender: z.string().max(32).optional(),

  assigned_hostel: z.string().min(2),
  assigned_block: z.string().optional(),
  assigned_floor: z.string().optional(),
  shift_timing: z.enum(SHIFT_TIMINGS).default("DAY"),
  joining_date: z.string().datetime().optional(),
  experience_years: z.number().int().min(0).optional(),

  username: z.string().min(3).max(32).optional(),
  password: z.string().min(8).max(128).optional(),
  is_active: z.boolean().default(true),
  profile_photo_base64: z.string().optional(),

  can_approve_leave: z.boolean().default(true),
  can_manage_guest_entries: z.boolean().default(true),
  can_manage_parcel_requests: z.boolean().default(true),
  can_access_student_records: z.boolean().default(true),
  can_send_notices: z.boolean().default(true),
  can_handle_medical_requests: z.boolean().default(true),
});

const updateStudentSchema = z.object({
  phone: z.string().nullable().optional(),
  department: z.enum(DEPARTMENTS).optional(),
  course_branch: z.string().min(2).optional(),
  year_of_study: z.number().int().min(1).max(8).optional(),
  room_number: z.string().min(1).optional(),
  block_name: z.string().min(1).optional(),
  floor_label: z.string().min(1).optional(),
  hostel_joining_date: z.string().datetime().optional(),
  assigned_warden_id: z.string().uuid().nullable().optional(),
  mess_plan_enabled: z.boolean().optional(),
  guardian_name: z.string().min(2).optional(),
  guardian_relation: z.string().min(2).optional(),
  guardian_phone: z.string().min(8).optional(),
  emergency_contact_phone: z.string().optional(),
  permanent_address: z.string().max(1000).optional(),
  profile_photo_base64: z.string().optional(),
  id_proof_base64: z.string().optional(),
  leave_balance: z.number().int().min(0).optional(),
  medical_notes: z.string().max(1200).optional(),
});

const updateWardenProfileSchema = z.object({
  alternate_phone: z.string().optional(),
  gender: z.string().max(32).optional(),
  assigned_hostel: z.string().min(2).optional(),
  assigned_block: z.string().optional(),
  assigned_floor: z.string().optional(),
  shift_timing: z.enum(SHIFT_TIMINGS).optional(),
  joining_date: z.string().datetime().optional(),
  experience_years: z.number().int().min(0).optional(),
  profile_photo_base64: z.string().optional(),
  can_approve_leave: z.boolean().optional(),
  can_manage_guest_entries: z.boolean().optional(),
  can_manage_parcel_requests: z.boolean().optional(),
  can_access_student_records: z.boolean().optional(),
  can_send_notices: z.boolean().optional(),
  can_handle_medical_requests: z.boolean().optional(),
});

const updateUserSchema = z.object({
  full_name: z.string().min(2).optional(),
  phone: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
  student: updateStudentSchema.optional(),
  warden_profile: updateWardenProfileSchema.optional(),
});

const activateSchema = z.object({
  is_active: z.boolean(),
});

const parseBooleanFilter = (value?: string) => {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
};

const createTemporaryPassword = () => crypto.randomBytes(9).toString("base64url");

const slugifyForUsername = (value: string) => {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 24);

  return slug.length > 0 ? slug : "user";
};

const generateUniqueUsername = async (seed: string) => {
  const normalized = slugifyForUsername(seed);
  let candidate = normalized;

  for (let i = 1; i <= 1000; i += 1) {
    const existing = await prisma.user.findUnique({
      where: { username: candidate },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }

    candidate = `${normalized}${i}`;
  }

  return `${normalized}${Date.now()}`;
};

const ensureUsernameAvailable = async (username: string) => {
  const existing = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });

  return !existing;
};

const generateUniqueWardenId = async () => {
  for (let i = 1; i <= 1000; i += 1) {
    const candidate = `WRD-${String(1000 + i)}`;
    const existing = await prisma.wardenProfile.findUnique({
      where: { warden_id: candidate },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }
  }

  return `WRD-${Date.now()}`;
};

const generateUniqueGateId = async (prefix: string) => {
  for (let i = 1; i <= 1000; i += 1) {
    const candidate = `${prefix}-${String(1000 + i)}`;
    const existing = await prisma.student.findFirst({
      where: {
        OR: [{ gate_pass_id: candidate }, { qr_gate_id: candidate }],
      },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }
  }

  return `${prefix}-${Date.now()}`;
};

const parseFloorNumber = (input?: string) => {
  if (!input) return 1;
  const trimmed = input.trim().toLowerCase();
  if (trimmed === "ground") return 0;
  const parsed = Number.parseInt(trimmed, 10);
  if (Number.isNaN(parsed)) return 1;
  return Math.max(0, parsed);
};

const normalizeMaybe = (value?: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const ensureWardenExists = async (wardenId?: string | null) => {
  if (!wardenId) return null;

  const warden = await prisma.user.findUnique({
    where: { id: wardenId },
    select: { id: true, role: true, is_active: true },
  });

  if (!warden || (warden.role !== Role.WARDEN && warden.role !== Role.ADMIN) || !warden.is_active) {
    throw new Error("Assigned warden is invalid or inactive");
  }

  return warden.id;
};

const ensureRoomForStudent = async (
  tx: Prisma.TransactionClient,
  payload: { hostel_id: string; room_number: string; block_name?: string; floor_label?: string },
) => {
  const blockKey = `${payload.hostel_id.trim().toUpperCase()}-${(payload.block_name || "A").trim().toUpperCase()}`;
  const floorNumber = parseFloorNumber(payload.floor_label);

  const block = await tx.hostelBlock.upsert({
    where: { 
      hostel_id_name: {
        hostel_id: payload.hostel_id,
        name: blockKey
      }
    },
    update: {},
    create: {
      hostel_id: payload.hostel_id,
      name: blockKey,
      description: `Auto-created for hostel ${payload.hostel_id}`,
    },
  });

  const floor = await tx.floor.upsert({
    where: {
      block_id_floor_number: {
        block_id: block.id,
        floor_number: floorNumber,
      },
    },
    update: {},
    create: {
      block_id: block.id,
      floor_number: floorNumber,
      name: floorNumber === 0 ? "Ground" : `Floor ${floorNumber}`,
    },
  });

  const room = await tx.room.upsert({
    where: {
      floor_id_room_number: {
        floor_id: floor.id,
        room_number: payload.room_number.trim(),
      },
    },
    update: {},
    create: {
      floor_id: floor.id,
      room_number: payload.room_number.trim(),
      capacity: 3,
      current_occupancy: 0,
    },
  });

  const currentActive = await tx.roomAllocation.count({
    where: {
      room_id: room.id,
      is_active: true,
    },
  });

  const nextBed = currentActive + 1;
  const nextCapacity = Math.max(room.capacity, nextBed);

  await tx.room.update({
    where: { id: room.id },
    data: {
      current_occupancy: nextBed,
      capacity: nextCapacity,
    },
  });

  return { roomId: room.id, bedNumber: nextBed };
};


const buildCredentialsView = (params: {
  username: string;
  isActive: boolean;
  firstLogin: boolean;
  temporaryPasswordEncrypted?: string | null;
}) => ({
  login_id: params.username,
  temporary_password: params.firstLogin
    ? decryptTemporaryPassword(params.temporaryPasswordEncrypted)
    : null,
  account_status: params.isActive ? "ACTIVE" : "INACTIVE",
  password_changed: !params.firstLogin,
  is_temporary: params.firstLogin,
});

export const listUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const roleFilter = typeof req.query.role === "string" ? req.query.role.toUpperCase() : undefined;
    const activeFilter = typeof req.query.is_active === "string" ? parseBooleanFilter(req.query.is_active) : undefined;
    const searchFilter = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const page = Number.parseInt(String(req.query.page || "1"), 10);
    const pageSize = Number.parseInt(String(req.query.page_size || "100"), 10);

    const where: Prisma.UserWhereInput = {
      hostel_id: req.user?.hostel_id,
    };

    if (roleFilter && ["ADMIN", "WARDEN", "STUDENT"].includes(roleFilter)) {
      where.role = roleFilter as Role;
    }

    if (activeFilter !== undefined) {
      where.is_active = activeFilter;
    }

    if (searchFilter.length > 0) {
      where.OR = [
        { full_name: { contains: searchFilter, mode: "insensitive" } },
        { email: { contains: searchFilter, mode: "insensitive" } },
        { username: { contains: searchFilter, mode: "insensitive" } },
        {
          student: {
            is: {
              OR: [
                { hostel_id: { contains: searchFilter, mode: "insensitive" } },
                { enrollment_no: { contains: searchFilter, mode: "insensitive" } },
              ],
            },
          },
        },
        {
          warden_profile: {
            is: {
              OR: [
                { warden_id: { contains: searchFilter, mode: "insensitive" } },
                { assigned_hostel: { contains: searchFilter, mode: "insensitive" } },
              ],
            },
          },
        },
      ];
    }

    const safePage = Number.isNaN(page) || page < 1 ? 1 : page;
    const safePageSize = Number.isNaN(pageSize) ? 100 : Math.min(Math.max(pageSize, 1), 250);

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip: (safePage - 1) * safePageSize,
        take: safePageSize,
        select: {
          id: true,
          full_name: true,
          email: true,
          username: true,
          phone: true,
          role: true,
          is_active: true,
          first_login: true,
          temporary_password_encrypted: true,
          credentials_email_status: true,
          credentials_emailed_at: true,
          last_login_at: true,
          created_at: true,
          created_by_admin_id: true,
          student: {
            select: {
              hostel_id: true,
              enrollment_no: true,
              department: true,
              course_branch: true,
              year_of_study: true,
              room_allocation: {
                select: {
                  room: { select: { room_number: true } },
                },
              },
              assigned_warden: {
                select: {
                  id: true,
                  full_name: true,
                  email: true,
                },
              },
              leave_balance: true,
              gate_pass_id: true,
              qr_gate_id: true,
              mess_plan_enabled: true,
            },
          },
          warden_profile: {
            select: {
              warden_id: true,
              assigned_hostel: true,
              assigned_block: true,
              assigned_floor: true,
              shift_timing: true,
              joining_date: true,
              can_approve_leave: true,
              can_manage_guest_entries: true,
              can_manage_parcel_requests: true,
              can_access_student_records: true,
              can_send_notices: true,
              can_handle_medical_requests: true,
            },
          },
          _count: {
            select: {
              assigned_students: true,
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      users: users.map((user) => {
        const { temporary_password_encrypted: _temporaryPasswordEncrypted, ...safeUser } = user;
        return {
        ...safeUser,
        credentials: buildCredentialsView({
          username: user.username,
          isActive: user.is_active,
          firstLogin: user.first_login,
          temporaryPasswordEncrypted: user.temporary_password_encrypted,
        }),
      };
      }),
      meta: {
        total,
        page: safePage,
        page_size: safePageSize,
      },
    });
  } catch (error) {
    console.error("List users error:", error);
    res.status(500).json({ message: "Unable to fetch users" });
  }
};

export const createStudentUser = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  const parsed = createStudentSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ errors: parsed.error.errors });
    return;
  }

  const data = parsed.data;

  try {
    const [existingByEmail, existingByEnrollment] = await Promise.all([
      prisma.user.findUnique({ where: { email: data.email }, select: { id: true } }),
      prisma.student.findUnique({ where: { enrollment_no: data.enrollment_no }, select: { id: true } }),
    ]);

    if (existingByEmail) {
      res.status(409).json({ message: "Email already exists" });
      return;
    }

    if (existingByEnrollment) {
      res.status(409).json({ message: "Enrollment number already exists" });
      return;
    }

    const assignedWardenId = await ensureWardenExists(data.assigned_warden_id);

    const rawPassword = data.password?.trim() || createTemporaryPassword();
    const passwordHash = await bcrypt.hash(rawPassword, 10);

    let username: string;
    if (data.username?.trim()) {
      username = slugifyForUsername(data.username);
      const available = await ensureUsernameAvailable(username);
      if (!available) {
        res.status(409).json({ message: "Username already exists" });
        return;
      }
    } else {
      username = await generateUniqueUsername(data.enrollment_no || data.email.split("@")[0]);
    }

    const [gatePassId, qrGateId] = await Promise.all([
      generateUniqueGateId("GP"),
      generateUniqueGateId("QR"),
    ]);

    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          full_name: data.full_name,
          email: data.email,
          username,
          phone: normalizeMaybe(data.phone),
          password_hash: passwordHash,
          role: Role.STUDENT,
          first_login: true,
          is_active: data.is_active,
          hostel_id: req.user?.hostel_id,
          created_by_admin_id: req.user?.id,
          temporary_password_issued_at: new Date(),
          temporary_password_encrypted: encryptTemporaryPassword(rawPassword),
          credentials_email_status: "MANUAL_HANDOVER_PENDING",
          credentials_emailed_at: null,
        },
        select: {
          id: true,
          full_name: true,
          email: true,
          username: true,
          role: true,
          first_login: true,
        },
      });

      const student = await tx.student.create({
        data: {
          user_id: user.id,
          hostel_id: data.hostel_id,
          enrollment_no: data.enrollment_no,
          department: DEPARTMENT_VALUE_MAP[data.department],
          course_branch: data.course_branch,
          year_of_study: data.year_of_study,
          hostel_joining_date: data.hostel_joining_date ? new Date(data.hostel_joining_date) : null,
          assigned_warden_id: assignedWardenId,
          mess_plan_enabled: data.mess_plan_enabled,
          guardian_name: data.guardian_name,
          guardian_relation: data.guardian_relation,
          guardian_phone: data.guardian_phone,
          emergency_contact_phone: normalizeMaybe(data.emergency_contact_phone),
          permanent_address: normalizeMaybe(data.permanent_address),
          profile_pic_url: normalizeMaybe(data.profile_photo_base64),
          id_proof_url: normalizeMaybe(data.id_proof_base64),
          leave_balance: data.leave_balance ?? 15,
          gate_pass_id: gatePassId,
          qr_gate_id: qrGateId,
          medical_notes: normalizeMaybe(data.medical_notes),
          medical_conditions: normalizeMaybe(data.medical_notes),
        },
        select: { id: true },
      });

      const room = await ensureRoomForStudent(tx, {
        hostel_id: req.user?.hostel_id || "", 
        room_number: data.room_number,
        block_name: data.block_name,
        floor_label: data.floor_label,
      });

      await tx.roomAllocation.create({
        data: {
          student_id: student.id,
          room_id: room.roomId,
          bed_number: room.bedNumber,
          is_active: true,
          allocated_by: req.user?.id,
        },
      });

      return user;
    });

    res.status(201).json({
      message: "Student account created",
      user: created,
      credentials: {
        login_id: created.username,
        temporary_password: rawPassword,
        account_status: data.is_active ? "ACTIVE" : "INACTIVE",
        password_changed: false,
        is_temporary: true,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create student user";
    console.error("Create student user error:", error);
    if (message.includes("warden")) {
      res.status(400).json({ message });
      return;
    }
    res.status(500).json({ message: "Unable to create student user" });
  }
};

export const createWardenUser = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  const parsed = createWardenSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ errors: parsed.error.errors });
    return;
  }

  const data = parsed.data;

  try {
    const existingByEmail = await prisma.user.findUnique({
      where: { email: data.email },
      select: { id: true },
    });

    if (existingByEmail) {
      res.status(409).json({ message: "Email already exists" });
      return;
    }

    let username: string;
    if (data.username?.trim()) {
      username = slugifyForUsername(data.username);
      const available = await ensureUsernameAvailable(username);
      if (!available) {
        res.status(409).json({ message: "Username already exists" });
        return;
      }
    } else {
      username = await generateUniqueUsername(data.email.split("@")[0]);
    }

    const rawPassword = data.password?.trim() || createTemporaryPassword();
    const passwordHash = await bcrypt.hash(rawPassword, 10);
    const wardenId = await generateUniqueWardenId();

    const user = await prisma.user.create({
      data: {
        full_name: data.full_name,
        email: data.email,
        username,
        phone: normalizeMaybe(data.phone),
        password_hash: passwordHash,
        role: Role.WARDEN,
        hostel_id: req.user?.hostel_id,
        first_login: true,
        is_active: data.is_active,
        created_by_admin_id: req.user?.id,
        temporary_password_issued_at: new Date(),
        temporary_password_encrypted: encryptTemporaryPassword(rawPassword),
        credentials_email_status: "MANUAL_HANDOVER_PENDING",
        credentials_emailed_at: null,
        warden_profile: {
          create: {
            warden_id: wardenId,
            alternate_phone: normalizeMaybe(data.alternate_phone),
            gender: normalizeMaybe(data.gender),
            assigned_hostel: data.assigned_hostel,
            assigned_block: normalizeMaybe(data.assigned_block),
            assigned_floor: normalizeMaybe(data.assigned_floor),
            shift_timing: data.shift_timing as ShiftTiming,
            joining_date: data.joining_date ? new Date(data.joining_date) : null,
            experience_years: data.experience_years,
            can_approve_leave: data.can_approve_leave,
            can_manage_guest_entries: data.can_manage_guest_entries,
            can_manage_parcel_requests: data.can_manage_parcel_requests,
            can_access_student_records: data.can_access_student_records,
            can_send_notices: data.can_send_notices,
            can_handle_medical_requests: data.can_handle_medical_requests,
            profile_photo_url: normalizeMaybe(data.profile_photo_base64),
          },
        },
      },
      select: {
        id: true,
        full_name: true,
        email: true,
        username: true,
        role: true,
        first_login: true,
      },
    });

    res.status(201).json({
      message: "Warden account created",
      user,
      credentials: {
        login_id: user.username,
        temporary_password: rawPassword,
        account_status: data.is_active ? "ACTIVE" : "INACTIVE",
        password_changed: false,
        is_temporary: true,
      },
    });
  } catch (error) {
    console.error("Create warden user error:", error);
    res.status(500).json({ message: "Unable to create warden user" });
  }
};

export const updateUser = async (req: Request, res: Response): Promise<void> => {
  const parsed = updateUserSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ errors: parsed.error.errors });
    return;
  }

  try {
    const existing = await prisma.user.findUnique({
      where: { id: req.params.userId },
      include: {
        student: { select: { id: true } },
        warden_profile: { select: { id: true } },
      },
    });

    if (!existing) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const data = parsed.data;

    const updated = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: existing.id },
        data: {
          full_name: data.full_name,
          phone: data.phone,
          is_active: data.is_active,
        },
        select: {
          id: true,
          full_name: true,
          email: true,
          phone: true,
          role: true,
          is_active: true,
        },
      });

      if (data.student && existing.role === Role.STUDENT && existing.student) {
        const assignedWardenId =
          data.student.assigned_warden_id === null
            ? null
            : await ensureWardenExists(data.student.assigned_warden_id);

        await tx.student.update({
          where: { user_id: existing.id },
          data: {
            department: data.student.department
              ? DEPARTMENT_VALUE_MAP[data.student.department]
              : undefined,
            course_branch: data.student.course_branch,
            year_of_study: data.student.year_of_study,
            hostel_joining_date: data.student.hostel_joining_date
              ? new Date(data.student.hostel_joining_date)
              : undefined,
            assigned_warden_id: assignedWardenId ?? undefined,
            mess_plan_enabled: data.student.mess_plan_enabled,
            guardian_name: data.student.guardian_name,
            guardian_relation: data.student.guardian_relation,
            guardian_phone: data.student.guardian_phone,
            emergency_contact_phone: data.student.emergency_contact_phone,
            permanent_address: data.student.permanent_address,
            profile_pic_url: data.student.profile_photo_base64,
            id_proof_url: data.student.id_proof_base64,
            leave_balance: data.student.leave_balance,
            medical_notes: data.student.medical_notes,
            medical_conditions: data.student.medical_notes,
          },
        });

        if (data.student.room_number) {
          const room = await ensureRoomForStudent(tx, {
            hostel_id: (await tx.student.findUnique({
              where: { user_id: existing.id },
              select: { hostel_id: true },
            }))?.hostel_id || "HOSTEL",
            room_number: data.student.room_number,
            block_name: data.student.block_name,
            floor_label: data.student.floor_label,
          });

          await tx.roomAllocation.updateMany({
            where: { student_id: existing.student.id, is_active: true },
            data: {
              is_active: false,
              vacated_at: new Date(),
            },
          });

          await tx.roomAllocation.create({
            data: {
              student_id: existing.student.id,
              room_id: room.roomId,
              bed_number: room.bedNumber,
              is_active: true,
            },
          });
        }
      }

      if (data.warden_profile && existing.role === Role.WARDEN) {
        if (existing.warden_profile) {
          await tx.wardenProfile.update({
            where: { user_id: existing.id },
            data: {
              alternate_phone: data.warden_profile.alternate_phone,
              gender: data.warden_profile.gender,
              assigned_hostel: data.warden_profile.assigned_hostel,
              assigned_block: data.warden_profile.assigned_block,
              assigned_floor: data.warden_profile.assigned_floor,
              shift_timing: data.warden_profile.shift_timing as ShiftTiming | undefined,
              joining_date: data.warden_profile.joining_date
                ? new Date(data.warden_profile.joining_date)
                : undefined,
              experience_years: data.warden_profile.experience_years,
              profile_photo_url: data.warden_profile.profile_photo_base64,
              can_approve_leave: data.warden_profile.can_approve_leave,
              can_manage_guest_entries: data.warden_profile.can_manage_guest_entries,
              can_manage_parcel_requests: data.warden_profile.can_manage_parcel_requests,
              can_access_student_records: data.warden_profile.can_access_student_records,
              can_send_notices: data.warden_profile.can_send_notices,
              can_handle_medical_requests: data.warden_profile.can_handle_medical_requests,
            },
          });
        } else if (data.warden_profile.assigned_hostel) {
          await tx.wardenProfile.create({
            data: {
              user_id: existing.id,
              warden_id: await generateUniqueWardenId(),
              assigned_hostel: data.warden_profile.assigned_hostel,
              assigned_block: data.warden_profile.assigned_block,
              assigned_floor: data.warden_profile.assigned_floor,
              shift_timing: (data.warden_profile.shift_timing || "DAY") as ShiftTiming,
              joining_date: data.warden_profile.joining_date
                ? new Date(data.warden_profile.joining_date)
                : null,
              alternate_phone: data.warden_profile.alternate_phone,
              gender: data.warden_profile.gender,
              experience_years: data.warden_profile.experience_years,
              profile_photo_url: data.warden_profile.profile_photo_base64,
              can_approve_leave: data.warden_profile.can_approve_leave ?? true,
              can_manage_guest_entries: data.warden_profile.can_manage_guest_entries ?? true,
              can_manage_parcel_requests: data.warden_profile.can_manage_parcel_requests ?? true,
              can_access_student_records: data.warden_profile.can_access_student_records ?? true,
              can_send_notices: data.warden_profile.can_send_notices ?? true,
              can_handle_medical_requests: data.warden_profile.can_handle_medical_requests ?? true,
            },
          });
        }
      }

      return user;
    });

    res.json({ message: "User updated", user: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update user";
    if (message.includes("warden")) {
      res.status(400).json({ message });
      return;
    }
    console.error("Update user error:", error);
    res.status(500).json({ message: "Unable to update user" });
  }
};

export const setUserActiveState = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const parsed = activateSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ errors: parsed.error.errors });
    return;
  }

  try {
    const user = await prisma.user.update({
      where: { id: req.params.userId },
      data: { is_active: parsed.data.is_active },
      select: {
        id: true,
        full_name: true,
        email: true,
        role: true,
        is_active: true,
      },
    });

    res.json({
      message: parsed.data.is_active ? "User activated" : "User deactivated",
      user,
    });
  } catch (error) {
    console.error("Set user active state error:", error);
    res.status(500).json({ message: "Unable to update active state" });
  }
};

export const resetUserCredentials = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const existing = await prisma.user.findUnique({
      where: { id: req.params.userId },
      select: {
        id: true,
        email: true,
        username: true,
        full_name: true,
        role: true,
        is_active: true,
      },
    });

    if (!existing) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    if (existing.role !== Role.STUDENT && existing.role !== Role.WARDEN) {
      res
        .status(400)
        .json({ message: "Credentials reset allowed only for student/warden" });
      return;
    }

    const tempPassword = createTemporaryPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    await prisma.user.update({
      where: { id: existing.id },
      data: {
        password_hash: passwordHash,
        first_login: true,
        temporary_password_issued_at: new Date(),
        temporary_password_encrypted: encryptTemporaryPassword(tempPassword),
        credentials_email_status: "MANUAL_HANDOVER_PENDING",
        credentials_emailed_at: null,
      },
    });

    res.json({
      message: "Credentials reset completed",
      user_id: existing.id,
      credentials: {
        login_id: existing.username,
        temporary_password: tempPassword,
        account_status: existing.is_active ? "ACTIVE" : "INACTIVE",
        password_changed: false,
        is_temporary: true,
      },
    });
  } catch (error) {
    console.error("Reset credentials error:", error);
    res.status(500).json({ message: "Unable to reset credentials" });
  }
};
