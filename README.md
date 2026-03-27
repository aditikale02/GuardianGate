# GuardianGate - Hostel Entry and Attendance Platform

GuardianGate is a monorepo-based system for secure hostel gate access with QR validation, role-based app access, and real-time dashboard visibility.

## Current Implementation Status

### Backend (Implemented)

- JWT auth with access + refresh token flow
- Refresh cookie rotation and logout invalidation
- Client-aware role gating on login (`web`, `mobile`, `kiosk`)
- Signed gate QR token generation (`/api/v1/qr/gate-token`)
- Student scan submission endpoint (`/api/v1/scan/submit`)
- Replay protection using nonce consumption
- Dashboard overview endpoint with stats, recent logs, invalid scan summaries
- Request trace endpoint (`/api/v1/dashboard/request-trace`)
- Real-time scan events over Socket.IO (`scan:recorded`, `scan:invalid`)
- Request correlation IDs (`x-request-id`) and API request logging

### Frontend Apps (Implemented)

- **Web Dashboard (`/admin/`)**
   - Login/logout, session restore via `/me`, refresh fallback
   - Live dashboard stats + logs from `/dashboard/overview`
   - Real-time updates for valid and invalid scans via Socket.IO

- **Kiosk (`/kiosk/`)**
   - Login/logout with role guard (`SECURITY_GUARD` or `ADMIN`)
   - Auto-refreshing gate QR token display (30s window)

- **Mobile PWA (`/app/`)**
   - Login/logout with student-only role guard
   - Camera QR scanner (`html5-qrcode`) integration
   - Scan submit flow with refresh retry handling

### Quality and Verification (Implemented)

- Monorepo build passes (`npm run build`)
- Workspace tests pass (`npm test`)
- Functional smoke checks for auth, dashboard, kiosk token, scan, replay, refresh/logout

## Tech Stack

- **Frontend**: React, TypeScript, Vite
- **Backend**: Node.js, Express, Prisma, PostgreSQL, Socket.IO
- **Security**: JWT, signed QR payloads, role-gating, replay protection
- **Shared**: Zod schemas and shared TS types

## Prerequisites

- Node.js 18+
- npm
- PostgreSQL (local or hosted)

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Configure environment:

- Update `services/api/.env` with your `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, and `QR_SECRET`.

3. Sync Prisma schema to your database:

```bash
cd services/api
npx prisma db push
cd ../..
```

4. Start development server:

```bash
npm run dev
```

5. Open apps:

- API Health: http://localhost:3000/health
- Web Dashboard: http://localhost:3000/admin/
- Kiosk: http://localhost:3000/kiosk/
- Mobile PWA: http://localhost:3000/app/

## Development Scripts

- `npm run dev` - Start API with integrated frontend routes
- `npm run build` - Build all workspaces
- `npm run test` - Run tests across workspaces
- `npm run lint` - Run lint across workspaces
- `npm run dev:api` - Start API only
- `npm run dev:web` - Start web app only
- `npm run dev:kiosk` - Start kiosk app only
- `npm run dev:pwa` - Start mobile PWA only

## Monorepo Structure

```
GuardianGate/
├── apps/
│   ├── web/
│   ├── kiosk/
│   └── mobile-pwa/
├── services/
│   └── api/
├── packages/
│   ├── shared/
│   └── shared-ui/
└── docs/
```

## Roadmap

- Pending work is tracked in `TODO.md`.

## Documentation

- [Architecture](docs/architecture.md)
- [Setup](docs/setup.md)
- [User Web Structure](docs/web-structure.md)

## License

Private - All rights reserved.
