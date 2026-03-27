# GuardianGate TODO

This file tracks remaining implementation tasks after the current auth + QR + scan + dashboard baseline.

## Frontend TODO

### Web Dashboard (`apps/web`)

- [ ] Add request trace viewer UI using `/api/v1/dashboard/request-trace` for debugging scan incidents.
- [ ] Add filters for logs (time range, direction, gate, student).
- [ ] Add pagination/virtualization for large live log datasets.
- [ ] Add stronger empty/loading/error states across all dashboard cards.
- [ ] Add session-expiry UX prompts before forced logout.

### Kiosk (`apps/kiosk`)

- [ ] Add gate selector UI (dynamic `gate_id`) instead of fixed `G-01`.
- [ ] Display token expiry and refresh failure recovery actions more clearly.
- [ ] Add connection/health indicator for API reachability.
- [ ] Add optional fullscreen/kiosk mode helpers for deployment terminals.

### Mobile PWA (`apps/mobile-pwa`)

- [ ] Add graceful camera permission denied flow with retry instructions.
- [ ] Add scan history for recent successful/failed scan attempts.
- [ ] Add better scanner controls (toggle camera, torch where supported).
- [ ] Improve offline/poor-network behavior messaging for scan submit failures.

### Shared Frontend

- [ ] Replace inline styles with a consistent shared UI component strategy.
- [ ] Add E2E tests for critical flows (login, gate-token, scan, dashboard refresh).

## Backend TODO

### API & Domain

- [ ] Replace `any` in auth/request typings with stricter request/response types.
- [ ] Add structured validation for all query params (e.g., `request_id`, `gate_id`) via shared schemas.
- [ ] Add student/admin management endpoints needed by full hostel workflows.
- [ ] Add historical reporting endpoints (daily attendance trends, gate utilization).

### Security & Reliability

- [ ] Move replay nonce store from in-memory to shared persistent store (Redis/DB) for multi-instance deployments.
- [ ] Add rate limits scoped by route sensitivity (auth, scan, token generation).
- [ ] Add audit log persistence for security events (failed auth, invalid scans, role violations).
- [ ] Finalize cookie hardening strategy for production proxy/TLS setups.

### Realtime & Observability

- [ ] Add Socket.IO reconnect/backoff metrics and monitoring hooks.
- [ ] Add health/readiness checks that include DB and socket readiness.
- [ ] Add centralized structured logging and log correlation output format.

### Data & Tooling

- [ ] Replace legacy Mongo seed scripts with Prisma-native seed scripts.
- [ ] Add migration/seed automation scripts for local onboarding.
- [ ] Add integration tests for auth refresh rotation and scan replay protection.
- [ ] Add CI pipeline for lint + test + build + functional smoke report generation.

## Documentation TODO

- [ ] Keep `docs/architecture.md` aligned with implemented role model and auth flow.
- [ ] Add an operations runbook for local PostgreSQL setup and troubleshooting.
- [ ] Document default demo user bootstrap steps (without legacy Mongo tooling).