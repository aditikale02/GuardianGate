import crypto from "crypto";
import jwt from "jsonwebtoken";
import { QRCodePayload } from "@guardian/shared";
import { env } from "../config/env.config";

const { QR_SECRET } = env;

export const generateQRToken = (gateId: string): string => {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const payload: QRCodePayload = {
    gate_id: gateId,
    iat: nowSeconds,
    exp: nowSeconds + 30, // 30 seconds validity
    nonce: crypto.randomBytes(16).toString("hex"),
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
