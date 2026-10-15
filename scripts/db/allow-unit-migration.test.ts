import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const localUrl = process.env.ARGON_TEST_DATABASE_URL;
const migration = readFileSync(new URL('../../drizzle/0010_allow_per_hour_unit.sql', import.meta.url), 'utf8');

test('035 extends unit lists with per_hour/per_megapixel, skips single-value pins, is idempotent', { skip: !localUrl }, async () => {
  assert.ok(localUrl);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(localUrl).hostname));
  const { default: postgres } = await import('postgres');
  const sql = postgres(localUrl, { max: 1, onnotice: () => {} });
  const t = `t035_${process.pid}`;
  try {
    await sql.begin(async tx => {
      // Production shapes: varchar list (models), text list, and the api_channel_price_variants pin.
      await tx.unsafe(`CREATE TABLE ${t}_list (pricing_unit varchar(32) CONSTRAINT ${t}_list_chk CHECK (pricing_unit IN ('per_1m_tokens', 'per_image', 'per_minute')))`);
      await tx.unsafe(`CREATE TABLE ${t}_text (unit text CONSTRAINT ${t}_text_chk CHECK (unit IN ('per_request', 'per_hour')))`);
      await tx.unsafe(`CREATE TABLE ${t}_pin (price_unit varchar(32) CONSTRAINT ${t}_pin_chk CHECK (price_unit = 'per_1m_tokens'))`);
      await tx.unsafe(migration);
      await tx.unsafe(migration); // idempotent re-run
      const defs = Object.fromEntries((await tx.unsafe(`SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname LIKE '${t}_%'`))
        .map((r: { conname: string; def: string }) => [r.conname.slice(t.length + 1), r.def]));
      for (const name of ['list_chk', 'text_chk']) {
        for (const unit of ['per_hour', 'per_megapixel']) assert.equal(defs[name].split(`'${unit}'`).length - 1, 1, `${name} has ${unit} once: ${defs[name]}`);
      }
      assert.match(defs.list_chk, /'per_image'/);
      assert.match(defs.pin_chk, /= 'per_1m_tokens'/);
      assert.doesNotMatch(defs.pin_chk, /per_hour|per_megapixel/);
      await tx.unsafe(`INSERT INTO ${t}_list VALUES ('per_hour'), ('per_megapixel'), ('per_image')`);
      await assert.rejects(tx.savepoint(sp => sp.unsafe(`INSERT INTO ${t}_list VALUES ('per_bogus')`)));
      await tx.unsafe(`CREATE TABLE ${t}_odd (u text CONSTRAINT ${t}_odd_chk CHECK (u LIKE 'per_image%'))`);
      await assert.rejects(tx.savepoint(sp => sp.unsafe(migration)), /Unexpected unit constraint shape/);
      throw new Error('rollback');
    }).catch(e => { if (e.message !== 'rollback') throw e; });
  } finally { await sql.end(); }
});
