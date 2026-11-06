import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const localUrl = process.env.ARGON_TEST_DATABASE_URL;
const migration = readFileSync(new URL('../../drizzle/0016_supported_regions.sql', import.meta.url), 'utf8');

test('0016 preserves existing booleans, defaults new rows to null and replays without data loss', { skip: !localUrl }, async () => {
  assert.ok(localUrl);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(localUrl).hostname));
  const { default: postgres } = await import('postgres');
  const sql = postgres(localUrl, { max: 1, onnotice: () => {} });
  try {
    await sql.begin(async tx => {
      // Temp tables shadow public tables so this check touches only its fixture.
      for (const table of ['providers', 'plans']) {
        await tx.unsafe(`CREATE TEMP TABLE ${table} (id serial PRIMARY KEY, access_from_china boolean DEFAULT true) ON COMMIT DROP`);
        await tx.unsafe(`INSERT INTO ${table} (access_from_china) VALUES (true), (false), (null)`);
      }
      await tx.unsafe(migration);
      for (const table of ['providers', 'plans']) {
        const rows = await tx.unsafe(`SELECT access_from_china, supported_regions FROM ${table} ORDER BY id`);
        assert.deepEqual(rows.map(r => r.access_from_china), [true, false, null]);
        assert.ok(rows.every(r => r.supported_regions === null));
        const [newRow] = await tx.unsafe(`INSERT INTO ${table} DEFAULT VALUES RETURNING access_from_china`);
        assert.equal(newRow.access_from_china, null);
        await tx.unsafe(`UPDATE ${table} SET supported_regions = ARRAY['CN'], regions_source_url = 'https://example.com/countries', regions_verified_at = '2026-11-05T00:00:00Z' WHERE id = 1`);
        await tx.unsafe(`UPDATE ${table} SET supported_regions = ARRAY[]::text[] WHERE id = 2`);
      }
      await tx.unsafe(migration);
      for (const table of ['providers', 'plans']) {
        const [row, empty] = await tx.unsafe(`SELECT supported_regions, regions_source_url, regions_verified_at FROM ${table} ORDER BY id`);
        assert.deepEqual(row.supported_regions, ['CN']);
        assert.deepEqual(empty.supported_regions, []);
        assert.equal(row.regions_source_url, 'https://example.com/countries');
        assert.equal(row.regions_verified_at.toISOString(), '2026-11-05T00:00:00.000Z');
      }
    });
  } finally { await sql.end(); }
});
