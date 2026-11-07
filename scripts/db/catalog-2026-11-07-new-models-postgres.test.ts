import assert from 'node:assert/strict';
import test from 'node:test';
import type { Sql } from 'postgres';
import {
  AMP_CONTEXT, AMP_MAX_OUTPUT, AMP_PROMO_ENDS_AT, AMP_SLUG, LFM_CONTEXT, LFM_FREE_SLUG, LFM_PAID, LFM_SLUG,
  PRODUCTION_SHAPED_DRY_RUN, seedCatalog20261107NewModels, seedStepCounts,
} from '../data/catalog-2026-11-07-new-models';

// Opt-in: needs a loopback Postgres with every migration applied (CI "Postgres seed check" step).
const localUrl = process.env.ARGON_TEST_DATABASE_URL;
const slugs = [LFM_SLUG, LFM_FREE_SLUG, AMP_SLUG];

test('LFM3 / Ampersand seed satisfies Postgres constraints, re-runs to 0, and rolls back', { skip: !localUrl }, async () => {
  assert.ok(localUrl);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(localUrl).hostname));
  const { default: postgres } = await import('postgres');
  const sql = postgres(localUrl, { max: 1, onnotice: () => {} });
  try {
    const [{ n }] = await sql<Array<{ n: number }>>`
      SELECT count(*)::int AS n FROM models WHERE slug IN ${sql(slugs)}`;
    assert.equal(n, 0, 'loopback DB should not already contain these models');
    const run = () => sql.begin('isolation level serializable', async raw => {
      const tx = raw as unknown as Sql;
      const ensure = async (row: Record<string, unknown>) => {
        const existing = (await tx<Array<{ id: number }>>`SELECT id FROM providers WHERE slug = ${row.slug as string}`)[0];
        if (existing) return existing.id;
        return (await tx<Array<{ id: number }>>`INSERT INTO ${tx('providers')} ${tx(row)} RETURNING id`)[0].id;
      };
      await ensure({ slug: 'liquid', name: 'Liquid AI', type: 'official', website: 'https://existing.example' });
      await ensure({ slug: 'openrouter', name: 'OpenRouter', type: 'aggregator' });
      await ensure({ slug: 'vercel-ai-gateway', name: 'Vercel AI Gateway', type: 'aggregator' });
      const applied = await seedCatalog20261107NewModels(tx, true);
      assert.deepEqual(seedStepCounts(applied), PRODUCTION_SHAPED_DRY_RUN);
      assert.deepEqual(await seedCatalog20261107NewModels(tx, false), [], 'second dry-run after apply is empty');

      const rows = await tx<Array<Record<string, unknown>>>`
        SELECT slug, name, parameters, context_window, max_output_tokens, open_source, license
          FROM models WHERE slug IN ${tx(slugs)} ORDER BY slug`;
      const by = Object.fromEntries(rows.map(row => [row.slug, row]));
      assert.equal(by[LFM_SLUG].name, 'LFM3-1.7B');
      assert.equal(by[LFM_SLUG].parameters, '1.73B');
      assert.equal(by[LFM_SLUG].context_window, LFM_CONTEXT);
      assert.equal(by[LFM_SLUG].max_output_tokens, null);
      assert.equal(by[LFM_SLUG].open_source, true);
      assert.equal(by[LFM_SLUG].license, 'LFM Open License (lfm1.0)');
      assert.equal(by[LFM_FREE_SLUG].name, 'LFM3-1.7B (free)');
      assert.equal(by[AMP_SLUG].name, 'Ampersand v0.1');
      assert.equal(by[AMP_SLUG].context_window, AMP_CONTEXT);
      assert.equal(Number(by[AMP_SLUG].max_output_tokens), AMP_MAX_OUTPUT);
      assert.equal(by[AMP_SLUG].open_source, null);

      const prices = await tx<Array<Record<string, unknown>>>`
        SELECT m.slug, p.slug AS provider, c.input_price_per_1m, c.output_price_per_1m, c.cached_input_price_per_1m,
               c.currency, c.promo_ends_at, c.regular_input_price_per_1m, c.data_for_discount
          FROM api_channel_prices c
          JOIN models m ON m.id = c.model_id
          JOIN providers p ON p.id = c.provider_id
         WHERE m.slug IN ${tx(slugs)}
         ORDER BY m.slug, p.slug`;
      const key = (row: Record<string, unknown>) => `${row.provider}/${row.slug}`;
      const price = Object.fromEntries(prices.map(row => [key(row), row]));
      assert.deepEqual([
        price[`liquid/${LFM_SLUG}`].input_price_per_1m,
        price[`liquid/${LFM_SLUG}`].output_price_per_1m,
        price[`liquid/${LFM_SLUG}`].cached_input_price_per_1m,
      ], [LFM_PAID.input, LFM_PAID.output, LFM_PAID.cache]);
      assert.equal(price[`liquid/${LFM_SLUG}`].data_for_discount, null);
      assert.equal(price[`liquid/${LFM_SLUG}`].promo_ends_at, null);
      assert.equal(price[`openrouter/${LFM_SLUG}`].data_for_discount, true);
      assert.equal(price[`openrouter/${LFM_FREE_SLUG}`].cached_input_price_per_1m, null);
      assert.equal(price[`openrouter/${LFM_FREE_SLUG}`].input_price_per_1m, 0);
      assert.equal(price[`vercel-ai-gateway/${AMP_SLUG}`].cached_input_price_per_1m, 0);
      assert.equal(price[`vercel-ai-gateway/${AMP_SLUG}`].regular_input_price_per_1m, null);
      assert.equal(price[`vercel-ai-gateway/${AMP_SLUG}`].data_for_discount, null);
      assert.equal(new Date(price[`vercel-ai-gateway/${AMP_SLUG}`].promo_ends_at as string).toISOString(), AMP_PROMO_ENDS_AT.toISOString());
      throw new Error('rollback');
    });
    // Hy4's Postgres test also inserts openrouter inside its own transaction.
    // A unique conflict aborts this one; retry the whole check.
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        await run().catch(error => { if ((error as Error).message !== 'rollback') throw error; });
        break;
      } catch (error) {
        const message = (error as Error).message ?? '';
        if (attempt === 3 || !/duplicate key|could not serialize|23505|40001/.test(message)) throw error;
      }
    }

    const [{ left }] = await sql<Array<{ left: number }>>`SELECT count(*)::int AS left FROM models WHERE slug IN ${sql(slugs)}`;
    assert.equal(left, 0, 'constraint check must not commit');
  } finally { await sql.end(); }
});
