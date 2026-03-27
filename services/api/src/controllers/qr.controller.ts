import { Request, Response } from "express";
import { generateQRToken } from "../utils/qr";

export const getGateToken = async (req: Request, res: Response) => {
  const gateIdRaw = req.query.gate_id;
  const gateId = typeof gateIdRaw === "string" ? gateIdRaw : "G-01";

  if (!/^[A-Za-z0-9_-]{2,32}$/.test(gateId)) {
    res.status(400).json({ message: "Invalid gate_id" });
    return;
  }

  const token = generateQRToken(gateId);
  const expiresAt = new Date(Date.now() + 30 * 1000).toISOString();

  res.json({
    token,
    gate_id: gateId,
    expires_at: expiresAt,
  });
};
