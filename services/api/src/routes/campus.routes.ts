import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticateToken, authorizeRole } from "../middleware/auth";
import {
  createHousekeepingRequest,
  createEmergency,
  createEvent,
  createMaintenanceRequest,
  createNotice,
  getCampusContacts,
  getAdminPayments,
  updateAdminPayment,
  getMyRequestHistory,
  getMyRoomDetails,
  listHousekeepingRequests,
  listEmergencies,
  listEvents,
  listMaintenanceRequests,
  listMyHousekeepingRequests,
  listMyMaintenanceRequests,
  listNotices,
  resolveEmergency,
  updateHousekeepingStatus,
  updateMaintenanceStatus,
} from "../controllers/campus.controller";

const router = Router();

router.get(
  "/events",
  authenticateToken,
  authorizeRole([Role.ADMIN, Role.WARDEN, Role.STUDENT]),
  listEvents,
);
router.post(
  "/events",
  authenticateToken,
  authorizeRole([Role.ADMIN, Role.WARDEN]),
  createEvent,
);

router.get(
  "/notices",
  authenticateToken,
  authorizeRole([Role.ADMIN, Role.WARDEN, Role.STUDENT]),
  listNotices,
);
router.post(
  "/notices",
  authenticateToken,
  authorizeRole([Role.ADMIN, Role.WARDEN]),
  createNotice,
);

router.get(
  "/emergency",
  authenticateToken,
  authorizeRole([Role.ADMIN, Role.WARDEN, Role.STUDENT]),
  listEmergencies,
);
router.post(
  "/emergency",
  authenticateToken,
  authorizeRole([Role.ADMIN]),
  createEmergency,
);
router.post(
  "/emergency/:id/resolve",
  authenticateToken,
  authorizeRole([Role.ADMIN]),
  resolveEmergency,
);

router.get(
  "/payments/admin",
  authenticateToken,
  authorizeRole([Role.ADMIN]),
  getAdminPayments,
);
router.post(
  "/payments/admin/:id/update",
  authenticateToken,
  authorizeRole([Role.ADMIN]),
  updateAdminPayment,
);

router.get(
  "/maintenance",
  authenticateToken,
  authorizeRole([Role.ADMIN, Role.WARDEN]),
  listMaintenanceRequests,
);
router.get(
  "/maintenance/my",
  authenticateToken,
  authorizeRole([Role.STUDENT]),
  listMyMaintenanceRequests,
);
router.post(
  "/maintenance",
  authenticateToken,
  authorizeRole([Role.STUDENT]),
  createMaintenanceRequest,
);
router.post(
  "/maintenance/:id/status",
  authenticateToken,
  authorizeRole([Role.ADMIN, Role.WARDEN]),
  updateMaintenanceStatus,
);

router.get(
  "/housekeeping",
  authenticateToken,
  authorizeRole([Role.ADMIN, Role.WARDEN]),
  listHousekeepingRequests,
);
router.get(
  "/housekeeping/my",
  authenticateToken,
  authorizeRole([Role.STUDENT]),
  listMyHousekeepingRequests,
);
router.post(
  "/housekeeping",
  authenticateToken,
  authorizeRole([Role.STUDENT]),
  createHousekeepingRequest,
);
router.post(
  "/housekeeping/:id/status",
  authenticateToken,
  authorizeRole([Role.ADMIN, Role.WARDEN]),
  updateHousekeepingStatus,
);

router.get(
  "/room/my",
  authenticateToken,
  authorizeRole([Role.STUDENT]),
  getMyRoomDetails,
);
router.get(
  "/contacts",
  authenticateToken,
  authorizeRole([Role.STUDENT, Role.ADMIN, Role.WARDEN]),
  getCampusContacts,
);
router.get(
  "/requests/my",
  authenticateToken,
  authorizeRole([Role.STUDENT]),
  getMyRequestHistory,
);

export default router;
