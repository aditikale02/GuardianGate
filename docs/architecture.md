# GuardianGate Architecture

GuardianGate is a monorepo-based security and attendance platform for hostel entry/exit control.

## Core Components

### 1. API Service (`services/api`)

- **Runtime**: Node.js + Express + TypeScript
- **Database**: PostgreSQL via Prisma ORM
- **Security**: JWT access token + refresh cookie, role-based authorization, replay protection
- **Observability**: Request correlation (`x-request-id`) and request trace endpoint
- **Realtime**: Socket.IO events for dashboard updates

Key implemented API routes:

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`
- `GET /api/v1/qr/gate-token`
- `POST /api/v1/scan/submit`
- `GET /api/v1/dashboard/overview`
- `GET /api/v1/dashboard/request-trace`

### 2. Web Dashboard (`apps/web`)

- **Framework**: React + Vite + TypeScript
- **Purpose**: Admin/Warden operational dashboard
- **Capabilities**:
	- Auth login/session restore (`/auth/me`)
	- Dashboard summary + logs (`/dashboard/overview`)
	- Live updates (`scan:recorded`, `scan:invalid`)

### 3. Kiosk App (`apps/kiosk`)

- **Framework**: React + Vite + TypeScript
- **Purpose**: Gate terminal for live QR token presentation
- **Capabilities**:
	- Kiosk role-gated login (`SECURITY_GUARD` / `ADMIN`)
	- Auto-refreshing gate token every 30 seconds

### 4. Mobile PWA (`apps/mobile-pwa`)

- **Framework**: React + Vite + TypeScript
- **Purpose**: Student scanner app
- **Capabilities**:
	- Student-only login and session refresh handling
	- Camera-based scan (`html5-qrcode`)
	- Secure scan submit and replay rejection handling

## Security Model

- **Signed Gate Tokens**: QR payloads are signed and short-lived.
- **Replay Protection**: Nonce consumption prevents token reuse.
- **Client Role Gating**: Login request includes client context (`web`, `mobile`, `kiosk`) and enforces allowed roles.
- **Session Lifecycle**: Access token for API calls + refresh cookie rotation + logout invalidation.

## Runtime Topology (Development)

- Single Node process serves API + integrated Vite frontends.
- Entry points:
	- `/admin/` → web dashboard
	- `/kiosk/` → kiosk terminal
	- `/app/` → mobile PWA
	- `/health` → service health

## Technology Stack

| Layer        | Technology                     |
| ------------ | ------------------------------ |
| Frontend     | React, TypeScript, Vite        |
| Backend      | Node.js, Express, TypeScript   |
| Database     | PostgreSQL + Prisma            |
| Realtime     | Socket.IO                      |
| Validation   | Zod (`packages/shared`)        |
| Mobile Scan  | `html5-qrcode`                 |
| Kiosk QR     | `qrcode`                       |

---

_Document Version: 1.1.0_
