import assert from 'node:assert/strict';
import test from 'node:test';
import type { Sql } from 'postgres';
import { HY4_SLUG, seedHy4 } from '../data/hy4-2026-11-04';

// Opt-in: needs a loopback Postgres with every migration applied (CI "Postgres seed check" step).
const localUrl = process.env.ARGON_TEST_DATABASE_URL;

test('Hy4 seed applies on real Postgres constraints next to Hy4 Preview and re-runs to 0', { skip: !localUrl }, async () => {
  assert.ok(localUrl);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(localUrl).hostname));
  const { default: postgres } = await import('postgres');
  const sql = postgres(localUrl, { max: 1, onnotice: () => {} });
  try {
    await sql.begin('isolation level serializable', async raw => {
      const tx = raw as unknown as Sql;
      const id = async (table: string, row: Record<string, unknown>) =>
        (await tx`INSERT INTO ${tx(table)} ${tx(row)} RETURNING id`)[0].id as number;
      // Production-shaped: provider tencent and aggregator openrouter exist; tencent-hy4-preview came from the 10-15 audit seed.
      const tencent = (await tx`SELECT id FROM providers WHERE slug = 'tencent'`)[0]?.id as number | undefined
        ?? await id('providers', { slug: 'tencent', name: 'Tencent', type: 'producer' });
      const openrouter = (await tx`SELECT id FROM providers WHERE slug = 'openrouter'`)[0]?.id as number | undefined
        ?? await id('providers', { slug: 'openrouter', name: 'OpenRouter', type: 'aggregator' });
      const preview = await id('models', { slug: 'tencent-hy4-preview', name: 'hy4-preview', type: 'llm', model_category: 'text', provider_ids: [tencent] });
      await id('api_channel_prices', { model_id: preview, provider_id: openrouter, input_price_per_1m: 0.834, output_price_per_1m: 2.501,
        currency: 'USD', price_unit: 'per_1m_tokens', is_available: true });

      const plan = await seedHy4(tx, false);
      assert.deepEqual(plan.map(s => [s.table, s.action]), [['models', 'insert'], ['api_channel_prices', 'insert']]);
      const applied = await seedHy4(tx, true); // throws on any CHECK / NOT NULL / FK violation
      assert.equal(applied.length, 2);
      assert.deepEqual(await seedHy4(tx, false), [], 'second dry-run after apply is empty');

      const [model] = await tx`SELECT * FROM models WHERE slug = ${HY4_SLUG}`;
      assert.equal(model.name, 'Hy4');
      assert.deepEqual(model.provider_ids, [tencent]);
      assert.equal(model.context_window, 1_048_576);
      assert.equal(Number(model.max_output_tokens), 65_536);
      assert.deepEqual(model.input_modalities, ['text', 'image']);
      assert.ok(model.capabilities.includes('tool-calling') && model.capabilities.includes('structured-outputs'));
      const channels = await tx`SELECT c.*, p.slug AS provider_slug FROM api_channel_prices c JOIN providers p ON p.id = c.provider_id WHERE c.model_id = ${model.id}`;
      assert.equal(channels.length, 1, 'OpenRouter only; no official Tencent direct price');
      const [ch] = channels;
      assert.equal(ch.provider_slug, 'openrouter');
      assert.deepEqual([ch.input_price_per_1m, ch.output_price_per_1m, ch.cached_input_price_per_1m], [0.417, 1.251, 0.021]);
      assert.deepEqual([ch.promo_ends_at, ch.regular_input_price_per_1m, ch.regular_output_price_per_1m], [null, null, null]);
      assert.match(ch.notes, /List price \$0\.834 \/ \$2\.501 \/ \$0\.042/);
      const [previewRow] = await tx`SELECT input_price_per_1m FROM api_channel_prices WHERE model_id = ${preview}`;
      assert.equal(previewRow.input_price_per_1m, 0.834, 'Hy4 Preview is untouched');
      throw new Error('rollback');
    }).catch(e => { if ((e as Error).message !== 'rollback') throw e; });
  } finally { await sql.end(); }
});
