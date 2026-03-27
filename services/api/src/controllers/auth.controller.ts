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

const REFRESH_COOKIE_NAME = "refresh_token";
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "strict" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const setRefreshCookie = (res: Response, refreshToken: string) => {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, REFRESH_COOKIE_OPTIONS);
};

const hasClientAccess = (role: Role, client?: "web" | "mobile" | "kiosk") => {
  if (!client) {
    return true;
  }

  if (client === "web") {
    return role === Role.ADMIN || role === Role.WARDEN;
  }

  if (client === "mobile") {
    return role === Role.STUDENT;
  }

  if (client === "kiosk") {
    return role === Role.SECURITY_GUARD || role === Role.ADMIN;
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

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    if (!hasClientAccess(user.role, client)) {
      res.status(403).json({ message: "Role not allowed for this client" });
      return;
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    setRefreshCookie(res, refreshToken);

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

type RefreshPayload = {
  id: string;
  ver: number;
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

  res.clearCookie(REFRESH_COOKIE_NAME, REFRESH_COOKIE_OPTIONS);

  res.json({ success: true });
};

// DEV ONLY: Quick register for initial setup/testing
export const register = async (req: Request, res: Response): Promise<void> => {
  const { name, email, password, role } = req.body;

  try {
    const password_hash = await bcrypt.hash(password, 10);

    let targetRole: Role = "STUDENT";
    const validRoles = [
      "ADMIN",
      "STUDENT",
      "WARDEN",
      "DOCTOR",
      "MESS_MANAGER",
      "MAINTENANCE_STAFF",
      "HOUSEKEEPING_STAFF",
      "SECURITY_GUARD",
    ];
    if (validRoles.includes(role)) {
      targetRole = role as Role;
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
                  department: "CompSci",
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
