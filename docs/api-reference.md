# GuardianGate API Reference

This document describes the currently implemented REST API in services/api.

Base URL (local):

- http://localhost:3000/api/v1

Health endpoint:

- GET /health

Authentication model:

- Bearer access token in Authorization header for protected routes
- Refresh token via HTTP-only cookie for session renewal
- Request correlation via X-Request-Id header (automatically attached/returned)

## 1) Roles and Clients

Active roles:

- ADMIN
- WARDEN
- STUDENT

Client policy at login:

- web: ADMIN, WARDEN
- kiosk: ADMIN, WARDEN
- mobile: STUDENT

## 2) Auth Endpoints

Prefix: /auth

- POST /auth/login
  - Public
  - Protected by failed-attempt rate limiter
- POST /auth/admin/signup
  - Public (single-admin governance rules still apply)
- POST /auth/refresh
  - Public (uses refresh cookie)
- POST /auth/logout
  - Public
- GET /auth/me
  - Auth required
- POST /auth/change-password
  - Auth required
- POST /auth/register
  - Dev-only endpoint (non-production)

## 3) QR and Scan Endpoints

### QR Token

Prefix: /qr

- GET /qr/gate-token
  - Roles: ADMIN, WARDEN
  - Returns signed short-lived gate QR token

### Scan Submit

Prefix: /scan

- POST /scan/submit
  - Role: STUDENT
  - Validates token signature, expiry, replay scope, and student status
  - Derives action:
    - current ENTRY -> next EXIT
    - current EXIT -> next ENTRY

Exit details rule:

- EXIT requires destination
- If missing, API returns a requires-exit-details response

## 4) Dashboard Endpoints

Prefix: /dashboard

- GET /dashboard/overview
  - Roles: ADMIN, WARDEN
- GET /dashboard/students
  - Roles: ADMIN, WARDEN
- GET /dashboard/wardens
  - Roles: ADMIN, WARDEN
- GET /dashboard/attendance
  - Roles: ADMIN, WARDEN, STUDENT
- GET /dashboard/attendance/floor/options
  - Roles: ADMIN, WARDEN
- GET /dashboard/attendance/floor
  - Roles: ADMIN, WARDEN
- POST /dashboard/attendance/floor/save
  - Roles: ADMIN, WARDEN
- GET /dashboard/logs
  - Roles: ADMIN, WARDEN
- GET /dashboard/requests
  - Roles: ADMIN, WARDEN
- GET /dashboard/notifications
  - Roles: ADMIN, WARDEN, STUDENT
- POST /dashboard/notifications/:notificationId/read
  - Roles: ADMIN, WARDEN, STUDENT
- POST /dashboard/notifications/read-all
  - Roles: ADMIN, WARDEN, STUDENT
- GET /dashboard/reports
  - Roles: ADMIN, WARDEN
- GET /dashboard/settings
  - Roles: ADMIN, WARDEN
- GET /dashboard/profile
  - Roles: ADMIN, WARDEN, STUDENT
- GET /dashboard/request-trace
  - Roles: ADMIN, WARDEN

## 5) Workflow Endpoints

Prefix: /workflows

### Night Leave

- POST /workflows/night-leave
  - Role: STUDENT
- GET /workflows/night-leave/my
  - Role: STUDENT
- GET /workflows/night-leave
  - Roles: ADMIN, WARDEN
- POST /workflows/night-leave/:id/decision
  - Roles: ADMIN, WARDEN

### Guest

- POST /workflows/guests
  - Role: STUDENT
- GET /workflows/guests/my
  - Role: STUDENT
- GET /workflows/guests
  - Roles: ADMIN, WARDEN
- POST /workflows/guests/:id/decision
  - Roles: ADMIN, WARDEN

### Parcels

- POST /workflows/parcels
  - Role: STUDENT
- GET /workflows/parcels/my
  - Role: STUDENT
- GET /workflows/parcels
  - Roles: ADMIN, WARDEN
- POST /workflows/parcels/:id/status
  - Roles: ADMIN, WARDEN

### Medical

- POST /workflows/medical
  - Role: STUDENT
- GET /workflows/medical/my
  - Role: STUDENT
- GET /workflows/medical
  - Roles: ADMIN, WARDEN
- POST /workflows/medical/:id/status
  - Roles: ADMIN, WARDEN

### Suggestions

- POST /workflows/suggestions
  - Role: STUDENT
- GET /workflows/suggestions/my
  - Role: STUDENT
- GET /workflows/suggestions
  - Roles: ADMIN, WARDEN
- POST /workflows/suggestions/:id/respond
  - Roles: ADMIN, WARDEN

### Mess and Food

- GET /workflows/mess/timetable
  - Roles: STUDENT, ADMIN, WARDEN
- POST /workflows/mess/timetable
  - Roles: ADMIN, WARDEN
- GET /workflows/mess/menus/today
  - Roles: STUDENT, ADMIN, WARDEN
- POST /workflows/mess/menus
  - Roles: ADMIN, WARDEN
- POST /workflows/mess/ratings
  - Role: STUDENT
- GET /workflows/mess/feedback-summary
  - Roles: ADMIN, WARDEN

### Missing Reports

- POST /workflows/missing-reports
  - Role: STUDENT
- GET /workflows/missing-reports/my
  - Role: STUDENT
- GET /workflows/missing-reports
  - Roles: ADMIN, WARDEN
- POST /workflows/missing-reports/:id/status
  - Roles: ADMIN, WARDEN

## 6) Campus Endpoints

Prefix: /campus

### Events

- GET /campus/events
  - Roles: ADMIN, WARDEN, STUDENT
- POST /campus/events
  - Roles: ADMIN, WARDEN

### Notices

- GET /campus/notices
  - Roles: ADMIN, WARDEN, STUDENT
- POST /campus/notices
  - Roles: ADMIN, WARDEN

### Emergency

- GET /campus/emergency
  - Roles: ADMIN, WARDEN, STUDENT
- POST /campus/emergency
  - Role: ADMIN
- POST /campus/emergency/:id/resolve
  - Role: ADMIN

### Payments

- GET /campus/payments/admin
  - Role: ADMIN
- POST /campus/payments/admin/:id/update
  - Role: ADMIN

### Maintenance

- GET /campus/maintenance
  - Roles: ADMIN, WARDEN
- GET /campus/maintenance/my
  - Role: STUDENT
- POST /campus/maintenance
  - Role: STUDENT
- POST /campus/maintenance/:id/status
  - Roles: ADMIN, WARDEN

### Housekeeping

- GET /campus/housekeeping
  - Roles: ADMIN, WARDEN
- GET /campus/housekeeping/my
  - Role: STUDENT
- POST /campus/housekeeping
  - Role: STUDENT
- POST /campus/housekeeping/:id/status
  - Roles: ADMIN, WARDEN

### Student Utility

- GET /campus/room/my
  - Role: STUDENT
- GET /campus/contacts
  - Roles: STUDENT, ADMIN, WARDEN
- GET /campus/requests/my
  - Role: STUDENT

## 7) Admin Management Endpoints

Prefix: /admin

All endpoints under /admin require ADMIN role.

- GET /admin/users
- POST /admin/users/student
- POST /admin/users/warden
- PATCH /admin/users/:userId
- PATCH /admin/users/:userId/active
- POST /admin/users/:userId/reset-credentials

## 8) Rate Limiting and Security Notes

- Global API limiter is applied on /api, with auth routes excluded so dedicated auth throttling remains effective.
- Login endpoint has failed-attempt throttling with skipSuccessfulRequests enabled.
- Replay protection is applied in scan submission flow.
- Request IDs are propagated in logs and error payloads to improve traceability.

## 9) Real-Time Events

Socket.IO publishes gate activity to dashboard listeners.

Current events:

- scan:recorded
- scan:invalid

## 10) Common Response Patterns

- Validation errors: HTTP 400 with message or errors payload
- Auth errors: HTTP 401
- Role/authorization errors: HTTP 403
- Throttling errors: HTTP 429 with limiter message
- Server errors: HTTP 500 with request_id (and stack in non-production)
