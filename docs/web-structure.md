# GuardianGate User Web Structure

This document defines the user-facing web structure for the whole GuardianGate project.

## 1) Entry Surface (Public)

- **Route**: `/` (home landing)
- **Primary action**: choose login role from Access Portal
  - Student Login
  - Admin Login
  - Warden Login
- **Secondary actions**: explore features, open auth, open dashboard (if session exists)

## 2) App Route Map

### Unified runtime routes

- **Web dashboard**: `/admin/`
- **Kiosk terminal**: `/kiosk/`
- **Mobile PWA**: `/app/`
- **Service health**: `/health`

### API routes consumed by user apps

- Auth: `/api/v1/auth/login`, `/api/v1/auth/refresh`, `/api/v1/auth/logout`, `/api/v1/auth/me`
- QR: `/api/v1/qr/gate-token`
- Scan: `/api/v1/scan/submit`
- Dashboard modules:
  - `/api/v1/dashboard/overview`
  - `/api/v1/dashboard/attendance`
  - `/api/v1/dashboard/logs`
  - `/api/v1/dashboard/students`
  - `/api/v1/dashboard/wardens`
  - `/api/v1/dashboard/requests`
  - `/api/v1/dashboard/notifications`
  - `/api/v1/dashboard/reports`
  - `/api/v1/dashboard/settings`
  - `/api/v1/dashboard/profile`

## 3) Role-Based Web Information Architecture

## Student

- **Home** → Student Login
- **Auth** → Student session
- **Dashboard navigation**:
  - Overview
  - QR Center (scan submit)
  - Attendance
  - Notifications
  - Profile

## Warden

- **Home** → Warden Login
- **Auth** → Warden session
- **Dashboard navigation**:
  - Overview
  - QR Center (gate token generation)
  - Attendance
  - Logs
  - Requests
  - Notifications
  - Reports
  - Settings

## Admin

- **Home** → Admin Login / Signup
- **Auth** → Admin session
- **Dashboard navigation**:
  - Overview
  - QR Center (gate token generation)
  - Students
  - Wardens
  - Attendance
  - Logs
  - Requests
  - Notifications
  - Reports
  - Settings

## 4) Frontend Workspace Structure

## apps/web

- **Purpose**: main user-facing portal (home/auth/dashboard)
- **Current shell**: single app in `src/App.tsx`
- **Shared visual system**: `packages/shared-ui/theme.css`

Recommended internal module split (next refactor step):

- `src/pages/`
  - `HomePage.tsx`
  - `AuthPage.tsx`
  - `DashboardPage.tsx`
- `src/features/dashboard/`
  - `overview/`
  - `qr-center/`
  - `attendance/`
  - `logs/`
  - `requests/`
  - `notifications/`
  - `reports/`
  - `settings/`
  - `profile/`
- `src/components/`
  - `Brand/`
  - `Sidebar/`
  - `Topbar/`
  - `MetricCard/`
  - `DataTable/`
- `src/lib/`
  - `api.ts`
  - `session.ts`
  - `constants.ts`

## apps/kiosk

- **Purpose**: gate terminal QR display
- **User flow**: login → auto-refresh gate QR every ~30s

## apps/mobile-pwa

- **Purpose**: student scan app
- **User flow**: login → start scanner → submit scan token → status update

## 5) Session & Access Behavior

- Session bootstrap tries `/auth/me` and fallback `/auth/refresh`.
- Redirect to dashboard occurs only after valid session verification.
- Role + client checks enforced by backend (`web`, `kiosk`, `mobile`).

## 6) Realtime UX Layer

- Web dashboard receives Socket.IO events:
  - `scan:recorded`
  - `scan:invalid`
- Overview widgets and logs update live for Admin/Warden.

## 7) Design System Responsibility

- `packages/shared-ui/theme.css` is the global style source.
- Typography, spacing rhythm, cards, badges, and tables should be updated here first.
- App-level inline styles should gradually move into reusable theme classes.

## 8) Project-Wide User Web Structure Summary

- **Public entry**: clean role-based access from home.
- **Private surfaces**: role-specific dashboards with shared visual language.
- **Specialized clients**: kiosk for gate QR output, mobile PWA for student scan input.
- **Single backend contract**: all user apps integrate through the same secured API and refresh model.
