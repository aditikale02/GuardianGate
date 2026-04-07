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

Seed deterministic demo credentials:

```bash
npm run seed:test-users --workspace=@guardian/api
```

Default credentials created/updated by the seed script:

- ADMIN: `admin@guardian.com / Admin@123`
- WARDEN: `warden.test@guardian.com / Warden@123`
- STUDENT: `student.test@guardian.com / Student@123`

## 5. Run the System

### API mode

```bash
npm run dev
```

### Frontend mode

Create `frontend/.env` from `frontend/.env.example` if needed, then run:

```bash
npm run dev:frontend
```

Open:

- `http://localhost:3000/`
- `http://localhost:3000/health`

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

- If auth returns DB connectivity errors, verify PostgreSQL is running and `DATABASE_URL` points to the active instance.
