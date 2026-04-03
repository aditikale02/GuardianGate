# GuardianGate

GuardianGate is a role-based hostel management and gate-control platform built as a monorepo. The current implementation combines secure authentication, QR entry/exit validation, digital attendance operations, admin-controlled fee management, and day-to-day campus workflows.

## 1. Current Project State

Active roles in production flows:

- ADMIN
- WARDEN
- STUDENT

Core capabilities currently implemented:

- Role-aware login with refresh-cookie session recovery
- QR Center for gate token generation and log monitoring
- Camera-based student QR scanning with permission handling and fallback input
- Entry/exit logging with late and flagged status handling
- Digital floor-wise attendance workflow for wardens/admins
- Admin-only payment management and fee record operations
- Campus modules: notices, events, emergency, mess, requests, and missing reports

## 2. Payment System (Updated)

Payment management is now admin-only in both frontend access and backend authorization.

What is implemented:

- Route-level access restriction for payment page to ADMIN only
- API-level restriction for payment endpoints to ADMIN only
- Admin dashboard payment panel supports:
	- updating paid amount
	- derived status handling for PAID, PARTIAL, PENDING, OVERDUE
	- managing fee records with history and audit trail
- Payment update writes are transactional and update both payment ledger and fee status

Role impact:

- ADMIN: full payment access
- WARDEN: no payment page access
- STUDENT: no payment page access

## 3. Attendance System (Updated)

Attendance is digitally managed by wardens/admins using a hierarchy-based structure.

Attendance structure:

- hostel -> floor -> room -> student

What is implemented:

- Floor options endpoint for hostel/floor selection
- Floor attendance fetch endpoint returning all rooms and students
- Bulk save endpoint to mark statuses (PRESENT, ABSENT, ON_LEAVE, LATE_RETURN)
- Manual finalization metadata (verified_by_warden_id, is_finalized, finalized_at)

Student attendance view:

- Student attendance page shows:
	- attendance percentage
	- present count
	- absent count
	- leave and late-return contribution in summary totals
- Recent attendance rows are visible in student UI

## 4. QR Entry/Exit System (Updated)

### Admin and Warden QR Center

- QR token generation is available in QR Center
- Token validity is short-lived and auto-refreshes every 30 seconds
- QR Center includes a tab switch between:
	- Generate QR
	- View Logs

### Student Scanner Experience

- Scanner is camera-first (not manual-token-first)
- Camera permission is requested automatically when scanner loads
- Permission states are handled (granted, denied, unsupported) with retry UX
- Manual token input remains available as fallback only

## 5. Entry/Exit Logic (Current Behavior)

Action derivation:

- Next action is inferred from student current status
	- current ENTRY -> next EXIT
	- current EXIT -> next ENTRY

Exit behavior:

- Records exit timestamp
- Requires destination (where going)
- If destination is missing, API returns REQUIRES_EXIT_DETAILS and prompts re-submit with details

Entry behavior:

- Records entry timestamp
- If scanned after configured allowed entry cutoff, entry is marked:
	- late = true
	- flagged = true

## 6. Entry/Exit Logs (Current Visibility)

Admins and wardens can view logs in QR Center and dashboard logs.

Available capabilities:

- Full log listing
- Filters for student, hostel, floor, room, date, direction
- Late-only and flagged-only filtering
- Aggregated summaries (entries, exits, late entries, flagged)

Log fields include:

- student name and identifiers
- entry/exit direction and time
- destination and exit note for EXIT records
- late and flagged status
- verification metadata and remarks

## 7. Scanner Improvements and Stability Fixes

Recent scanner and flow hardening implemented:

- Camera-based scanning integrated with QR decoding library
- Explicit permission and retry handling for camera access
- Duplicate submission prevention during scan callbacks using client-side scan lock
- Backend replay protection per student plus nonce
- Stable scan-to-log flow with automatic logs refresh for manager view

## 8. Role-Based Access Control (RBAC)

### ADMIN

- Full system access
- User governance and account provisioning
- Attendance operations
- QR generation and logs
- Payment management (exclusive)
- Emergency create/resolve

### WARDEN

- Attendance operations
- QR generation and logs
- Operational workflows (leave, guest, parcel, medical, maintenance, housekeeping, suggestions, missing reports)
- Notices/events
- No payment management access

### STUDENT

- Camera-based QR scan for own entry/exit
- Own attendance and personal request modules
- Own profile, notifications, room/contact/history features
- No admin/warden operational controls
- No payment management page access

## 9. End-to-End User Flow (Updated)

### Login Flow

1. User logs in from role-specific login route.
2. Backend validates credentials, role, and client type policy.
3. Access token is used for API requests; refresh cookie handles session renewal.
4. First-login users are redirected to password-change flow.

### QR Flow

1. Admin/warden opens QR Center and generates gate token.
2. Token refreshes every 30 seconds.
3. Student opens scanner, grants camera permission, scans QR.
4. Backend validates token signature, expiry, and replay conditions.
5. Exit requires destination; entry applies late/flag rules when cutoff exceeded.
6. EntryExitLog is saved and visible in logs.

### Attendance Flow

1. Warden/admin selects hostel, floor, date, and session.
2. System loads room-wise students.
3. Attendance statuses are marked and saved in bulk.
4. Student can later view summary and attendance percentage.

### Payment Flow

1. Admin opens payment management page.
2. Admin filters/searches fee records.
3. Admin updates paid amount and payment mode.
4. System validates status consistency and stores payment update with audit record.
5. Fee record status reflects paid/partial/pending/overdue state.

## 10. Architecture (Current Implementation)

### Frontend

- React + Vite + TypeScript
- TanStack Query for data fetching/mutations
- Role-specific layouts:
	- DashboardLayout for admin/warden
	- StudentLayout for student
- Route guard enforcement for role-specific page access

### Backend

- Express + TypeScript API
- JWT auth with refresh-cookie lifecycle
- Middleware-based authentication and role authorization
- Global limiter plus dedicated login failed-attempt limiter
- Socket.IO events for live gate activity

### Database

- PostgreSQL with Prisma schema
- Core models:
	- User, Student, WardenProfile
	- HostelBlock, Floor, Room, RoomAllocation
	- EntryExitLog, AttendanceRecord
	- FeeRecord, Payment
	- Workflow and campus models (leave, guest, medical, parcels, maintenance, housekeeping, missing reports, events, notices, emergency, notifications)

### QR Validation Path

1. Signed short-lived gate token generation
2. Student scan submission
3. Token validation (signature + expiry)
4. Replay check (student scoped nonce)
5. Entry/exit state transition and log persistence
6. Manager-facing log visibility and summaries

## 11. Project Structure

- frontend: React web application and UI modules
- services/api: Express API, Prisma schema, routes/controllers, scripts
- packages/shared: shared schemas and TypeScript contracts
- supabase/migrations: SQL migrations for schema evolution
- docs: architecture, setup, and API reference docs

## 12. Setup and Run

### Prerequisites

- Node.js 18+
- npm
- PostgreSQL

### Install

Run from repository root:

npm install

### Environment

Configure root .env or services/api/.env with at least:

- DATABASE_URL
- JWT_SECRET
- JWT_REFRESH_SECRET
- QR_SECRET

### Database bootstrap

From services/api:

npx prisma db push

Optional seed helpers:

- npm run seed:admin --workspace=@guardian/api
- npm run seed:test-users --workspace=@guardian/api

### Run

From repository root:

- npm run dev:all
- npm run dev:api
- npm run dev:frontend

Local defaults:

- Frontend: http://localhost:8080
- API: http://localhost:3000
- Health: http://localhost:3000/health

## 13. Verification Checklist

Recommended checks after pulling latest changes:

1. Admin can open payments page and update fee records.
2. Warden and student cannot access payments page.
3. Attendance can be marked hostel -> floor -> room -> student.
4. Student attendance page shows percentage and summary.
5. QR token refreshes every 30 seconds in manager mode.
6. Student scanner requests camera permission and scans successfully.
7. Exit requires destination; entry late scans are flagged.
8. Logs show destination, late status, and flagged status.

## 14. Related Documentation

- docs/architecture.md
- docs/setup.md
- docs/api-reference.md

## License

Private repository. All rights reserved.
