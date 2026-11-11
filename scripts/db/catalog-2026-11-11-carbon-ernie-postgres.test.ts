import assert from 'node:assert/strict';
import test from 'node:test';
import type { Sql } from 'postgres';
import { ARGON_PROMO_ENDS_AT } from '../data/gemini-4-argon';
import { CARBON_SLUG } from '../data/gemini-4-carbon';
import {
  CARBON_BATCH_SLUG, ERNIE_CONTEXT, ERNIE_INTL, ERNIE_SLUG, PRODUCTION_SHAPED_DRY_RUN,
  seedCatalog20261111CarbonErnie, seedStepCounts,
} from '../data/catalog-2026-11-11-carbon-ernie';

// Opt-in: needs a loopback Postgres with every migration applied (CI "Postgres seed check" step).
const localUrl = process.env.ARGON_TEST_DATABASE_URL;
const slugs = [CARBON_SLUG, CARBON_BATCH_SLUG, ERNIE_SLUG];

test('Carbon / ERNIE seed satisfies Postgres constraints, re-runs to 0, and rolls back', { skip: !localUrl }, async () => {
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
      const googleId = await ensure({ slug: 'google', name: 'Google', type: 'producer' });
      const vertexId = await ensure({ slug: 'vertex-ai', name: 'Google Vertex AI', type: 'cloud' });
      await ensure({ slug: 'openrouter', name: 'OpenRouter', type: 'aggregator' });
      await ensure({ slug: 'vercel-ai-gateway', name: 'Vercel AI Gateway', type: 'aggregator' });
      await ensure({ slug: 'baidu', name: 'Baidu', type: 'official' });
      const [model] = await tx<Array<{ id: number }>>`
        INSERT INTO ${tx('models')} ${tx({
          slug: CARBON_SLUG, name: 'Gemini 4 Carbon', type: 'llm', provider_ids: [googleId],
          description: 'Status: announced.\nDeveloper API not yet available.',
        })} RETURNING id`;
      await tx`INSERT INTO ${tx('api_channel_prices')} ${tx({
        model_id: model.id, provider_id: googleId, input_price_per_1m: 2, output_price_per_1m: 10, cached_input_price_per_1m: 0.1,
        currency: 'USD', price_unit: 'per_1m_tokens', is_available: false, availability_locked: true,
        last_verified: new Date('2026-10-29T00:00:00Z'), notes: 'reference only',
      })}`;
      await tx`INSERT INTO ${tx('api_channel_prices')} ${tx({
        model_id: model.id, provider_id: vertexId, input_price_per_1m: 2, output_price_per_1m: 10,
        currency: 'USD', price_unit: 'per_1m_tokens', is_available: true, last_verified: new Date('2026-10-29T00:00:00Z'),
        notes: 'Vertex $2/$10',
      })}`;

      const applied = await seedCatalog20261111CarbonErnie(tx, true);
      assert.deepEqual(seedStepCounts(applied), PRODUCTION_SHAPED_DRY_RUN);
      assert.deepEqual(await seedCatalog20261111CarbonErnie(tx, false), [], 'second dry-run after apply is empty');

      const rows = await tx<Array<Record<string, unknown>>>`
        SELECT slug, context_window, max_output_tokens, parameters, description
          FROM models WHERE slug IN ${tx(slugs)} ORDER BY slug`;
      const by = Object.fromEntries(rows.map(row => [row.slug, row]));
      assert.match(String(by[CARBON_SLUG].description), /^Status: available\./);
      assert.equal(by[CARBON_SLUG].context_window, null);
      assert.equal(by[ERNIE_SLUG].context_window, ERNIE_CONTEXT);
      assert.equal(by[ERNIE_SLUG].parameters, null);
      assert.equal(by[ERNIE_SLUG].max_output_tokens, null);
      assert.equal(by[CARBON_BATCH_SLUG].context_window, null);

      const prices = await tx<Array<Record<string, unknown>>>`
        SELECT m.slug, p.slug AS provider, c.input_price_per_1m, c.output_price_per_1m, c.cached_input_price_per_1m,
               c.currency, c.promo_ends_at, c.regular_input_price_per_1m, c.is_available, c.availability_locked
          FROM api_channel_prices c
          JOIN models m ON m.id = c.model_id
          JOIN providers p ON p.id = c.provider_id
         WHERE m.slug IN ${tx(slugs)}`;
      const key = (row: Record<string, unknown>) => `${row.provider}/${row.slug}`;
      const price = Object.fromEntries(prices.map(row => [key(row), row]));
      assert.equal(price[`google/${CARBON_SLUG}`].is_available, true);
      assert.equal(price[`google/${CARBON_SLUG}`].availability_locked, false);
      assert.equal(new Date(String(price[`google/${CARBON_SLUG}`].promo_ends_at)).toISOString(), ARGON_PROMO_ENDS_AT);
      assert.equal(price[`vertex-ai/${CARBON_SLUG}`].regular_input_price_per_1m, 4);
      assert.equal(price[`vertex-ai/${CARBON_SLUG}`].cached_input_price_per_1m, 0.1);
      assert.equal(price[`openrouter/${CARBON_BATCH_SLUG}`].input_price_per_1m, 1);
      assert.equal(price[`google/${CARBON_BATCH_SLUG}`], undefined);
      assert.equal(price[`baidu/${ERNIE_SLUG}`].currency, 'CNY');
      assert.equal(price[`baidu/${ERNIE_SLUG}`].promo_ends_at, null);
      assert.deepEqual([
        price[`baidu/${ERNIE_SLUG}`].input_price_per_1m,
        price[`baidu/${ERNIE_SLUG}`].output_price_per_1m,
        price[`baidu/${ERNIE_SLUG}`].cached_input_price_per_1m,
      ], [1, 4, 0.1]);
      assert.equal(price[`baidu-global/${ERNIE_SLUG}`].input_price_per_1m, ERNIE_INTL.input);
      assert.equal(price[`baidu-global/${ERNIE_SLUG}`].cached_input_price_per_1m, ERNIE_INTL.cache);
      assert.equal(price[`openrouter/${ERNIE_SLUG}`].output_price_per_1m, ERNIE_INTL.output);

      const variants = await tx<Array<Record<string, unknown>>>`
        SELECT v.variant_key, v.input_price_per_1m, v.is_headline, v.currency, v.constraints_json
          FROM api_channel_price_variants v
          JOIN models m ON m.id = v.model_id
          JOIN providers p ON p.id = v.provider_id
         WHERE m.slug = ${ERNIE_SLUG} AND p.slug = 'baidu'
         ORDER BY v.variant_key`;
      assert.equal(variants.length, 2);
      const idle = variants.find(row => row.variant_key === 'idle')!;
      const peak = variants.find(row => row.variant_key === 'peak')!;
      assert.equal(peak.is_headline, true);
      assert.equal(idle.is_headline, false);
      assert.equal(idle.input_price_per_1m, 0.5);
      assert.equal(idle.currency, 'CNY');
      assert.equal((idle.constraints_json as { promo_end_published: boolean }).promo_end_published, false);
      assert.equal((peak.constraints_json as { list_output_price_per_1m: number }).list_output_price_per_1m, 8);
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
