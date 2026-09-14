import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './packages/core/src/schema.ts',
  out: './packages/core/drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://relay:relay_dev_password@localhost:5432/affiliate',
  },
});
