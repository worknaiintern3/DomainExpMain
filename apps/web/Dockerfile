# syntax=docker/dockerfile:1
# Build with the repository root as context.
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/package.json
RUN --mount=type=cache,target=/root/.npm npm ci \
    --workspace=@domainpulse/web --include-workspace-root --no-audit --no-fund
COPY apps/web/ ./apps/web/
RUN npm run build --workspace=@domainpulse/web

FROM nginx:stable-alpine AS runtime
COPY apps/web/deploy/frontend.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist/ /usr/share/nginx/html/
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1
