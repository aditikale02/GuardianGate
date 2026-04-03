import crypto from "crypto";
import jwt from "jsonwebtoken";
import { QRCodePayload, Role as SharedRole } from "@guardian/shared";
import { env } from "../config/env.config";

const { QR_SECRET } = env;

type GenerateTokenOptions = {
  generatedByUserId?: string;
  generatedByRole?: SharedRole;
};

type QRValidationResult = {
  payload: QRCodePayload | null;
  reason: "SUCCESS" | "EXPIRED" | "INVALID";
};

export const generateQRToken = (gateId: string, options: GenerateTokenOptions = {}): string => {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const payload: QRCodePayload = {
    gate_id: gateId,
    iat: nowSeconds,
    exp: nowSeconds + 30, // 30 seconds validity
    nonce: crypto.randomBytes(16).toString("hex"),
    generated_by_user_id: options.generatedByUserId,
    generated_by_role: options.generatedByRole,
  };

  // Sign the payload to prevent tampering using validated secret
  return jwt.sign(payload, QR_SECRET);
};

export const verifyQRToken = (token: string): QRCodePayload | null => {
  try {
    const decoded = jwt.verify(token, QR_SECRET) as QRCodePayload;
    return decoded;
  } catch (error) {
    return null;
  }
};

export const validateQRToken = (token: string): QRValidationResult => {
  try {
    const decoded = jwt.verify(token, QR_SECRET) as QRCodePayload;
    return { payload: decoded, reason: "SUCCESS" };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      const decoded = jwt.decode(token) as QRCodePayload | null;
      return { payload: decoded, reason: "EXPIRED" };
    }
    return { payload: null, reason: "INVALID" };
  }
};
