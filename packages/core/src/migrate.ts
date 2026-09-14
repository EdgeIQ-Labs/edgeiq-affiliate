#!/usr/bin/env node
/**
 * Standalone migration runner for Relay.
 * Usage: bun run packages/core/src/migrate.ts
 *        or via pnpm db:migrate
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runMigrations() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('ERROR: DATABASE_URL environment variable is not set.');
    process.exit(1);
  }

  console.log('Connecting to database...');
  const sql = postgres(databaseUrl, { max: 1 });
  const db = drizzle(sql);

  const migrationsFolder = path.resolve(__dirname, '../drizzle');
  console.log(`Running migrations from: ${migrationsFolder}`);

  try {
    await migrate(db, { migrationsFolder });
    console.log('Migrations completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runMigrations();
