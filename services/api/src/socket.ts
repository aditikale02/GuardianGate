import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";
import { env } from "./config/env.config";
import { prisma } from "./prisma";

let io: Server;
const IS_PROD = env.NODE_ENV === "production";

type JwtPayload = {
  id: string;
  role: Role;
  email: string;
};

const DASHBOARD_ROLES: Role[] = [Role.ADMIN, Role.WARDEN];

export const initSocket = (httpServer: HttpServer): Server => {
  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || !IS_PROD) {
          callback(null, true);
          return;
        }

        if (env.SOCKET_CORS_ORIGIN_LIST.includes(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error("Socket origin not allowed"));
      },
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;

      if (!token || typeof token !== "string") {
        next(new Error("Unauthorized"));
        return;
      }

      const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
      const user = await prisma.user.findUnique({ where: { id: decoded.id } });

      if (!user || !user.is_active) {
        next(new Error("Unauthorized"));
        return;
      }

      socket.data.user = {
        id: user.id,
        role: user.role,
      };

      next();
    } catch (_error) {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket: Socket) => {
    if (!IS_PROD) {
      console.log(`Socket connected: ${socket.id}`);
    }

    const user = socket.data.user as { id: string; role: Role } | undefined;

    if (user && DASHBOARD_ROLES.includes(user.role)) {
      socket.join("dashboard:overview");
    }

    // Parents join their own room for targeted notifications
    socket.on("join:parent", (userId: string) => {
      socket.join(`parent:${userId}`);
      if (!IS_PROD) {
        console.log(`Socket ${socket.id} joined room parent:${userId}`);
      }
    });

    socket.on("disconnect", () => {
      if (!IS_PROD) {
        console.log(`Socket disconnected: ${socket.id}`);
      }
    });
  });

  return io;
};

export const getIO = (): Server | null => {
  return io || null;
};
