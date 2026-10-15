# syntax=docker/dockerfile:1
# Build from the repository root: docker build -f apps/api/Dockerfile .
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY packages/contracts/package.json ./packages/contracts/package.json
COPY packages/database/package.json ./packages/database/package.json
RUN --mount=type=cache,target=/root/.npm npm ci \
    --workspace=@domainpulse/api --workspace=@domainpulse/contracts \
    --workspace=@domainpulse/database --include-workspace-root --no-audit --no-fund
COPY apps/api/ ./apps/api/
COPY packages/contracts/ ./packages/contracts/
COPY packages/database/ ./packages/database/
RUN npm run build --workspace=@domainpulse/api

FROM node:24-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY packages/contracts/package.json ./packages/contracts/package.json
COPY packages/database/package.json ./packages/database/package.json
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev \
    --workspace=@domainpulse/api --workspace=@domainpulse/contracts \
    --workspace=@domainpulse/database --no-audit --no-fund

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production API_HOST=0.0.0.0 API_PORT=4000
WORKDIR /app
COPY --from=dependencies --chown=node:node /app/ ./
COPY --from=build --chown=node:node /app/apps/api/dist/ ./apps/api/dist/
COPY --from=build --chown=node:node /app/packages/contracts/dist/ ./packages/contracts/dist/
COPY --from=build --chown=node:node /app/packages/database/dist/src/ ./packages/database/dist/src/
COPY --from=build --chown=node:node /app/packages/database/migrations/ ./packages/database/migrations/
COPY --chown=node:node apps/api/deploy/migrate.cjs ./apps/api/deploy/migrate.cjs
COPY --chown=node:node apps/api/deploy/check-runtime.cjs ./apps/api/deploy/check-runtime.cjs
USER node
WORKDIR /app/apps/api
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=5 \
    CMD node -e "fetch('http://127.0.0.1:4000/ready',{signal:AbortSignal.timeout(4000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
