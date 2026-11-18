import assert from 'node:assert/strict';
import test from 'node:test';
import type { Sql } from 'postgres';
import {
  assertQwen4MaxLoopbackTestUrl, FINAL_ALIASES, PRODUCTION_SHAPED_DRY_RUN,
  seedCatalog20261116Qwen4Max, seedStepCounts, SLUG,
} from '../data/catalog-2026-11-16-qwen4-max';
import { runRehearsable } from './rehearsal';

// Opt in only against an already migrated local test DB. No dotenv/admin imports.
// Example: ARGON_TEST_DATABASE_URL=<loopback URL> npm run test:db
// npm test strips ARGON_TEST_DATABASE_URL, so this cannot connect in the unit suite.
const localUrl = process.env.ARGON_TEST_DATABASE_URL;
const enabled = Boolean(localUrl);
type Row = Record<string, unknown> & { id: number };

test('Qwen4-Max FINAL satisfies local Postgres constraints, re-runs to zero and rehearses rollback', { skip: !enabled }, async () => {
  assert.ok(localUrl);
  assertQwen4MaxLoopbackTestUrl(localUrl); // Before constructing any client; no remote/query-host fallback.
  const { default: postgres } = await import('postgres');
  const sql = postgres(localUrl, { max: 1, onnotice: () => {} });
  try {
    const before = await sql<Row[]>`SELECT * FROM models WHERE slug IN ${sql(FINAL_ALIASES)}`;
    assert.equal(before.length, 0, 'Use a test DB with no final model or aliases');
    const providersBefore = await sql<Row[]>`SELECT * FROM providers WHERE slug IN ${sql(['qwen', 'openrouter', 'vercel-ai-gateway'])}`;
    await runRehearsable(sql, false, async raw => {
      const tx = raw as unknown as Sql;
      for (const [slug, name, type] of [
        ['qwen', 'Qwen', 'producer'], ['openrouter', 'OpenRouter', 'aggregator'], ['vercel-ai-gateway', 'Vercel AI Gateway', 'aggregator'],
      ]) {
        const rows = await tx<Row[]>`SELECT * FROM providers WHERE slug = ${slug}`;
        if (!rows.length) await tx`INSERT INTO ${tx('providers')} ${tx({ slug, name, type })}`;
      }
      const preview = await seedCatalog20261116Qwen4Max(tx);
      assert.deepEqual(seedStepCounts(preview), PRODUCTION_SHAPED_DRY_RUN);
      assert.equal((await tx<Row[]>`SELECT * FROM models WHERE slug = ${SLUG}`).length, 0, 'planning does not write');

      assert.deepEqual(seedStepCounts(await seedCatalog20261116Qwen4Max(tx, true)), PRODUCTION_SHAPED_DRY_RUN);
      assert.deepEqual(await seedCatalog20261116Qwen4Max(tx), [], 'stored numeric/date/array/JSON values compare equal');
      assert.deepEqual(await seedCatalog20261116Qwen4Max(tx, true), [], 'second apply performs no writes');
      const [model] = await tx<Row[]>`SELECT * FROM models WHERE slug = ${SLUG}`;
      assert.equal(Number(model.context_window), 1_000_000);
      for (const key of ['max_output_tokens', 'parameters', 'active parameters', 'license', 'shutdown_date']) assert.equal(model[key], null);
      assert.equal(model.open_source, false);
      assert.deepEqual(model.input_modalities, ['text', 'image', 'video']);
      assert.deepEqual(model.output_modalities, ['text']);
      const channels = await tx<Row[]>`SELECT * FROM api_channel_prices WHERE model_id = ${model.id}`;
      const variants = await tx<Row[]>`SELECT * FROM api_channel_price_variants WHERE model_id = ${model.id}`;
      assert.equal(channels.length, 3);
      assert.equal(variants.length, 2);
      const qwen = (await tx<Row[]>`SELECT * FROM providers WHERE slug = 'qwen'`)[0];
      const vercel = (await tx<Row[]>`SELECT * FROM providers WHERE slug = 'vercel-ai-gateway'`)[0];
      const official = channels.find(row => row.provider_id === qwen.id)!;
      assert.deepEqual([Number(official.input_price_per_1m), Number(official.output_price_per_1m), Number(official.cached_input_price_per_1m), official.currency], [10, 30, 0.5, 'CNY']);
      assert.equal(channels.find(row => row.provider_id === vercel.id)!.cached_input_price_per_1m, null);
      for (const row of channels) {
        for (const key of ['promo_ends_at', 'regular_input_price_per_1m', 'regular_output_price_per_1m', 'regular_cached_input_price_per_1m']) assert.equal(row[key], null);
      }
      const headline = variants.filter(row => row.is_headline === true);
      assert.equal(headline.length, 1);
      assert.equal(headline[0].variant_key, 'beijing-cny');
      assert.equal(Number(headline[0].input_price_per_1m), Number(official.input_price_per_1m));
      assert.equal(Number(headline[0].cache_create_price_per_1m), 12.5);
      assert.deepEqual((headline[0].constraints_json as Record<string, unknown>).cache_write_prices_per_1m, { '5m': 12.5, '1h': 20 });
      assert.equal((await tx<Row[]>`SELECT * FROM usage_prices WHERE model_id = ${model.id}`).length, 0);
      assert.equal((await tx<Row[]>`SELECT * FROM model_plan_mapping WHERE model_id = ${model.id}`).length, 0);

      // Refresh older locked records without turning them back on.
      await tx`UPDATE api_channel_prices SET is_available = false, availability_locked = true, last_verified = '2026-11-15T00:00:00Z' WHERE model_id = ${model.id}`;
      await tx`UPDATE api_channel_price_variants SET is_available = false, availability_locked = true, last_verified = '2026-11-15T00:00:00Z' WHERE model_id = ${model.id}`;
      await seedCatalog20261116Qwen4Max(tx, true);
      const locked = await tx<Row[]>`SELECT * FROM api_channel_prices WHERE model_id = ${model.id}`;
      assert.ok(locked.every(row => row.is_available === false && row.availability_locked === true));
      const lockedVariants = await tx<Row[]>`SELECT * FROM api_channel_price_variants WHERE model_id = ${model.id}`;
      assert.ok(lockedVariants.every(row => row.is_available === false && row.availability_locked === true));
      assert.deepEqual(await seedCatalog20261116Qwen4Max(tx), []);
    });
    assert.deepEqual(await sql<Row[]>`SELECT * FROM models WHERE slug IN ${sql(FINAL_ALIASES)}`, before, 'rehearsal rolls back the final model and dependent rows');
    assert.deepEqual(await sql<Row[]>`SELECT * FROM providers WHERE slug IN ${sql(['qwen', 'openrouter', 'vercel-ai-gateway'])} ORDER BY id`,
      providersBefore.sort((a, b) => a.id - b.id), 'test fixture providers are rolled back too');
  } finally { await sql.end(); }
});
