import crypto from "crypto";
import { env } from "../config/env.config";

const CREDENTIALS_CIPHER = "aes-256-gcm";

const resolveCredentialsKey = () => {
  const seed = env.JWT_SECRET;
  return crypto.createHash("sha256").update(seed).digest();
};

const key = resolveCredentialsKey();

export const encryptTemporaryPassword = (value: string) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(CREDENTIALS_CIPHER, key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`;
};

export const decryptTemporaryPassword = (payload?: string | null) => {
  if (!payload) {
    return null;
  }

  try {
    const [ivB64, tagB64, encryptedB64] = payload.split(":");
    if (!ivB64 || !tagB64 || !encryptedB64) {
      return null;
    }

    const decipher = crypto.createDecipheriv(
      CREDENTIALS_CIPHER,
      key,
      Buffer.from(ivB64, "base64"),
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedB64, "base64")),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  } catch {
    return null;
  }
};
