FROM oven/bun:1 AS base
WORKDIR /app

# Copy workspace root configs
COPY pnpm-workspace.yaml package.json ./

# Copy ALL package.json files so bun can resolve the workspace
COPY packages/core/package.json ./packages/core/
COPY packages/api/package.json ./packages/api/
COPY packages/web/package.json ./packages/web/

# Install dependencies (ignore frozen lockfile — bun doesn't speak pnpm natively)
RUN bun install

# Copy source for core and api (web not needed for API build)
COPY packages/core/ ./packages/core/
COPY packages/api/ ./packages/api/

# Build
RUN cd packages/api && bun build ./src/index.ts --outdir ./dist --target bun

# Production stage
FROM oven/bun:1-slim AS production
WORKDIR /app

ENV NODE_ENV=production

COPY --from=base /app/packages/api/dist ./dist
COPY --from=base /app/packages/api/package.json ./
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/packages/core ./packages/core

EXPOSE 3000

CMD ["bun", "run", "dist/index.js"]
