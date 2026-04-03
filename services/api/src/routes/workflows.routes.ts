import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticateToken, authorizeRole } from "../middleware/auth";
import {
  createMissingReport,
  createGuestRequest,
  createMedicalRequest,
  createNightLeaveRequest,
  createParcelRequest,
  createSuggestion,
  decideGuestRequest,
  decideNightLeaveRequest,
  getMessFeedbackSummary,
  getMessTimetable,
  listGuestRequests,
  listMedicalRequests,
  listMissingReports,
  listMyGuestRequests,
  listMyMissingReports,
  listMyMedicalRequests,
  listMyNightLeaveRequests,
  listMyParcels,
  listMySuggestions,
  listNightLeaveRequests,
  listParcels,
  listSuggestions,
  listTodayMenus,
  respondSuggestion,
  submitFoodRating,
  updateMedicalRequestStatus,
  updateMissingReportStatus,
  updateParcelStatus,
  upsertMessTimetable,
  upsertMenu,
} from "../controllers/workflows.controller";

const router = Router();

// Night leave
router.post(
  "/night-leave",
  authenticateToken,
  authorizeRole([Role.STUDENT]),
  createNightLeaveRequest,
);
router.get(
  "/night-leave/my",
  authenticateToken,
  authorizeRole([Role.STUDENT]),
  listMyNightLeaveRequests,
);
router.get(
  "/night-leave",
  authenticateToken,
  authorizeRole([Role.ADMIN, Role.WARDEN]),
  listNightLeaveRequests,
);
router.post(
  "/night-leave/:id/decision",
  authenticateToken,
  authorizeRole([Role.ADMIN, Role.WARDEN]),
  decideNightLeaveRequest,
);

// Guest registration
router.post(
  "/guests",
  authenticateToken,
  authorizeRole([Role.STUDENT]),
  createGuestRequest,
);
router.get(
  "/guests/my",
  authenticateToken,
  authorizeRole([Role.STUDENT]),
  listMyGuestRequests,
);
router.get(
  "/guests",
  authenticateToken,
  authorizeRole([Role.ADMIN, Role.WARDEN]),
  listGuestRequests,
);
router.post(
  "/guests/:id/decision",
  authenticateToken,
  authorizeRole([Role.ADMIN, Role.WARDEN]),
  decideGuestRequest,
);

// Parcel management
router.post(
  "/parcels",
  authenticateToken,
  authorizeRole([Role.STUDENT]),
  createParcelRequest,
);
router.get(
  "/parcels/my",
  authenticateToken,
  authorizeRole([Role.STUDENT]),
  listMyParcels,
);
router.get(
  "/parcels",
  authenticateToken,
  authorizeRole([Role.ADMIN, Role.WARDEN]),
  listParcels,
);
router.post(
  "/parcels/:id/status",
  authenticateToken,
  authorizeRole([Role.ADMIN, Role.WARDEN]),
  updateParcelStatus,
);

// Medical requests
router.post(
  "/medical",
  authenticateToken,
  authorizeRole([Role.STUDENT]),
  createMedicalRequest,
);
router.get(
  "/medical/my",
  authenticateToken,
  authorizeRole([Role.STUDENT]),
  listMyMedicalRequests,
);
router.get(
  "/medical",
  authenticateToken,
  authorizeRole([Role.ADMIN, Role.WARDEN]),
  listMedicalRequests,
);
router.post(
  "/medical/:id/status",
  authenticateToken,
  authorizeRole([Role.ADMIN, Role.WARDEN]),
  updateMedicalRequestStatus,
);

// Suggestions
router.post(
  "/suggestions",
  authenticateToken,
  authorizeRole([Role.STUDENT]),
  createSuggestion,
);
router.get(
  "/suggestions/my",
  authenticateToken,
  authorizeRole([Role.STUDENT]),
  listMySuggestions,
);
router.get(
  "/suggestions",
  authenticateToken,
  authorizeRole([Role.ADMIN, Role.WARDEN]),
  listSuggestions,
);
router.post(
  "/suggestions/:id/respond",
  authenticateToken,
  authorizeRole([Role.ADMIN, Role.WARDEN]),
  respondSuggestion,
);

// Mess / food
router.get(
  "/mess/timetable",
  authenticateToken,
  authorizeRole([Role.STUDENT, Role.ADMIN, Role.WARDEN]),
  getMessTimetable,
);
router.post(
  "/mess/timetable",
  authenticateToken,
  authorizeRole([Role.ADMIN, Role.WARDEN]),
  upsertMessTimetable,
);
router.get(
  "/mess/menus/today",
  authenticateToken,
  authorizeRole([Role.STUDENT, Role.ADMIN, Role.WARDEN]),
  listTodayMenus,
);
router.post(
  "/mess/menus",
  authenticateToken,
  authorizeRole([Role.ADMIN, Role.WARDEN]),
  upsertMenu,
);
router.post(
  "/mess/ratings",
  authenticateToken,
  authorizeRole([Role.STUDENT]),
  submitFoodRating,
);
router.get(
  "/mess/feedback-summary",
  authenticateToken,
  authorizeRole([Role.ADMIN, Role.WARDEN]),
  getMessFeedbackSummary,
);

// Missing reports
router.post(
  "/missing-reports",
  authenticateToken,
  authorizeRole([Role.STUDENT]),
  createMissingReport,
);
router.get(
  "/missing-reports/my",
  authenticateToken,
  authorizeRole([Role.STUDENT]),
  listMyMissingReports,
);
router.get(
  "/missing-reports",
  authenticateToken,
  authorizeRole([Role.ADMIN, Role.WARDEN]),
  listMissingReports,
);
router.post(
  "/missing-reports/:id/status",
  authenticateToken,
  authorizeRole([Role.ADMIN, Role.WARDEN]),
  updateMissingReportStatus,
);

export default router;
