import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.config";
import { prisma } from "../prisma";
import { User, Role } from "@prisma/client";

const { JWT_SECRET } = env;

export interface AuthRequest extends Request {
  user?: User;
  requestId?: string;
}

export const authenticateToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    res.sendStatus(401);
    return;
  }

  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });

    if (!user || !user.is_active) {
      res.sendStatus(403);
      return;
    }

    req.user = user;
    next();
  } catch (err) {
    res.sendStatus(403);
    return;
  }
};

export const authorizeRole = (roles: Role[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.sendStatus(401);
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ message: "Insufficient permissions" });
      return;
    }

    next();
  };
};
