import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

/**
 * Direct PostgreSQL connection shared by the web app and data scripts.
 *
 * The local fallback keeps image builds usable without production secrets.
 * `/api/health` verifies the real runtime connection before traffic is sent.
 */
const connectionString = process.env.DATABASE_URL || 'postgres://localhost:5432/planprice';

export const sql = postgres(connectionString, {
  max: Number(process.env.DB_POOL_MAX || 10),
  idle_timeout: 20,
  connect_timeout: 10,
  // PgBouncer transaction pools do not support prepared statements.
  prepare: process.env.DB_PREPARE !== 'false',
});

export const db = drizzle(sql);
