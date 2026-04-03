import { Response } from "express";
import { generateQRToken } from "../utils/qr";
import { AuthRequest } from "../middleware/auth";

export const getGateToken = async (req: AuthRequest, res: Response) => {
  const gateIdRaw = req.query.gate_id;
  const gateId = typeof gateIdRaw === "string" ? gateIdRaw : "G-01";

  if (!/^[A-Za-z0-9_-]{2,32}$/.test(gateId)) {
    res.status(400).json({ message: "Invalid gate_id" });
    return;
  }

  const generatedByRole =
    req.user?.role === "ADMIN" || req.user?.role === "WARDEN" || req.user?.role === "STUDENT"
      ? req.user.role
      : undefined;

  const token = generateQRToken(gateId, {
    generatedByUserId: req.user?.id,
    generatedByRole,
  });
  const generatedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 30 * 1000).toISOString();

  res.json({
    token,
    gate_id: gateId,
    generated_at: generatedAt,
    expires_at: expiresAt,
  });
};
