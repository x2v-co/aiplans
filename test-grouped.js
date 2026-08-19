import { config } from 'dotenv';
config({ path: '.env.local' });

import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL, { max: 1 });

(async () => {
  const models = await sql`SELECT id, name FROM models WHERE type = 'llm' ORDER BY id LIMIT 1`;
  console.log('Models:', JSON.stringify(models, null, 2));
  await sql.end();
})();
