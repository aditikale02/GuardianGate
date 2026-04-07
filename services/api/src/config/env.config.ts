import { z } from "zod";
import dotenv from "dotenv";
import path from "path";

const envCandidates = [
  // Load API env first, then root env. Existing process env always takes precedence.
  path.resolve(process.cwd(), "services/api/.env"),
  path.join(__dirname, "../../.env"),
  path.resolve(process.cwd(), ".env"),
  path.join(__dirname, "../../../../.env"),
];

for (const candidate of envCandidates) {
  dotenv.config({ path: candidate });
}

const parseOriginList = (value?: string) => {
  if (!value) return [];

  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
};

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.string().transform(Number).default("3000"),
  DATABASE_URL: z.string().url().optional(),
  SUPABASE_DATABASE_URL: z.string().url().optional(),
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
  PUSHER_APP_ID: z.string().optional(),
  PUSHER_KEY: z.string().optional(),
  PUSHER_SECRET: z.string().optional(),
  PUSHER_CLUSTER: z.string().optional(),
  ENABLE_ADMIN_SIGNUP: z
    .preprocess((value) => {
      if (typeof value === "string") {
        return value.toLowerCase() === "true";
      }
      return value;
    }, z.boolean().optional()),
  DEFAULT_ADMIN_EMAIL: z.string().email().default("admin@guardian.com"),
  DEFAULT_ADMIN_PASSWORD: z.string().min(8).default("Admin@123"),
  FRONTEND_ORIGIN: z.string().url().optional(),
  CORS_ORIGINS: z.string().optional(),
  SOCKET_CORS_ORIGINS: z.string().optional(),
  GATE_LATITUDE: z.string().transform(Number).optional(),
  GATE_LONGITUDE: z.string().transform(Number).optional(),
  GATE_RADIUS_METERS: z.string().transform(Number).default("10"),
  QR_VALIDITY_MINUTES: z.string().transform(Number).default("5"),
  QR_ENTRY_CUTOFF_TIME: z.string().default("21:00"),
  QR_EXIT_CUTOFF_TIME: z.string().default("22:00"),
}).superRefine((data, ctx) => {
  if (!data.DATABASE_URL && !data.SUPABASE_DATABASE_URL) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Either DATABASE_URL or SUPABASE_DATABASE_URL must be set",
      path: ["DATABASE_URL"],
    });
  }
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

const resolvedCorsOrigins = Array.from(
  new Set([
    ...parseOriginList(_env.data.CORS_ORIGINS),
    ...(_env.data.FRONTEND_ORIGIN ? [_env.data.FRONTEND_ORIGIN] : []),
  ]),
);

const resolvedSocketCorsOrigins = Array.from(
  new Set([
    ...parseOriginList(_env.data.SOCKET_CORS_ORIGINS),
    ...resolvedCorsOrigins,
  ]),
);

export const env = {
  ..._env.data,
  ENABLE_ADMIN_SIGNUP: hasExplicitAdminSignupFlag
    ? Boolean(_env.data.ENABLE_ADMIN_SIGNUP)
    : _env.data.NODE_ENV !== "production",
  CORS_ORIGIN_LIST: resolvedCorsOrigins,
  SOCKET_CORS_ORIGIN_LIST: resolvedSocketCorsOrigins,
};
export type Env = z.infer<typeof envSchema>;
