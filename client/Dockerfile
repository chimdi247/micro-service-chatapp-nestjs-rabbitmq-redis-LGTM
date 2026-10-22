# syntax=docker/dockerfile:1

# ============================================
# Build stage
# ============================================
FROM node:22-alpine AS builder

# Install pnpm (same version pin used by the other services' Dockerfiles)
RUN corepack enable && corepack prepare pnpm@10.14.0 --activate

WORKDIR /app

# No pnpm-lock.yaml is committed for this standalone client package, so
# this resolves fresh against package.json on first build.
COPY package.json ./
RUN pnpm install

COPY . .

# VITE_* variables are inlined into the JS bundle at build time, so
# this must be a build arg, not just a runtime env var (see the
# "client" service's build.args in docker-compose.yml).
ARG VITE_API_BASE_URL=http://localhost:4000
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN pnpm build

# ============================================
# Runtime stage - static files served by nginx
# ============================================
FROM nginx:1.27-alpine AS runner

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
