#!/usr/bin/env node

/** Test a PostgreSQL connection supplied as DATABASE_URL or argv[2]. */

import { config } from 'dotenv';
import postgres from 'postgres';

config({ path: '.env.local' });

const url = process.argv[2] || process.env.DATABASE_URL;
if (!url) {
  console.error('Usage: DATABASE_URL=postgresql://... node test-connection.mjs');
  process.exit(1);
}

const sql = postgres(url, { max: 1, idle_timeout: 5, connect_timeout: 10 });
try {
  const [result] = await sql`SELECT version()`;
  console.log('PostgreSQL connection ok:', result.version.split(' ')[0]);
} finally {
  await sql.end();
}
