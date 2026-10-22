# syntax=docker/dockerfile:1


FROM node:22-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.14.0 --activate

WORKDIR /app

FROM base AS deps

# Copy workspace configs
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.base.json tsconfig.json ./

# Copy package/json file for all needed packages
COPY packages/common/package.json ./packages/common/
COPY services/auth-service/package.json ./services/auth-service/

#Install Dependencies
# See note below: lockfile must be refreshed after the OpenTelemetry deps were added.
RUN pnpm install --no-frozen-lockfile


FROM deps AS builder

# Copy source code
COPY packages/common ./packages/common
COPY services/auth-service ./services/auth-service

#Build commong packge first
RUN pnpm --filter @chatapp/common build

#Build auth-service
RUN pnpm --filter @chatapp/auth-service build


FROM node:22-alpine AS prodcution

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.14.0 --activate

# Create non-root user 
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodeuser

WORKDIR /app

# Copy workspace configuration
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.base.json ./

# Copy package.json files
COPY packages/common/package.json ./packages/common/
COPY services/auth-service/package.json ./services/auth-service/


# Install production dependencies only
# NOTE: --no-frozen-lockfile because @chatapp/common gained OpenTelemetry
# dependencies. Run `pnpm install` once at the repo root, commit the refreshed
# pnpm-lock.yaml, then switch back to --frozen-lockfile for reproducible builds.
RUN pnpm install --no-frozen-lockfile --prod

# Copy built artifcats from builder
COPY --from=builder /app/packages/common/dist ./packages/common/dist
COPY --from=builder /app/services/auth-service/dist ./services/auth-service/dist

# Change ownership to non(root)
RUN chown -R nodeuser:nodejs /app

USER nodeuser

ENV NODE_ENV=production
ENV AUTH_SERVICE_PORT=4003

EXPOSE 4003

WORKDIR /app/services/auth-service

# Preload OpenTelemetry (ESM loader hook + SDK + auto-instrumentation) before the app.
CMD [ "node", "--import", "@chatapp/common/dist/telemetry/register.js", "dist/index.js" ]