import { config } from 'dotenv';
config({ path: '.env.local' });

import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL, { max: 1 });

(async () => {
  const data = await sql`SELECT id, name FROM models WHERE type = 'llm' ORDER BY id LIMIT 2`;
  console.log('Models:', JSON.stringify(data, null, 2));
  await sql.end();
})();
