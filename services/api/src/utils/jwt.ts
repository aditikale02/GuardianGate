import jwt from "jsonwebtoken";
import { env } from "../config/env.config";
import { User } from "@prisma/client";

const { JWT_SECRET, JWT_REFRESH_SECRET } = env;

const getRefreshVersion = (user: Pick<User, "updated_at">) =>
  Math.floor(user.updated_at.getTime() / 1000);

export const generateAccessToken = (user: User) => {
  return jwt.sign(
    { id: user.id, role: user.role, email: user.email },
    JWT_SECRET,
    { expiresIn: "15m" },
  );
};

export const generateRefreshToken = (user: User) => {
  return jwt.sign(
    {
      id: user.id,
      ver: getRefreshVersion(user),
    },
    JWT_REFRESH_SECRET,
    { expiresIn: "7d" },
  );
};

export const verifyAccessToken = (token: string) => {
  return jwt.verify(token, JWT_SECRET);
};

export const verifyRefreshToken = (token: string) => {
  return jwt.verify(token, JWT_REFRESH_SECRET);
};
