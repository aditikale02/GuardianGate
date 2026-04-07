FROM node:20-alpine AS builder

WORKDIR /app

# Install workspace dependencies first for better layer caching.
COPY package*.json ./
COPY frontend/package.json frontend/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY services/api/package.json services/api/package.json
RUN npm ci

# Copy source files needed for build.
COPY tsconfig.json tsconfig.json
COPY packages/shared packages/shared
COPY services/api services/api

# Build shared workspace first, then API.
RUN npm run build --workspace=@guardian/shared && npm run build --workspace=@guardian/api

FROM node:20-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
COPY frontend/package.json frontend/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY services/api/package.json services/api/package.json
RUN npm ci --omit=dev

COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY --from=builder /app/services/api/dist services/api/dist
COPY services/api/prisma services/api/prisma
COPY services/api/prisma.config.ts services/api/prisma.config.ts

EXPOSE 3000

CMD ["npm", "run", "start", "--workspace=@guardian/api"]
