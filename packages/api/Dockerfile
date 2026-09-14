FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile || bun install

# Copy source
COPY tsconfig.json ./
COPY src/ ./src/

# Build
RUN bun build ./src/index.ts --outdir ./dist --target bun

# Production stage
FROM oven/bun:1-slim AS production
WORKDIR /app

ENV NODE_ENV=production

COPY --from=base /app/dist ./dist
COPY --from=base /app/package.json ./

EXPOSE 3000

CMD ["bun", "run", "dist/index.js"]
