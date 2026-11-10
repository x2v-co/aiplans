import assert from 'node:assert/strict';
import test from 'node:test';
import type { Sql } from 'postgres';
import {
  FABLE_BATCH_PRICE, FABLE_BATCH_SLUG, FABLE_CONTEXT, FABLE_MAX_OUTPUT, FABLE_STANDARD_PRICE,
  INKLING_FREE_CONTEXT, INKLING_FREE_SLUG, INKLING_PAID_SLUG, LATEST_CANONICAL, NEX_CONTEXT, NEX_PRICE, NEX_SLUG,
  PRODUCTION_SHAPED_DRY_RUN, seedCatalog20261110FableNexInkling, seedStepCounts,
} from '../data/catalog-2026-11-10-fable-nex-inkling';

// Opt-in: needs a loopback Postgres with every migration applied (CI "Postgres seed check" step).
const localUrl = process.env.ARGON_TEST_DATABASE_URL;
const slugs = [FABLE_BATCH_SLUG, LATEST_CANONICAL, NEX_SLUG, INKLING_FREE_SLUG, INKLING_PAID_SLUG];

test('Fable / Nex / Inkling seed satisfies Postgres constraints, re-runs to 0, and rolls back', { skip: !localUrl }, async () => {
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
      const anthropicId = await ensure({ slug: 'anthropic', name: 'Anthropic', type: 'official' });
      const openrouterId = await ensure({ slug: 'openrouter', name: 'OpenRouter', type: 'aggregator' });
      const thinkingId = await ensure({ slug: 'thinkingmachines', name: 'thinkingmachines', type: 'official' });
      const [latest] = await tx<Array<{ id: number }>>`
        INSERT INTO ${tx('models')} ${tx({
          slug: LATEST_CANONICAL, name: 'Claude Fable Latest', type: 'llm', provider_ids: [anthropicId], description: 'Routes to the latest Fable.',
        })} RETURNING id`;
      await tx`INSERT INTO ${tx('api_channel_prices')} ${tx({
        model_id: latest.id, provider_id: openrouterId, input_price_per_1m: 10, output_price_per_1m: 50, cached_input_price_per_1m: 0.25,
        currency: 'USD', price_unit: 'per_1m_tokens', is_available: true, last_verified: new Date('2026-11-01T00:00:00Z'), notes: 'Fable 5.1 standard rate',
      })}`;
      const [paid] = await tx<Array<{ id: number }>>`
        INSERT INTO ${tx('models')} ${tx({
          slug: INKLING_PAID_SLUG, name: 'Inkling 2 Small', type: 'llm', provider_ids: [thinkingId], context_window: 262144, description: 'Paid Tinker row.',
        })} RETURNING id`;
      await tx`INSERT INTO ${tx('api_channel_prices')} ${tx({
        model_id: paid.id, provider_id: thinkingId, input_price_per_1m: 0.3, output_price_per_1m: 1, cached_input_price_per_1m: 0.03,
        currency: 'USD', price_unit: 'per_1m_tokens', is_available: true,
      })}`;

      const applied = await seedCatalog20261110FableNexInkling(tx, true);
      assert.deepEqual(seedStepCounts(applied), PRODUCTION_SHAPED_DRY_RUN);
      assert.deepEqual(await seedCatalog20261110FableNexInkling(tx, false), [], 'second dry-run after apply is empty');

      const rows = await tx<Array<Record<string, unknown>>>`
        SELECT slug, name, parameters, context_window, max_output_tokens, open_source, description
          FROM models WHERE slug IN ${tx([FABLE_BATCH_SLUG, NEX_SLUG, INKLING_FREE_SLUG, INKLING_PAID_SLUG])} ORDER BY slug`;
      const by = Object.fromEntries(rows.map(row => [row.slug, row]));
      assert.equal(by[FABLE_BATCH_SLUG].name, 'Claude Fable 5.2 (batch)');
      assert.equal(by[FABLE_BATCH_SLUG].context_window, FABLE_CONTEXT);
      assert.equal(Number(by[FABLE_BATCH_SLUG].max_output_tokens), FABLE_MAX_OUTPUT);
      assert.equal(by[NEX_SLUG].name, 'Nex-N2.6');
      assert.equal(by[NEX_SLUG].parameters, null);
      assert.equal(by[NEX_SLUG].context_window, NEX_CONTEXT);
      assert.equal(by[NEX_SLUG].max_output_tokens, null);
      assert.equal(by[INKLING_FREE_SLUG].name, 'Inkling 2 Small (free)');
      assert.equal(by[INKLING_FREE_SLUG].context_window, INKLING_FREE_CONTEXT);
      assert.equal(by[INKLING_FREE_SLUG].max_output_tokens, null);
      assert.equal(by[INKLING_FREE_SLUG].open_source, false);
      assert.equal(by[INKLING_PAID_SLUG].context_window, 262144);
      assert.equal(by[INKLING_PAID_SLUG].description, 'Paid Tinker row.');

      const prices = await tx<Array<Record<string, unknown>>>`
        SELECT m.slug, p.slug AS provider, c.input_price_per_1m, c.output_price_per_1m, c.cached_input_price_per_1m, c.currency
          FROM api_channel_prices c
          JOIN models m ON m.id = c.model_id
          JOIN providers p ON p.id = c.provider_id
         WHERE m.slug IN ${tx(slugs)}
         ORDER BY m.slug, p.slug`;
      const key = (row: Record<string, unknown>) => `${row.provider}/${row.slug}`;
      const price = Object.fromEntries(prices.map(row => [key(row), row]));
      assert.deepEqual([
        price[`openrouter/${FABLE_BATCH_SLUG}`].input_price_per_1m,
        price[`openrouter/${FABLE_BATCH_SLUG}`].output_price_per_1m,
        price[`openrouter/${FABLE_BATCH_SLUG}`].cached_input_price_per_1m,
      ], [FABLE_BATCH_PRICE.input, FABLE_BATCH_PRICE.output, FABLE_BATCH_PRICE.cache]);
      assert.equal(price[`anthropic/${FABLE_BATCH_SLUG}`], undefined);
      assert.deepEqual([
        price[`openrouter/${LATEST_CANONICAL}`].input_price_per_1m,
        price[`openrouter/${LATEST_CANONICAL}`].output_price_per_1m,
        price[`openrouter/${LATEST_CANONICAL}`].cached_input_price_per_1m,
      ], [FABLE_STANDARD_PRICE.input, FABLE_STANDARD_PRICE.output, FABLE_STANDARD_PRICE.cache]);
      assert.deepEqual([
        price[`openrouter/${NEX_SLUG}`].input_price_per_1m,
        price[`openrouter/${NEX_SLUG}`].output_price_per_1m,
        price[`openrouter/${NEX_SLUG}`].cached_input_price_per_1m,
      ], [NEX_PRICE.input, NEX_PRICE.output, NEX_PRICE.cache]);
      assert.equal(price[`openrouter/${INKLING_FREE_SLUG}`].input_price_per_1m, 0);
      assert.equal(price[`openrouter/${INKLING_FREE_SLUG}`].cached_input_price_per_1m, null);
      assert.equal(price[`thinkingmachines/${INKLING_PAID_SLUG}`].input_price_per_1m, 0.3);
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
