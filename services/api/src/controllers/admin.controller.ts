import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { Department, Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../prisma";
import { AuthRequest } from "../middleware/auth";
import { sendCredentialsEmail } from "../services/email.service";

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

const createStudentSchema = z.object({
  full_name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  hostel_id: z.string().min(2),
  enrollment_no: z.string().min(2),
  department: z.enum(DEPARTMENTS),
  year_of_study: z.number().int().min(1).max(8),
});

const createWardenSchema = z.object({
  full_name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  username: z.string().min(3).max(32).optional(),
});

const updateUserSchema = z.object({
  full_name: z.string().min(2).optional(),
  phone: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
});

const activateSchema = z.object({
  is_active: z.boolean(),
});

const createTemporaryPassword = () => {
  return crypto.randomBytes(9).toString("base64url");
};

const slugifyForUsername = (value: string) => {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 20);

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

const sendCredentialsAndFormat = async (params: {
  email: string;
  fullName: string;
  role: Role;
  tempPassword: string;
  adminId?: string;
}) => {
  const emailResult = await sendCredentialsEmail({
    recipientEmail: params.email,
    recipientName: params.fullName,
    role: params.role,
    temporaryPassword: params.tempPassword,
    sentByUserId: params.adminId,
  });

  return {
    credentials_email_sent: emailResult.sent,
    credentials_email_error: emailResult.reason,
    credentials_email_status: emailResult.sent ? "SENT" : "FAILED",
    credentials_emailed_at: emailResult.sent ? new Date().toISOString() : null,
  };
};

const persistCredentialsEmailStatus = async (
  userId: string,
  delivery: {
    credentials_email_sent: boolean;
    credentials_email_error?: string;
    credentials_email_status: string;
  },
) => {
  await prisma.user.update({
    where: { id: userId },
    data: {
      credentials_email_status: delivery.credentials_email_status,
      credentials_emailed_at: delivery.credentials_email_sent ? new Date() : null,
    },
  });
};

export const listUsers = async (_req: Request, res: Response): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        full_name: true,
        email: true,
        username: true,
        phone: true,
        role: true,
        is_active: true,
        first_login: true,
        credentials_email_status: true,
        credentials_emailed_at: true,
        created_at: true,
        student: {
          select: {
            hostel_id: true,
            enrollment_no: true,
            department: true,
            year_of_study: true,
          },
        },
      },
    });

    res.json({ users });
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
    const existingByEmail = await prisma.user.findUnique({
      where: { email: data.email },
      select: { id: true },
    });

    if (existingByEmail) {
      res.status(409).json({ message: "Email already exists" });
      return;
    }

    const existingByEnrollment = await prisma.student.findUnique({
      where: { enrollment_no: data.enrollment_no },
      select: { id: true },
    });

    if (existingByEnrollment) {
      res.status(409).json({ message: "Enrollment number already exists" });
      return;
    }

    const tempPassword = createTemporaryPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    const username = await generateUniqueUsername(data.email.split("@")[0]);

    const user = await prisma.user.create({
      data: {
        full_name: data.full_name,
        email: data.email,
        username,
        phone: data.phone,
        password_hash: passwordHash,
        role: Role.STUDENT,
        first_login: true,
        created_by_admin_id: req.user?.id,
        temporary_password_issued_at: new Date(),
        student: {
          create: {
            hostel_id: data.hostel_id,
            enrollment_no: data.enrollment_no,
            department: DEPARTMENT_VALUE_MAP[data.department],
            year_of_study: data.year_of_study,
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

    const emailDelivery = await sendCredentialsAndFormat({
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      tempPassword,
      adminId: req.user?.id,
    });

    await persistCredentialsEmailStatus(user.id, emailDelivery);

    res.status(201).json({
      message: "Student account created",
      user,
      ...emailDelivery,
    });
  } catch (error) {
    console.error("Create student user error:", error);
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

    const username = data.username
      ? await generateUniqueUsername(data.username)
      : await generateUniqueUsername(data.email.split("@")[0]);

    const tempPassword = createTemporaryPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const user = await prisma.user.create({
      data: {
        full_name: data.full_name,
        email: data.email,
        username,
        phone: data.phone,
        password_hash: passwordHash,
        role: Role.WARDEN,
        first_login: true,
        created_by_admin_id: req.user?.id,
        temporary_password_issued_at: new Date(),
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

    const emailDelivery = await sendCredentialsAndFormat({
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      tempPassword,
      adminId: req.user?.id,
    });

    await persistCredentialsEmailStatus(user.id, emailDelivery);

    res.status(201).json({
      message: "Warden account created",
      user,
      ...emailDelivery,
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
    const user = await prisma.user.update({
      where: { id: req.params.userId },
      data: parsed.data,
      select: {
        id: true,
        full_name: true,
        email: true,
        phone: true,
        role: true,
        is_active: true,
      },
    });

    res.json({ message: "User updated", user });
  } catch (error) {
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
      select: { id: true, email: true, full_name: true, role: true },
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
      },
    });

    const emailDelivery = await sendCredentialsAndFormat({
      email: existing.email,
      fullName: existing.full_name,
      role: existing.role,
      tempPassword,
      adminId: req.user?.id,
    });

    await persistCredentialsEmailStatus(existing.id, emailDelivery);

    res.json({
      message: "Credentials reset completed",
      user_id: existing.id,
      ...emailDelivery,
    });
  } catch (error) {
    console.error("Reset credentials error:", error);
    res.status(500).json({ message: "Unable to reset credentials" });
  }
};
