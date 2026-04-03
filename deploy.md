# Deployment Guide

This guide details the steps to deploy GuardianGate in a production environment.

## Prerequisites

- Node.js (v18+)
- Modern browser (Chrome/Edge recommended)

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
   JWT_SECRET=your_secret_key
   ```

3. **Start Services**:
   ```bash
   npm run dev:all
   ```

## Production Deployment (Docker)

GuardianGate is containerized for easy deployment using Docker.

1. **Build and Start**:

   ```bash
   docker-compose -f docker-compose.prod.yml up --build -d
   ```

2. **Network Topology**:
   - The API server facilitates all traffic.

## Security Checklist

- [ ] Change default `JWT_SECRET`.
- [ ] Set `NODE_ENV=production`.

---

_Refer to [docs/architecture.md](./docs/architecture.md) for inner workings._
