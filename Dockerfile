# ==============================================================================
# Production-grade Multi-Stage Dockerfile for Next.js Web Application
# Optimized for low-memory environments (t3.micro / t3.large k3s clusters)
# ==============================================================================

# Stage 1: Base image and dependencies caching
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Stage 2: Install dependencies
FROM base AS deps
COPY package*.json ./
COPY apps/web/package*.json ./apps/web/
# Clean install including workspace dependencies
RUN npm ci

# Stage 3: Build application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY . .

# Set building environment variables
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=2048"

# Compile Next.js project
RUN npm run build --workspace=apps/web

# Stage 4: Run application
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Setup unprivileged user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy only production bundle and assets
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/apps/web/package.json ./apps/web/package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

USER nextjs

EXPOSE 3000

# Start Next.js using workspaces
CMD ["npm", "start", "--workspace=apps/web"]
