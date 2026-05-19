# ==========================================
# Stage 1: Install Dependencies (All)
# ==========================================
FROM node:20-alpine AS deps
# libc6-compat and openssl are required for Prisma and Node.js native modules on Alpine
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Copy root and workspace package files
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY apps/api/prisma ./apps/api/prisma/

# Install ALL dependencies (including dev) to ensure build succeeds
RUN npm ci

# Generate Prisma Client
RUN cd apps/api && npx prisma generate

# ==========================================
# Stage 2: Build the Application
# ==========================================
FROM node:20-alpine AS builder
WORKDIR /app

# Copy node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules

# Copy source code
COPY . .

# Build the NestJS application
RUN npm run build --workspace=apps/api

# ==========================================
# Stage 3: Production Dependencies Only
# ==========================================
FROM node:20-alpine AS prod-deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY apps/api/prisma ./apps/api/prisma/

# Install ONLY production dependencies (reduces image size & vulnerabilities)
RUN npm ci --omit=dev

# Install Prisma CLI to support running migrations in production
RUN cd apps/api && npm install prisma --no-save

# Generate Prisma Client for production environment
RUN cd apps/api && npx prisma generate

# ==========================================
# Stage 4: Production Runner
# ==========================================
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Install openssl for Prisma query engine
RUN apk add --no-cache openssl

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# To run a monorepo workspace correctly, we MUST copy the ROOT node_modules
# because npm workspaces hoist shared dependencies (like @nestjs/core) to the root.
COPY --from=prod-deps --chown=nestjs:nodejs /app/package.json ./
COPY --from=prod-deps --chown=nestjs:nodejs /app/node_modules ./node_modules

# Copy the workspace-specific files
COPY --from=prod-deps --chown=nestjs:nodejs /app/apps/api/package.json ./apps/api/
COPY --from=prod-deps --chown=nestjs:nodejs /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=prod-deps --chown=nestjs:nodejs /app/apps/api/prisma ./apps/api/prisma

# Copy the built output from the builder stage
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./apps/api/dist

# Set the working directory to the API workspace so local imports and paths resolve correctly
WORKDIR /app/apps/api

# Switch to non-root user
USER nestjs

# Expose API port
EXPOSE 4000
ENV PORT=4000

# Default command runs Prisma DB migrations before starting the NestJS application
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
