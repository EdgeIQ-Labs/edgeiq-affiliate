import postgres from 'postgres';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from './schema.js';

let dbInstance: PostgresJsDatabase<typeof schema> | null = null;
let sqlClient: ReturnType<typeof postgres> | null = null;

export function connectDb(databaseUrl?: string): PostgresJsDatabase<typeof schema> {
  const url = databaseUrl ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  if (dbInstance) return dbInstance;

  sqlClient = postgres(url);
  dbInstance = drizzle(sqlClient, { schema });
  return dbInstance;
}

export function getDb(): PostgresJsDatabase<typeof schema> {
  if (!dbInstance) {
    return connectDb();
  }
  return dbInstance;
}

export async function disconnectDb(): Promise<void> {
  if (sqlClient) {
    await sqlClient.end();
    sqlClient = null;
    dbInstance = null;
  }
}

// Auto-connect on import if DATABASE_URL is available
if (process.env.DATABASE_URL) {
  connectDb();
}

export const db = new Proxy({} as PostgresJsDatabase<typeof schema>, {
  get(_target, prop, receiver) {
    const instance = getDb();
    const value = Reflect.get(instance, prop, receiver);
    return typeof value === 'function' ? value.bind(instance) : value;
  },
});
