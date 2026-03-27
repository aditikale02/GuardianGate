import { Router } from "express";
import {
	login,
	register,
	getMe,
	refresh,
	logout,
} from "../controllers/auth.controller";
import { authenticateToken } from "../middleware/auth";
import { env } from "../config/env.config";

const router = Router();

router.post("/login", login);
router.post("/refresh", refresh);
router.post("/logout", logout);
if (env.NODE_ENV !== "production") {
	router.post("/register", register); // Dev only
}
router.get("/me", authenticateToken as any, getMe);

export default router;
