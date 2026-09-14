FROM oven/bun:1 AS base
WORKDIR /app

# Copy workspace root configs
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./

# Copy all package.json files for workspace resolution
COPY packages/core/package.json ./packages/core/
COPY packages/api/package.json ./packages/api/

# Install dependencies
RUN bun install --frozen-lockfile || bun install

# Copy source
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
