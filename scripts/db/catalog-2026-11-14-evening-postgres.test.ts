import assert from 'node:assert/strict';
import test from 'node:test';
import type { Sql } from 'postgres';
import {
  DEEPINFRA_SLUG, INKLING_SLUG, PRODUCTION_SHAPED_DRY_RUN, seedCatalog20261114Evening, seedStepCounts,
} from '../data/catalog-2026-11-14-evening';

const localUrl = process.env.ARGON_TEST_DATABASE_URL;

test('11-14 evening seed satisfies Postgres constraints, re-runs to 0, and rolls back', { skip: !localUrl }, async () => {
  assert.ok(localUrl);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(localUrl).hostname));
  const { default: postgres } = await import('postgres');
  const sql = postgres(localUrl, { max: 1, onnotice: () => {} });
  try {
    const [{ n }] = await sql<Array<{ n: number }>>`SELECT count(*)::int AS n FROM providers WHERE slug = ${DEEPINFRA_SLUG}`;
    assert.equal(n, 0, 'loopback DB should not already contain the deepinfra provider');
    const run = () => sql.begin('isolation level serializable', async raw => {
      const tx = raw as unknown as Sql;
      const existing = (await tx<Array<{ id: number }>>`SELECT id FROM models WHERE slug = ${INKLING_SLUG}`)[0];
      if (!existing) {
        await tx`INSERT INTO ${tx('models')} ${tx({ slug: INKLING_SLUG, name: 'Inkling 2 Small', type: 'llm', model_category: 'text' })}`;
      }
      const applied = await seedCatalog20261114Evening(tx, true);
      assert.deepEqual(seedStepCounts(applied), PRODUCTION_SHAPED_DRY_RUN);
      assert.deepEqual(await seedCatalog20261114Evening(tx, false), [], 'second dry-run after apply is empty');
      const [channel] = await tx<Array<Record<string, number | null>>>`
        SELECT c.input_price_per_1m, c.output_price_per_1m, c.cached_input_price_per_1m, c.promo_ends_at,
               c.regular_input_price_per_1m, c.regular_output_price_per_1m, c.regular_cached_input_price_per_1m
          FROM api_channel_prices c JOIN models m ON m.id = c.model_id JOIN providers p ON p.id = c.provider_id
         WHERE m.slug = ${INKLING_SLUG} AND p.slug = ${DEEPINFRA_SLUG}`;
      assert.ok(Math.abs(Number(channel.input_price_per_1m) - 0.285) < 1e-6);
      assert.ok(Math.abs(Number(channel.output_price_per_1m) - 0.95) < 1e-6);
      assert.ok(Math.abs(Number(channel.cached_input_price_per_1m) - 0.0285) < 1e-6);
      assert.equal(channel.promo_ends_at, null);
      assert.ok(Math.abs(Number(channel.regular_input_price_per_1m) - 0.3) < 1e-6);
      assert.ok(Math.abs(Number(channel.regular_output_price_per_1m) - 1) < 1e-6);
      assert.ok(Math.abs(Number(channel.regular_cached_input_price_per_1m) - 0.03) < 1e-6);
      throw new Error('rollback');
    });
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        await run().catch(error => { if ((error as Error).message !== 'rollback') throw error; });
        break;
      } catch (error) {
        const message = (error as Error).message ?? '';
        if (attempt === 3 || !/duplicate key|could not serialize|23505|40001/.test(message)) throw error;
      }
    }
    const [{ left }] = await sql<Array<{ left: number }>>`SELECT count(*)::int AS left FROM providers WHERE slug = ${DEEPINFRA_SLUG}`;
    assert.equal(left, 0, 'constraint check must not commit');
  } finally { await sql.end(); }
});
