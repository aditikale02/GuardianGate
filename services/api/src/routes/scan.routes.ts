import { Router } from "express";
import { Role } from "@prisma/client";
import { submitScan } from "../controllers/scan.controller";
import { authenticateToken, authorizeRole } from "../middleware/auth";

const router = Router();

router.post(
  "/submit",
  authenticateToken,
  authorizeRole([Role.STUDENT]),
  submitScan,
);

export default router;
