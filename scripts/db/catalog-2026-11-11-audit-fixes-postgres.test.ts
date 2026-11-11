import assert from 'node:assert/strict';
import test from 'node:test';
import type { Sql } from 'postgres';
import {
  PRODUCTION_SHAPED_DRY_RUN, QWEN_STILL_SOLD, QWEN_TIERS,
  seedCatalog20261111AuditFixes, seedStepCounts,
} from '../data/catalog-2026-11-11-audit-fixes';

// Opt-in: needs a loopback Postgres with every migration applied (CI "Postgres seed check" step).
const localUrl = process.env.ARGON_TEST_DATABASE_URL;
const touched = [
  'gpt-image-2', 'mistral-medium-3.5', 'gemini-3.1-flash-lite', 'deepseek-v4-flash', 'gemini-3.5-flash',
  'gemini-3.7-flash', 'mistral-medium-3', 'mistral-medium-3.1', 'devstral-2512', 'gemini-3.1-pro',
  'gemini-2.5-pro', 'gpt-6-astra', 'gpt-6.1-sol', 'gpt-6-luna',
  ...QWEN_TIERS.map(item => item.slug), ...QWEN_STILL_SOLD.map(item => item.slug),
];

test('audit-fixes seed satisfies Postgres constraints, re-runs to 0, and rolls back', { skip: !localUrl }, async () => {
  assert.ok(localUrl);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(localUrl).hostname));
  const { default: postgres } = await import('postgres');
  const sql = postgres(localUrl, { max: 1, onnotice: () => {} });
  try {
    const [{ n }] = await sql<Array<{ n: number }>>`SELECT count(*)::int AS n FROM models WHERE slug IN ${sql(touched)}`;
    assert.equal(n, 0, 'loopback DB should not already contain these models');
    const run = () => sql.begin('isolation level serializable', async raw => {
      const tx = raw as unknown as Sql;
      const ensure = async (row: Record<string, unknown>) => {
        const existing = (await tx<Array<{ id: number }>>`SELECT id FROM providers WHERE slug = ${row.slug as string}`)[0];
        if (existing) return existing.id;
        return (await tx<Array<{ id: number }>>`INSERT INTO ${tx('providers')} ${tx(row)} RETURNING id`)[0].id;
      };
      const openaiId = await ensure({ slug: 'openai', name: 'OpenAI', type: 'official' });
      const googleId = await ensure({ slug: 'google', name: 'Google', type: 'producer' });
      const qwenId = await ensure({ slug: 'qwen', name: 'Qwen', type: 'official' });
      const add = async (slug: string, providerId: number) => {
        const [row] = await tx<Array<{ id: number }>>`INSERT INTO ${tx('models')} ${tx({
          slug, name: slug, type: 'llm', provider_ids: [providerId], description: `${slug} existing`,
        })} RETURNING id`;
        return row.id;
      };
      await add('gpt-image-2', openaiId);
      await add('mistral-medium-3.5', openaiId);
      await add('gemini-3.1-flash-lite', googleId);
      await add('deepseek-v4-flash', openaiId);
      await add('gemini-3.5-flash', googleId);
      await add('gemini-3.7-flash', googleId);
      await add('mistral-medium-3', openaiId);
      await add('mistral-medium-3.1', openaiId);
      await add('devstral-2512', openaiId);
      const pro = await add('gemini-3.1-pro', googleId);
      const pro25 = await add('gemini-2.5-pro', googleId);
      const astra = await add('gpt-6-astra', openaiId);
      const sol = await add('gpt-6.1-sol', openaiId);
      const luna = await add('gpt-6-luna', openaiId);
      const price = async (modelId: number, providerId: number, input: number, output: number, extra: Record<string, unknown> = {}) => {
        await tx`INSERT INTO ${tx('api_channel_prices')} ${tx({
          model_id: modelId, provider_id: providerId, input_price_per_1m: input, output_price_per_1m: output,
          currency: providerId === qwenId ? 'CNY' : 'USD', price_unit: 'per_1m_tokens', is_available: true, ...extra,
        })}`;
      };
      await price(pro, googleId, 2, 12, { cached_input_price_per_1m: 0.2 });
      await price(pro25, googleId, 1.25, 10);
      await price(astra, openaiId, 10, 50, { cached_input_price_per_1m: 1 });
      await price(sol, openaiId, 2, 10, { cached_input_price_per_1m: 0.1 });
      await price(luna, openaiId, 0.1, 0.5, { cached_input_price_per_1m: 0.01 });
      for (const spec of QWEN_TIERS) {
        const id = await add(spec.slug, qwenId);
        const headline = spec.bands.find(band => band.headline)!;
        await price(id, qwenId, headline.input, headline.output, spec.slug === 'qwen-plus'
          ? { is_available: false, notes: 'retired 2026-08-20T03:21:00.000Z: absent from successful full-catalog Qwen scrape' }
          : {});
      }
      for (const spec of QWEN_STILL_SOLD) {
        const id = await add(spec.slug, qwenId);
        await price(id, qwenId, spec.input, spec.output, {
          is_available: false, notes: 'retired 2026-08-20T03:21:00.000Z: absent from successful full-catalog Qwen scrape',
        });
      }

      const applied = await seedCatalog20261111AuditFixes(tx, true);
      assert.deepEqual(seedStepCounts(applied), PRODUCTION_SHAPED_DRY_RUN);
      assert.deepEqual(seedStepCounts(await seedCatalog20261111AuditFixes(tx, false)), {
        providers: { insert: 0, update: 0 }, models: { insert: 0, update: 0 },
        api_channel_prices: { insert: 0, update: 0 }, api_channel_price_variants: { insert: 0, update: 0 },
      });

      const [image] = await tx<Array<Record<string, unknown>>>`
        SELECT shutdown_date::text AS shutdown_date, replacement_model FROM models WHERE slug = 'gpt-image-2'`;
      assert.equal(image.shutdown_date, '2027-02-10');
      assert.equal(image.replacement_model, 'gpt-image-2.6-sunburst or gpt-image-2.6-flare');
      const [lite] = await tx<Array<Record<string, unknown>>>`
        SELECT shutdown_date::text AS shutdown_date, deprecated_at::text AS deprecated_at, description
          FROM models WHERE slug = 'gemini-3.1-flash-lite'`;
      assert.equal(lite.shutdown_date, '2027-05-07');
      assert.equal(lite.deprecated_at, null);
      assert.match(String(lite.description), /earliest possible/);
      const rows = await tx<Array<Record<string, unknown>>>`
        SELECT slug, shutdown_date::text AS shutdown_date, replacement_model, deprecated_at::text AS deprecated_at
          FROM models WHERE slug IN ('gemini-3.5-flash', 'gemini-3.7-flash', 'deepseek-v4-flash')`;
      const by = Object.fromEntries(rows.map(row => [row.slug, row]));
      assert.equal(by['gemini-3.5-flash'].replacement_model, 'gemini-3.6-flash');
      assert.equal(by['gemini-3.5-flash'].shutdown_date, null);
      assert.equal(by['gemini-3.7-flash'].replacement_model, 'gemini-3.8-flash');
      assert.equal(by['deepseek-v4-flash'].shutdown_date, null);
      assert.equal(by['deepseek-v4-flash'].deprecated_at, '2026-09-10');
      assert.equal(by['deepseek-v4-flash'].replacement_model, 'deepseek-v4.1-flash');

      const [max] = await tx<Array<Record<string, unknown>>>`
        SELECT c.is_available, c.notes FROM api_channel_prices c
          JOIN models m ON m.id = c.model_id JOIN providers p ON p.id = c.provider_id
         WHERE m.slug = 'qwen-max' AND p.slug = 'qwen'`;
      assert.equal(max.is_available, true);
      assert.doesNotMatch(String(max.notes), /absent from successful full-catalog/);
      const [band] = await tx<Array<Record<string, unknown>>>`
        SELECT v.input_price_per_1m, v.output_price_per_1m FROM api_channel_price_variants v
          JOIN models m ON m.id = v.model_id WHERE m.slug = 'qwen3.7-flash' AND v.variant_key = 'context-256k-1m'`;
      assert.equal(Number(band.input_price_per_1m), 1.2);
      assert.equal(Number(band.output_price_per_1m), 4.8);
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
    const [{ left }] = await sql<Array<{ left: number }>>`SELECT count(*)::int AS left FROM models WHERE slug IN ${sql(touched)}`;
    assert.equal(left, 0, 'constraint check must not commit');
  } finally { await sql.end(); }
});
