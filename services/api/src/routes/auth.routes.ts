import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import {
	login,
	register,
	getMe,
	refresh,
	logout,
	changePassword,
	adminSignup,
} from "../controllers/auth.controller";
import { authenticateToken } from "../middleware/auth";
import { env } from "../config/env.config";

const router = Router();

const loginLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: env.NODE_ENV === "production" ? 20 : 100,
	skipSuccessfulRequests: true,
	standardHeaders: true,
	legacyHeaders: false,
	message: {
		message: "Too many failed login attempts. Please try again in a few minutes.",
	},
});

router.post("/login", loginLimiter, login);
router.post("/admin/signup", adminSignup);
router.post("/refresh", refresh);
router.post("/logout", logout);
if (env.NODE_ENV !== "production") {
	router.post("/register", register); // Dev only
}
router.get("/me", authenticateToken as any, getMe);
router.post("/change-password", authenticateToken as any, changePassword);

export default router;
