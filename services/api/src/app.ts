import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { rateLimit } from "express-rate-limit";
import compression from "compression";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth.routes";
import qrRoutes from "./routes/qr.routes";
import scanRoutes from "./routes/scan.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import workflowsRoutes from "./routes/workflows.routes";
import campusRoutes from "./routes/campus.routes";
import adminRoutes from "./routes/admin.routes";
import { attachRequestId } from "./middleware/request-id";
import { env } from "./config/env.config";

const app = express();
const IS_PROD = env.NODE_ENV === "production";

if (IS_PROD) {
  // Ensure secure cookies and original request metadata are handled correctly behind proxies.
  app.set("trust proxy", 1);
}

// Basic Production Hardening
app.use(compression());
if (IS_PROD) {
  // In production, apply full security headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          "img-src": ["'self'", "data:", "https:"],
          "script-src": ["'self'", "'unsafe-inline'"],
          "connect-src": ["'self'", "ws:", "wss:"],
        },
      },
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );
} else {
  // In development, skip CSP entirely — Vite HMR needs unsafe-eval and inline scripts
  app.use(helmet({ contentSecurityPolicy: false }));
}
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (!IS_PROD) {
        callback(null, true);
        return;
      }

      if (env.CORS_ORIGIN_LIST.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("CORS origin not allowed"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
  }),
);
app.use(attachRequestId);
app.use(express.json());
app.use(cookieParser());
morgan.token("request-id", (_req, res) => {
  const headerValue = res.getHeader("x-request-id");
  return typeof headerValue === "string" ? headerValue : "-";
});
app.use(
  morgan(
    IS_PROD
      ? ':remote-addr :method :url :status :res[content-length] - :response-time ms req=:request-id'
      : ':method :url :status :response-time ms req=:request-id',
  ),
);

// Global API limiter for non-auth routes; auth routes have dedicated auth-specific limits.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: IS_PROD ? 600 : 3000,
  message: { message: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path.startsWith("/v1/auth"),
});
app.use("/api", limiter);

// API Routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/qr", qrRoutes);
app.use("/api/v1/scan", scanRoutes);
app.use("/api/v1/dashboard", dashboardRoutes);
app.use("/api/v1/workflows", workflowsRoutes);
app.use("/api/v1/campus", campusRoutes);
app.use("/api/v1/admin", adminRoutes);

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date(),
    mode: IS_PROD ? "production" : "development",
  });
});

export const setupIntegratedDev = async (expressApp: express.Express) => {
  void expressApp;
  if (IS_PROD) return;
};

// Root endpoint
app.get("/", (_req, res) => {
  res.json({
    message: "Guardian Gate API",
    health: "/health",
  });
});

// Centralized Error Handler
app.use(
  (
    err: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    const requestIdHeader = res.getHeader("x-request-id");
    const requestId =
      typeof requestIdHeader === "string" ? requestIdHeader : "-";
    const status = err.status || 500;
    const isInternalError = status >= 500;

    const responseMessage =
      IS_PROD && isInternalError
        ? "Internal Server Error"
        : err.message || "Internal Server Error";

    console.error(`[Error][${requestId}] ${err.message}`);
    res.status(status).json({
      message: responseMessage,
      request_id: requestId,
      ...(IS_PROD ? {} : { stack: err.stack }),
    });
  },
);

export default app;
