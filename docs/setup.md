# Setup Instructions

Follow these steps to get GuardianGate running on your local machine.

## 1. Clone & Install

```bash
git clone <repository-url>
cd GuardianGate
npm install
```

## 2. Workspace Notes

GuardianGate uses npm workspaces. Shared packages are linked automatically.

## 3. Database

Ensure PostgreSQL is running and `services/api/.env` has a valid `DATABASE_URL`.

Example local URL:

```env
DATABASE_URL="postgresql://ggadmin:your_password@127.0.0.1:5432/guardiangate?schema=public"
```

Also set:

- `JWT_SECRET` (>= 32 chars)
- `JWT_REFRESH_SECRET` (>= 32 chars)
- `QR_SECRET` (>= 32 chars)

Sync Prisma schema:

```bash
cd services/api
npx prisma db push
cd ../..
```

## 4. Demo Users

This repo does not currently include a stable Prisma seed command for demo users.

For local functional testing, create users via:

```bash
npm run dev
```

Then register from API in development mode (`POST /api/v1/auth/register`) or use existing local test bootstrap scripts if available in your environment.

## 5. Run the System

### Integrated mode (recommended)

```bash
npm run dev
```

Open:

- `http://localhost:3000/admin/`
- `http://localhost:3000/kiosk/`
- `http://localhost:3000/app/`

### Individual workspace mode

Run in separate terminals:

- **API**: `npm run dev:api`
- **Dashboard**: `npm run dev:web`
- **Kiosk**: `npm run dev:kiosk`
- **PWA**: `npm run dev:pwa`

## 6. Verification

Basic health check:

```bash
curl http://localhost:3000/health
```

Project checks:

```bash
npm run lint
npm test
npm run build
```

## Tips

- Use Chrome DevTools for PWA mobile emulation.
- Enable camera permissions in your browser for the PWA scanner to work.
- If auth returns DB connectivity errors, verify PostgreSQL is running and `DATABASE_URL` points to the active instance.
