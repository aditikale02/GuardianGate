import { Router } from "express";
import { Role } from "@prisma/client";
import {
  createStudentUser,
  createWardenUser,
  listUsers,
  resetUserCredentials,
  setUserActiveState,
  updateUser,
} from "../controllers/admin.management.controller";
import { authenticateToken, authorizeRole } from "../middleware/auth";

const router = Router();

router.use(authenticateToken, authorizeRole([Role.ADMIN]));

router.get("/users", listUsers);
router.post("/users/student", createStudentUser);
router.post("/users/warden", createWardenUser);
router.patch("/users/:userId", updateUser);
router.patch("/users/:userId/active", setUserActiveState);
router.post("/users/:userId/reset-credentials", resetUserCredentials);

export default router;
