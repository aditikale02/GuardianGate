# GuardianGate Frontend

GuardianGate frontend is the role-aware web client for hostel operations. It supports three active roles:

- `ADMIN`
- `WARDEN`
- `STUDENT`

This README documents the complete workflow and userflow currently implemented in the frontend and its API integrations.

## 1. What This App Does

The frontend provides:

- Role-specific login and dashboard access.
- Student self-service flows (requests, mess, reports, notices, profile and history views).
- Admin and warden operational flows (approval pipelines, management queues, analytics, notices/events, mess operations).
- Auth/session reliability with access-token use plus refresh-cookie rotation.
- Forced first-login password change for newly provisioned accounts.

## 2. High-Level Architecture

The frontend is a React + Vite + TypeScript SPA with:

- `react-router-dom` for route-driven role experiences.
- `@tanstack/react-query` for API data fetching and mutation orchestration.
- Shared authenticated request wrapper that injects bearer token and request correlation IDs.

Backend API base is resolved from `VITE_API_BASE_URL` and defaults to `/api/v1`.

## 3. Role Model and Policy Constraints

### Supported Roles

Only these roles are considered valid in active flows:

- `ADMIN`
- `WARDEN`
- `STUDENT`

Legacy/retired roles are blocked at login by backend policy.

### Single-Admin Policy

The platform enforces a single-admin model:

- Admin signup is allowed only if no existing admin account exists.
- Additional admin signup attempts are blocked.
- Existing data can be normalized using admin-enforcement scripts on the API side.

### Client Access Policy

Login payloads include a `client` type:

- `web`: `ADMIN`, `WARDEN`
- `mobile`: `STUDENT`
- `kiosk`: `ADMIN`, `WARDEN`

## 4. Authentication and Session Flow

### Login

Role-specific pages:

- `/login/student`
- `/login/warden`
- `/login/admin`

On success:

1. Access token is stored in memory.
2. Session payload is stored in `sessionStorage`.
3. Refresh token is managed as HTTP-only cookie by backend.

### Silent Session Recovery

On bootstrap or expired access token scenarios:

1. Frontend calls `POST /auth/refresh`.
2. If refresh succeeds, token/session are restored.
3. If refresh fails, session is cleared and user is effectively signed out.

### First Login Password Reset

If `first_login` is true, the user is redirected to:

- `/auth/change-password`

This enforces initial credential hardening for provisioned users.

### Logout

Logout clears local session and backend rotates/invalidate refresh context.

## 5. Frontend Route Map

## Public Routes

- `/` home/entry
- `/login/student`
- `/login/warden`
- `/login/admin`
- `/signup/admin`
- `/auth/change-password`

## Student Routes (`/student/*`)

- `/student`
- `/student/profile`
- `/student/attendance`
- `/student/notifications`
- `/student/parcels`
- `/student/guest`
- `/student/night-leave`
- `/student/medical`
- `/student/suggestions`
- `/student/mess`
- `/student/payment`
- `/student/events`
- `/student/maintenance`
- `/student/housekeeping`
- `/student/emergency`
- `/student/room`
- `/student/contact`
- `/student/request-history`
- `/student/notices`
- `/student/missing-reports`

## Admin/Warden Routes (`/admin/*`)

- `/admin`
- `/admin/users`
- `/admin/students`
- `/admin/wardens`
- `/admin/attendance`
- `/admin/notifications`
- `/admin/profile`
- `/admin/settings`
- `/admin/requests`
- `/admin/reports`
- `/admin/leave-requests`
- `/admin/guest-entries`
- `/admin/parcels`
- `/admin/medical`
- `/admin/maintenance`
- `/admin/housekeeping`
- `/admin/mess`
- `/admin/payments`
- `/admin/events`
- `/admin/suggestions`
- `/admin/notices`
- `/admin/emergency`
- `/admin/missing-reports`

## 6. API Domain Map (Used by Frontend)

## Auth (`/auth`)

- `POST /auth/login`
- `POST /auth/admin/signup`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`
- `POST /auth/change-password`

## Campus (`/campus`)

- Events: `GET /events`, `POST /events`
- Notices: `GET /notices`, `POST /notices`
- Emergency: `GET /emergency`, `POST /emergency`, `POST /emergency/:id/resolve`
- Payments: `GET /payments/admin`, `GET /payments/my`
- Maintenance: listing, self-listing, create, status update
- Housekeeping: listing, self-listing, create, status update
- Student room/contacts/history:
	- `GET /room/my`
	- `GET /contacts`
	- `GET /requests/my`

## Workflows (`/workflows`)

- Night leave: create/list/decision flows
- Guest request: create/list/decision flows
- Parcels: create/list/status flows
- Medical: create/list/status flows
- Suggestions: create/list/respond flows
- Mess:
	- `GET/POST /mess/timetable`
	- `GET /mess/menus/today`
	- `POST /mess/menus`
	- `POST /mess/ratings`
	- `GET /mess/feedback-summary`
- Missing reports:
	- `POST /missing-reports`
	- `GET /missing-reports/my`
	- `GET /missing-reports`
	- `POST /missing-reports/:id/status`

## Dashboard (`/dashboard`)

- `GET /overview`
- `GET /students`
- `GET /wardens`
- `GET /attendance`
- `GET /logs`
- `GET /requests`
- Notifications read and read-all endpoints
- `GET /reports`
- `GET /settings`
- `GET /profile`
- `GET /request-trace`

## 7. Permissions Matrix (Operational)

### Student

- Can login only via student client flow.
- Can create own requests:
	- Night leave
	- Guest
	- Parcel
	- Medical
	- Suggestion
	- Maintenance
	- Housekeeping
	- Missing report
- Can view personal and campus information:
	- Attendance, notifications, profile, room details, contacts, events, notices, payments, request history, mess timetable/menus.
- Cannot access admin dashboard modules.

### Warden

- Can login on web/kiosk.
- Can process operational queues:
	- Leave/guest decisions
	- Parcel/medical/maintenance/housekeeping status updates
	- Suggestions response
	- Missing report status management
- Can create notices and events.
- Can manage mess timetable/menu and view feedback summary.
- Can access reports/overview/requests dashboards.
- Cannot create or resolve emergencies (admin-only by policy).

### Admin

- Full warden operational capabilities.
- Exclusive capabilities:
	- User management (`/admin/users`)
	- Emergency create/resolve
	- Full governance control for the single-hostel setup.

## 8. End-to-End Userflows

## A. Admin Onboarding and Governance

1. Open `/signup/admin`.
2. Complete account creation (allowed only if no admin exists).
3. Login at `/login/admin`.
4. Enter `/admin/users` to provision students and wardens.
5. System issues temporary password and email-delivery status is tracked.
6. Admin monitors requests/reports and handles emergency operations.

## B. Warden Operational Cycle

1. Login at `/login/warden`.
2. Open queue pages (`leave-requests`, `guest-entries`, `parcels`, `medical`, `maintenance`, `housekeeping`).
3. Process requests via decision/status actions.
4. Publish updates via notices/events.
5. Maintain mess timetable/menus and review feedback trends.
6. Review analytics in reports and overview pages.

## C. Student Daily Journey

1. Login at `/login/student`.
2. If first login, complete mandatory password change.
3. Use student dashboard modules:
	- Request submissions (leave, guest, medical, maintenance, housekeeping, missing reports).
	- View outcomes and history.
	- View notices, events, attendance, and payments.
	- Access mess timetable/menus and submit food ratings.
4. Track lifecycle updates through notifications and request history.

## D. Missing Reports Workflow

1. Student submits report from `/student/missing-reports`.
2. Report appears in admin/warden queue `/admin/missing-reports`.
3. Staff updates status (investigation/progress/resolved states per backend rules).
4. Student sees status progression in personal list.

## E. Mess Timetable Dual-Mode Workflow

1. Admin/warden updates timetable via `/admin/mess`.
2. Timetable supports structured weekly data and image-reference mode.
3. Student consumes timetable and today menu from `/student/mess`.
4. Student submits food ratings; admin/warden review feedback summary.

## 9. Development Setup

From repository root:

```bash
npm install
```

Run API and frontend together:

```bash
npm run dev:all
```

Or run frontend only:

```bash
npm run dev:frontend
```

Frontend local URL is typically:

- `http://localhost:8080`

If API runs on a different origin, set `VITE_API_BASE_URL` accordingly.

## 10. Quality Gates

Recommended checks before merge:

```bash
npm run build
npm run test
npm run lint
```

For frontend-only checks:

```bash
npm run build --workspace=frontend
npm run test --workspace=frontend
npm run lint --workspace=frontend
```

## 11. Troubleshooting

## Login fails with role/client mismatch

- Ensure role uses correct login page:
	- Student -> `/login/student`
	- Warden -> `/login/warden`
	- Admin -> `/login/admin`

## Session resets unexpectedly

- Verify refresh cookie is present and API `/auth/refresh` is reachable.
- Check `VITE_API_BASE_URL` and CORS/cookie settings in API environment.

## Admin signup blocked

- Expected when an admin already exists (single-admin enforcement).

## Feature visible but action forbidden

- Confirm role policy. Some operations are intentionally admin-only (notably emergency create/resolve).

## 12. Notes and Current Constraints

- Single-admin governance is intentional and enforced.
- `ADMIN`, `WARDEN`, `STUDENT` are the only active roles.
- Emergency mutation actions are admin-only.
- Missing reports and mess timetable modules are fully integrated into current UI routes and API workflows.
