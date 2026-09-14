FROM node:20-slim AS base
WORKDIR /app
RUN npm install -g pnpm

# Copy workspace root configs
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy ALL package.json files so pnpm can resolve the workspace
COPY packages/core/package.json ./packages/core/
COPY packages/api/package.json ./packages/api/
COPY packages/web/package.json ./packages/web/

# Install dependencies
RUN pnpm install --frozen-lockfile || pnpm install

# Copy source for all packages
COPY tsconfig.json ./
COPY packages/core/ ./packages/core/
COPY packages/api/ ./packages/api/
COPY packages/web/ ./packages/web/

# Build the React SPA
RUN cd packages/web && npx vite build

EXPOSE 3000

CMD ["npx", "tsx", "packages/api/src/index.ts"]
