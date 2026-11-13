import assert from 'node:assert/strict';
import test from 'node:test';
import type { Sql } from 'postgres';
import { DECIDER_FLASH_V13, DECIDER_V13 } from '../../src/lib/decision-models-2026-11-13';
import {
  PRODUCTION_SHAPED_DRY_RUN, seedCatalog20261113DeciderSearchApis, seedStepCounts,
} from '../data/catalog-2026-11-13-decider-search-apis';

// Opt-in: needs a loopback Postgres with every migration applied (CI "Postgres seed check" step).
const localUrl = process.env.ARGON_TEST_DATABASE_URL;
const slugs = [DECIDER_V13.slug, DECIDER_FLASH_V13.slug];

test('Decider v1.3 seed satisfies Postgres constraints, re-runs to 0, and rolls back', { skip: !localUrl }, async () => {
  assert.ok(localUrl);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(localUrl).hostname));
  const { default: postgres } = await import('postgres');
  const sql = postgres(localUrl, { max: 1, onnotice: () => {} });
  try {
    const [{ n }] = await sql<Array<{ n: number }>>`SELECT count(*)::int AS n FROM models WHERE slug IN ${sql(slugs)}`;
    assert.equal(n, 0, 'loopback DB should not already contain these models');
    const run = () => sql.begin('isolation level serializable', async raw => {
      const tx = raw as unknown as Sql;
      const ensure = async (row: Record<string, unknown>) => {
        const existing = (await tx<Array<{ id: number }>>`SELECT id FROM providers WHERE slug = ${row.slug as string}`)[0];
        if (existing) return existing.id;
        return (await tx<Array<{ id: number }>>`INSERT INTO ${tx('providers')} ${tx(row)} RETURNING id`)[0].id;
      };
      await ensure({ slug: 'perplexity', name: 'Perplexity', type: 'official' });
      await ensure({ slug: 'vercel-ai-gateway', name: 'Vercel AI Gateway', type: 'aggregator' });
      await ensure({ slug: 'openrouter', name: 'OpenRouter', type: 'aggregator' });

      const applied = await seedCatalog20261113DeciderSearchApis(tx, true);
      assert.deepEqual(seedStepCounts(applied), PRODUCTION_SHAPED_DRY_RUN);
      assert.deepEqual(
        (await seedCatalog20261113DeciderSearchApis(tx, false)).filter(step => step.action !== 'skip'),
        [],
        'second dry-run after apply is empty',
      );

      const models = await tx<Array<Record<string, unknown>>>`
        SELECT slug, model_category, context_window, max_output_tokens, open_source, license, parameters
          FROM models WHERE slug IN ${tx(slugs)} ORDER BY slug`;
      assert.equal(models.length, 2);
      for (const model of models) {
        assert.equal(model.model_category, 'decision');
        assert.equal(Number(model.context_window), 262_144);
        assert.equal(Number(model.max_output_tokens), 0);
        assert.equal(model.open_source, true);
        assert.equal(model.license, 'Apache-2.0');
      }

      const prices = await tx<Array<Record<string, unknown>>>`
        SELECT m.slug AS model, p.slug AS provider, c.input_price_per_1m, c.output_price_per_1m
          FROM api_channel_prices c
          JOIN models m ON m.id = c.model_id
          JOIN providers p ON p.id = c.provider_id
         WHERE m.slug IN ${sql(slugs)}
         ORDER BY m.slug, p.slug`;
      assert.equal(prices.length, 6);
      const by = Object.fromEntries(prices.map(row => [`${row.model}/${row.provider}`, row]));
      assert.equal(Number(by[`${DECIDER_V13.slug}/perplexity`].input_price_per_1m), 0.02);
      assert.equal(Number(by[`${DECIDER_FLASH_V13.slug}/perplexity`].input_price_per_1m), 0.01);
      assert.equal(Number(by[`${DECIDER_V13.slug}/openrouter`].input_price_per_1m), 0);
      assert.equal(Number(by[`${DECIDER_V13.slug}/openrouter`].output_price_per_1m), 0);
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
    const [{ left }] = await sql<Array<{ left: number }>>`SELECT count(*)::int AS left FROM models WHERE slug IN ${sql(slugs)}`;
    assert.equal(left, 0, 'constraint check must not commit');
  } finally { await sql.end(); }
});
