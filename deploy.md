# Deployment Guide

This guide details the steps to deploy GuardianGate in a production environment.

## Prerequisites

- Node.js 18+
- npm 9+
- PostgreSQL 16+ (or managed PostgreSQL)
- Docker + Docker Compose (optional, for containerized deployment)

## Local Development Setup

1. **Install Dependencies**:

   ```bash
   npm install
   ```

2. **Environment Configuration**:
   Create a `.env` file in the root directory (refer to `.env.example`):

   ```env
   NODE_ENV=development
   PORT=3000
   DATABASE_URL=postgresql://ggadmin:your_password@127.0.0.1:5432/guardiangate?schema=public
   JWT_SECRET=replace_with_at_least_32_chars_secret
   JWT_REFRESH_SECRET=replace_with_at_least_32_chars_refresh_secret
   QR_SECRET=replace_with_at_least_32_chars_qr_secret
   CORS_ORIGINS=http://localhost:8080
   SOCKET_CORS_ORIGINS=http://localhost:8080
   ```

3. **Start Services**:
   ```bash
   npm run dev:all
   ```

## Production Deployment (Docker)

GuardianGate is containerized for easy deployment using Docker.

1. **Prepare env**:

   ```bash
   cp .env.example .env
   ```

   Update at least:
   - `POSTGRES_PASSWORD`
   - `JWT_SECRET`
   - `JWT_REFRESH_SECRET`
   - `QR_SECRET`
   - `CORS_ORIGINS`
   - `SOCKET_CORS_ORIGINS`

2. **Build and Start**:

   ```bash
   docker-compose -f docker-compose.prod.yml up --build -d
   ```

3. **Apply schema / migrations**:

   ```bash
   docker compose -f docker-compose.prod.yml exec api npx prisma db push
   ```

4. **Optional: seed an admin/test users**:

   ```bash
   docker compose -f docker-compose.prod.yml exec api npm run seed:test-users
   ```

5. **Health check**:

   ```bash
   curl http://localhost:3000/health
   ```

## Security Checklist

- [ ] Use strong secrets for JWT and QR signing keys.
- [ ] Set `NODE_ENV=production`.
- [ ] Restrict `CORS_ORIGINS` and `SOCKET_CORS_ORIGINS` to your frontend domains.
- [ ] Run behind HTTPS and a reverse proxy.
- [ ] Store `.env` in deployment secret manager (not in VCS).

---

_Refer to [docs/architecture.md](./docs/architecture.md) for inner workings._
