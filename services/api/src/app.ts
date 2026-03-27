import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import { rateLimit } from "express-rate-limit";
import compression from "compression";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth.routes";
import qrRoutes from "./routes/qr.routes";
import scanRoutes from "./routes/scan.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import { attachRequestId } from "./middleware/request-id";
import { createServer as createViteServer } from "vite";
import fs from "fs";

const app = express();
const IS_PROD = process.env.NODE_ENV === "production";

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
    origin: true, // Reflect request origin
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

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: IS_PROD ? 100 : 1000, // Stricter in production
  message: { message: "Too many requests, please try again later." },
});
app.use("/api", limiter);

// API Routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/qr", qrRoutes);
app.use("/api/v1/scan", scanRoutes);
app.use("/api/v1/dashboard", dashboardRoutes);

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date(),
    mode: IS_PROD ? "production" : "development",
  });
});

// Frontend Applications
if (IS_PROD) {
  // In production, serve built assets
  // Note: We assume the apps are built and located in their respective dist folders
  const APPS_PATH = path.join(__dirname, "..", "..", "..", "apps");

  // Web Dashboard
  const webDist = path.resolve(APPS_PATH, "web", "dist");
  app.use("/admin", express.static(webDist, { maxAge: "1d", etag: true }));
  app.get("/admin/*", (_req, res) =>
    res.sendFile(path.join(webDist, "index.html")),
  );

  // Kiosk
  const kioskDist = path.resolve(APPS_PATH, "kiosk", "dist");
  app.use("/kiosk", express.static(kioskDist, { maxAge: "1d", etag: true }));
  app.get("/kiosk/*", (_req, res) =>
    res.sendFile(path.join(kioskDist, "index.html")),
  );

  // Mobile PWA
  const pwaDist = path.resolve(APPS_PATH, "mobile-pwa", "dist");
  app.use("/app", express.static(pwaDist, { maxAge: "1d", etag: true }));
  app.get("/app/*", (_req, res) =>
    res.sendFile(path.join(pwaDist, "index.html")),
  );
}

export const setupIntegratedDev = async (expressApp: express.Express) => {
  if (IS_PROD) return;

  console.log("🚀 Setting up integrated Vite development servers...");

  const createViteInstance = async (
    base: string,
    rootDir: string,
    hmrPort: number,
  ) => {
    const fullRoot = path.resolve(__dirname, rootDir);
    console.log(`🔍 Instantiating Vite for ${base} at ${fullRoot}...`);

    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: { port: hmrPort },
      },
      appType: "spa",
      base,
      root: fullRoot,
      configFile: path.resolve(fullRoot, "vite.config.ts"),
    });

    // CRITICAL: Wrap Vite's connect middleware with a path filter.
    // Mount at root level so Vite sees the FULL path (e.g. /admin/@vite/client),
    // but guard so each instance only handles its own prefix.
    // Without this guard, all three Vite instances compete and the last one wins.
    expressApp.use((req, res, next) => {
      const trimmedBase = base.replace(/\/$/, "");
      if (req.path.startsWith(base) || req.path === trimmedBase) {
        return vite.middlewares(req, res, next);
      }
      next();
    });

    // SPA catch-all: serve transformed index.html for all HTML requests under this prefix
    const trimmed = base.replace(/\/$/, "");
    expressApp.get(`${trimmed}*`, async (req, res, next) => {
      const url = req.originalUrl;
      // Skip asset requests (files with extensions)
      if (/\.[^/]+$/.test(url) && !url.endsWith(".html")) return next();
      try {
        const indexPath = path.resolve(fullRoot, "index.html");
        let template = fs.readFileSync(indexPath, "utf-8");
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });

    console.log(`✅ Vite instantiated for ${base} (HMR Port: ${hmrPort})`);
    return vite;
  };

  // Instantiate sequentially so middleware order is deterministic
  await createViteInstance("/admin/", "../../../apps/web", 5173);
  await createViteInstance("/kiosk/", "../../../apps/kiosk", 5174);
  await createViteInstance("/app/", "../../../apps/mobile-pwa", 5175);
};

// Root redirect
app.get("/", (_req, res) => {
  res.redirect("/admin/");
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

    console.error(`[Error][${requestId}] ${err.message}`);
    const status = err.status || 500;
    res.status(status).json({
      message: err.message || "Internal Server Error",
      request_id: requestId,
      ...(IS_PROD ? {} : { stack: err.stack }),
    });
  },
);

export default app;
