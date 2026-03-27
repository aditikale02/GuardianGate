import { Router } from "express";
import { Role } from "@prisma/client";
import {
  getAttendance,
  getLogs,
  markAllNotificationsRead,
  markNotificationRead,
  getNotifications,
  getOverview,
  getProfile,
  getReports,
  getRequests,
  getRequestTrace,
  getSettings,
  getStudents,
  getWardens,
} from "../controllers/dashboard.controller";
import { authenticateToken, authorizeRole } from "../middleware/auth";

const router = Router();

router.get(
  "/overview",
  authenticateToken,
  authorizeRole([Role.ADMIN, Role.WARDEN]),
  getOverview,
);

router.get(
  "/students",
  authenticateToken,
  authorizeRole([Role.ADMIN, Role.WARDEN]),
  getStudents,
);

router.get(
  "/wardens",
  authenticateToken,
  authorizeRole([Role.ADMIN, Role.WARDEN]),
  getWardens,
);

router.get(
  "/attendance",
  authenticateToken,
  authorizeRole([Role.ADMIN, Role.WARDEN, Role.STUDENT]),
  getAttendance,
);

router.get(
  "/logs",
  authenticateToken,
  authorizeRole([Role.ADMIN, Role.WARDEN]),
  getLogs,
);

router.get(
  "/requests",
  authenticateToken,
  authorizeRole([Role.ADMIN, Role.WARDEN]),
  getRequests,
);

router.get(
  "/notifications",
  authenticateToken,
  authorizeRole([Role.ADMIN, Role.WARDEN, Role.STUDENT]),
  getNotifications,
);

router.post(
  "/notifications/:notificationId/read",
  authenticateToken,
  authorizeRole([Role.ADMIN, Role.WARDEN, Role.STUDENT]),
  markNotificationRead,
);

router.post(
  "/notifications/read-all",
  authenticateToken,
  authorizeRole([Role.ADMIN, Role.WARDEN, Role.STUDENT]),
  markAllNotificationsRead,
);

router.get(
  "/reports",
  authenticateToken,
  authorizeRole([Role.ADMIN, Role.WARDEN]),
  getReports,
);

router.get(
  "/settings",
  authenticateToken,
  authorizeRole([Role.ADMIN, Role.WARDEN]),
  getSettings,
);

router.get(
  "/profile",
  authenticateToken,
  authorizeRole([Role.ADMIN, Role.WARDEN, Role.STUDENT]),
  getProfile,
);

router.get(
  "/request-trace",
  authenticateToken,
  authorizeRole([Role.ADMIN, Role.WARDEN]),
  getRequestTrace,
);

export default router;
