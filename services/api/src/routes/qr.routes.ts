import { Router } from "express";
import { Role } from "@prisma/client";
import { getGateToken } from "../controllers/qr.controller";
import { authenticateToken, authorizeRole } from "../middleware/auth";

const router = Router();

router.get(
	"/gate-token",
	authenticateToken,
	authorizeRole([Role.SECURITY_GUARD, Role.ADMIN, Role.WARDEN]),
	getGateToken,
);

export default router;
