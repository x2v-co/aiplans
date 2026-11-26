import assert from 'node:assert/strict';
import test from 'node:test';
import type { Sql } from 'postgres';
import { BAILIAN_DECISION_SPECS } from '../../src/lib/decision-models-2026-11-26';
import {
  PRODUCTION_SHAPED_DRY_RUN, seedCatalog20261126BailianDecision, seedStepCounts,
} from '../data/catalog-2026-11-26-bailian-decision';
import { runRehearsable } from './rehearsal';

// Opt-in: loopback Postgres with every migration applied, same pattern as the 11-13 seed check.
const localUrl = process.env.ARGON_TEST_DATABASE_URL;
const slugs = BAILIAN_DECISION_SPECS.map(spec => spec.slug);

test('百炼 decision seed satisfies Postgres constraints, re-runs empty, and rehearses with ROLLBACK', { skip: !localUrl }, async () => {
  assert.ok(localUrl);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(localUrl).hostname));
  const { default: postgres } = await import('postgres');
  const sql = postgres(localUrl, { max: 1, onnotice: () => {} });
  try {
    const [{ n }] = await sql<Array<{ n: number }>>`SELECT count(*)::int AS n FROM models WHERE slug IN ${sql(slugs)}`;
    assert.equal(n, 0, 'loopback DB should not already contain these models');
    const run = () => runRehearsable(sql, false, async raw => {
      const tx = raw as unknown as Sql;
      const providers = await tx<Array<{ id: number }>>`SELECT id FROM providers WHERE slug = 'qwen'`;
      if (!providers.length) {
        await tx`INSERT INTO providers (slug, name, type) VALUES ('qwen', '阿里云百炼', 'official')`;
      }
      const applied = await seedCatalog20261126BailianDecision(tx, true);
      assert.deepEqual(seedStepCounts(applied), PRODUCTION_SHAPED_DRY_RUN);
      assert.deepEqual(await seedCatalog20261126BailianDecision(tx, true), [], 'second write run is empty');

      const models = await tx<Array<Record<string, unknown>>>`
        SELECT slug, model_category, context_window, max_output_tokens, input_modalities, released_at
          FROM models WHERE slug IN ${tx(slugs)}`;
      assert.equal(models.length, 2);
      for (const spec of BAILIAN_DECISION_SPECS) {
        const model = models.find(row => row.slug === spec.slug)!;
        assert.equal(model.model_category, 'decision');
        assert.equal(Number(model.context_window), spec.context);
        assert.equal(Number(model.max_output_tokens), 0);
        assert.deepEqual(model.input_modalities, [...spec.inputModalities]);
        assert.equal(new Date(String(model.released_at)).toISOString().slice(0, 10), spec.releasedAt);
      }
      const channels = await tx<Array<Record<string, unknown>>>`
        SELECT m.slug AS model, p.slug AS provider, c.input_price_per_1m, c.output_price_per_1m, c.currency
          FROM api_channel_prices c JOIN models m ON m.id = c.model_id JOIN providers p ON p.id = c.provider_id
         WHERE m.slug IN ${tx(slugs)}`;
      assert.equal(channels.length, 2);
      const variants = await tx<Array<Record<string, unknown>>>`
        SELECT m.slug AS model, v.variant_key, v.input_price_per_1m, v.output_price_per_1m,
               v.currency, v.is_headline, v.constraints_json, v.notes
          FROM api_channel_price_variants v JOIN models m ON m.id = v.model_id
         WHERE m.slug IN ${tx(slugs)}`;
      assert.equal(variants.length, 4);
      for (const spec of BAILIAN_DECISION_SPECS) {
        const channel = channels.find(row => row.model === spec.slug)!;
        assert.equal(channel.provider, 'qwen');
        assert.equal(Number(channel.input_price_per_1m), spec.beijingInput);
        assert.equal(Number(channel.output_price_per_1m), 0);
        assert.equal(channel.currency, 'CNY');
        for (const row of variants.filter(row => row.model === spec.slug)) {
          const beijing = row.variant_key === 'cn-beijing';
          assert.equal(Number(row.input_price_per_1m), beijing ? spec.beijingInput : spec.singaporeInput);
          assert.equal(Number(row.output_price_per_1m), 0);
          assert.equal(row.currency, 'CNY');
          assert.equal(row.is_headline, beijing);
          if (spec.status === 'preview') {
            assert.equal((row.constraints_json as Record<string, unknown>).limited_time_free, true);
            assert.match(String(row.notes), /no end date/);
          }
        }
      }
      return seedStepCounts(applied);
    });
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        assert.deepEqual(await run(), PRODUCTION_SHAPED_DRY_RUN);
        break;
      } catch (error) {
        const message = (error as Error).message ?? '';
        if (attempt === 3 || !/duplicate key|could not serialize|23505|40001/.test(message)) throw error;
      }
    }
    const [{ left }] = await sql<Array<{ left: number }>>`SELECT count(*)::int AS left FROM models WHERE slug IN ${sql(slugs)}`;
    assert.equal(left, 0, 'rehearsal must not commit');
    for (const table of ['api_channel_prices', 'api_channel_price_variants']) {
      const [{ left }] = await sql<Array<{ left: number }>>`SELECT count(*)::int AS left FROM ${sql(table)} c JOIN models m ON m.id = c.model_id WHERE m.slug IN ${sql(slugs)}`;
      assert.equal(left, 0, `${table} rehearsal must not commit`);
    }
  } finally { await sql.end(); }
});
