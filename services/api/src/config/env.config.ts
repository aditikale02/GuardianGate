import { z } from "zod";
import dotenv from "dotenv";
import path from "path";

// Load .env from root if it exists
const rootEnv = path.join(__dirname, "../../../../.env");
const localEnv = path.join(__dirname, "../../.env");

// Prefer root .env, then local .env
dotenv.config({ path: rootEnv });
dotenv.config({ path: localEnv });

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.string().transform(Number).default("3000"),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
  QR_SECRET: z.string().min(32, "QR_SECRET must be at least 32 characters"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().transform(Number).optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  ENABLE_ADMIN_SIGNUP: z
    .preprocess((value) => {
      if (typeof value === "string") {
        return value.toLowerCase() === "true";
      }
      return value;
    }, z.boolean().optional()),
  DEFAULT_ADMIN_EMAIL: z.string().email().default("admin@guardian.com"),
  DEFAULT_ADMIN_PASSWORD: z.string().min(8).default("Admin@123"),
  GATE_LATITUDE: z.string().transform(Number).optional(),
  GATE_LONGITUDE: z.string().transform(Number).optional(),
  GATE_RADIUS_METERS: z.string().transform(Number).default("10"),
  QR_VALIDITY_MINUTES: z.string().transform(Number).default("5"),
  QR_ENTRY_CUTOFF_TIME: z.string().default("21:00"),
  QR_EXIT_CUTOFF_TIME: z.string().default("22:00"),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error(
    "❌ Invalid environment variables:",
    JSON.stringify(_env.error.format(), null, 2),
  );
  process.exit(1);
}

const hasExplicitAdminSignupFlag =
  typeof process.env.ENABLE_ADMIN_SIGNUP === "string";

export const env = {
  ..._env.data,
  ENABLE_ADMIN_SIGNUP: hasExplicitAdminSignupFlag
    ? Boolean(_env.data.ENABLE_ADMIN_SIGNUP)
    : _env.data.NODE_ENV !== "production",
};
export type Env = z.infer<typeof envSchema>;
