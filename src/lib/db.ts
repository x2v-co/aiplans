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

/**
 * Array type OIDs for `sql.array(values, oid)`.
 *
 * postgres.js wants the OID of the *array* type here, not of the element. Every
 * call site used to pass an element OID (23 int4 / 25 text), which makes the
 * driver bind a scalar and Postgres reject it:
 *
 *   op ANY/ALL (array) requires array on right side   (SQLSTATE 42809)
 *
 * That failure was invisible in practice because it only fires on a *cold*
 * connection -- the error response is also what populates postgres.js's
 * array-type cache, after which the wrong OID gets corrected transparently. Net
 * effect: one 500 per freshly-opened pooled connection after each restart or
 * pool growth, then silence. Use these constants instead of raw numbers.
 */
export const INT4_ARRAY = 1007;
export const TEXT_ARRAY = 1009;
export const BOOL_ARRAY = 1000;
