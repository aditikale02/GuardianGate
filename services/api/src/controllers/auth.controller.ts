import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../prisma";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../utils/jwt";
import { LoginSchema } from "@guardian/shared";
import { Role } from "@prisma/client";
import { env } from "../config/env.config";
import { AuthRequest } from "../middleware/auth";
import { z } from "zod";

const SUPPORTED_ROLES: Role[] = [Role.ADMIN, Role.STUDENT, Role.WARDEN];
const DEFAULT_STUDENT_DEPARTMENT = "COMPUTER_ENGINEERING";

const isSupportedRole = (role: Role) => SUPPORTED_ROLES.includes(role);

const REFRESH_COOKIE_NAME = "refresh_token";
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "strict" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const REFRESH_CLEAR_COOKIE_OPTIONS = {
  httpOnly: REFRESH_COOKIE_OPTIONS.httpOnly,
  secure: REFRESH_COOKIE_OPTIONS.secure,
  sameSite: REFRESH_COOKIE_OPTIONS.sameSite,
};

const setRefreshCookie = (res: Response, refreshToken: string) => {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, REFRESH_COOKIE_OPTIONS);
};

const hasClientAccess = (role: Role, client?: "web" | "mobile" | "kiosk") => {
  if (!isSupportedRole(role)) {
    return false;
  }

  if (!client) {
    return true;
  }

  if (client === "web") {
    return role === Role.ADMIN || role === Role.WARDEN || role === Role.STUDENT;
  }

  if (client === "mobile") {
    return role === Role.STUDENT;
  }

  if (client === "kiosk") {
    return role === Role.ADMIN || role === Role.WARDEN;
  }

  return false;
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = LoginSchema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json({ errors: result.error.errors });
      return;
    }

    const { email, password, client } = result.data;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.is_active) {
      res
        .status(401)
        .json({ message: "Invalid credentials or inactive account" });
      return;
    }

    if (!isSupportedRole(user.role)) {
      if (user.is_active) {
        await prisma.user.update({
          where: { id: user.id },
          data: { is_active: false },
        });
      }

      res.status(403).json({
        message: "This account role has been retired. Contact admin support.",
      });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    if (!hasClientAccess(user.role, client)) {
      res.status(403).json({ message: "Role not allowed for this client" });
      return;
    }

    const now = new Date();
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { last_login_at: now },
    });

    const accessToken = generateAccessToken(updatedUser);
    const refreshToken = generateRefreshToken(updatedUser);

    setRefreshCookie(res, refreshToken);

    res.json({
      access_token: accessToken,
      user: {
        id: updatedUser.id,
        name: updatedUser.full_name,
        email: updatedUser.email,
        role: updatedUser.role,
        first_login: updatedUser.first_login,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getMe = async (req: any, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ message: "Not authenticated" });
      return;
    }

    res.json({
      user: {
        id: user.id,
        name: user.full_name,
        email: user.email,
        role: user.role,
        first_login: user.first_login,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

const changePasswordSchema = z.object({
  current_password: z.string().min(6),
  new_password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128),
});

export const changePassword = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  const parsed = changePasswordSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ errors: parsed.error.errors });
    return;
  }

  if (!req.user) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }

  try {
    const dbUser = await prisma.user.findUnique({ where: { id: req.user.id } });

    if (!dbUser || !dbUser.is_active) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const isCurrentMatch = await bcrypt.compare(
      parsed.data.current_password,
      dbUser.password_hash,
    );

    if (!isCurrentMatch) {
      res.status(400).json({ message: "Current password is incorrect" });
      return;
    }

    const newHash = await bcrypt.hash(parsed.data.new_password, 10);

    await prisma.user.update({
      where: { id: dbUser.id },
      data: {
        password_hash: newHash,
        first_login: false,
        temporary_password_encrypted: null,
        credentials_email_status: "PASSWORD_CHANGED",
        credentials_emailed_at: null,
      },
    });

    res.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ message: "Unable to change password" });
  }
};

type RefreshPayload = {
  id: string;
  ver: number;
};

const adminSignupSchema = z.object({
  full_name: z.string().min(2),
  email: z.string().email(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[a-z]/, "Password must include a lowercase letter")
    .regex(/[A-Z]/, "Password must include an uppercase letter")
    .regex(/[0-9]/, "Password must include a number")
    .regex(/[^A-Za-z0-9]/, "Password must include a special character"),
});

const generateUniqueUsername = async (seed: string) => {
  const normalized = seed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 20) || "admin";

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

export const adminSignup = async (
  req: Request,
  res: Response,
): Promise<void> => {
  if (!env.ENABLE_ADMIN_SIGNUP) {
    res.status(403).json({ message: "Admin signup disabled" });
    return;
  }

  const parsed = adminSignupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ errors: parsed.error.errors });
    return;
  }

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true },
    });

    if (existingUser) {
      res.status(409).json({ message: "Email already exists" });
      return;
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    const username = await generateUniqueUsername(parsed.data.email.split("@")[0]);

    const user = await prisma.user.create({
      data: {
        full_name: parsed.data.full_name,
        email: parsed.data.email,
        username,
        password_hash: passwordHash,
        role: Role.ADMIN,
        is_active: true,
        first_login: false,
      },
    });

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    setRefreshCookie(res, refreshToken);

    res.status(201).json({
      access_token: accessToken,
      user: {
        id: user.id,
        name: user.full_name,
        email: user.email,
        role: user.role,
        first_login: user.first_login,
      },
    });
  } catch (error) {
    console.error("Admin signup error:", error);
    res.status(500).json({ message: "Unable to create admin account" });
  }
};

export const refresh = async (req: Request, res: Response): Promise<void> => {
  try {
    const refreshToken = req.cookies?.refresh_token;

    if (!refreshToken) {
      res.status(401).json({ message: "Missing refresh token" });
      return;
    }

    const decoded = verifyRefreshToken(refreshToken) as RefreshPayload;
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });

    if (!user || !user.is_active) {
      res.status(401).json({ message: "Invalid refresh token" });
      return;
    }

    const currentVersion = Math.floor(user.updated_at.getTime() / 1000);
    if (decoded.ver !== currentVersion) {
      res.status(401).json({ message: "Invalid refresh token" });
      return;
    }

    const accessToken = generateAccessToken(user);
    const rotatedRefreshToken = generateRefreshToken(user);

    setRefreshCookie(res, rotatedRefreshToken);

    res.json({
      access_token: accessToken,
      user: {
        id: user.id,
        name: user.full_name,
        email: user.email,
        role: user.role,
        first_login: user.first_login,
      },
    });
  } catch (error) {
    res.status(401).json({ message: "Invalid refresh token" });
  }
};

export const logout = async (_req: Request, res: Response): Promise<void> => {
  const reqWithCookies = _req as Request & { cookies?: Record<string, string> };
  const refreshToken = reqWithCookies.cookies?.refresh_token;

  if (refreshToken) {
    try {
      const decoded = verifyRefreshToken(refreshToken) as RefreshPayload;
      await prisma.user.update({
        where: { id: decoded.id },
        data: { updated_at: new Date() },
      });
    } catch (_error) {
    }
  }

  res.clearCookie(REFRESH_COOKIE_NAME, REFRESH_CLEAR_COOKIE_OPTIONS);

  res.json({ success: true });
};

// DEV ONLY: Quick register for initial setup/testing
export const register = async (req: Request, res: Response): Promise<void> => {
  const { name, email, password, role } = req.body;

  try {
    const password_hash = await bcrypt.hash(password, 10);

    let targetRole: Role = "STUDENT";
    const validRoles: Role[] = [Role.ADMIN, Role.STUDENT, Role.WARDEN];
    if (validRoles.includes(role)) {
      targetRole = role as Role;
    }

    if (targetRole === Role.ADMIN) {
      const existingAdmin = await prisma.user.findFirst({
        where: { role: Role.ADMIN },
        select: { id: true },
      });

      if (existingAdmin) {
        res.status(409).json({
          message: "Admin account already exists. Additional admin registration is blocked.",
        });
        return;
      }
    }

    const userCount = await prisma.user.count();

    // Auto setup dummy data for students
    const user = await prisma.user.create({
      data: {
        full_name: name,
        username:
          email.split("@")[0] + (userCount > 0 ? userCount.toString() : ""),
        email,
        password_hash,
        role: targetRole,
        first_login: true,
        ...(targetRole === "STUDENT"
          ? {
              student: {
                create: {
                  hostel_id: `GG-2026-${String(userCount + 1).padStart(3, "0")}`,
                  enrollment_no: `ENR-${Date.now()}`,
                  department: DEFAULT_STUDENT_DEPARTMENT,
                  year_of_study: 1,
                },
              },
            }
          : {}),
      },
    });

    res.status(201).json({ message: "User created", userId: user.id });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ message: "Error creating user" });
  }
};
