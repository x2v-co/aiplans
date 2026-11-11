import assert from 'node:assert/strict';
import test from 'node:test';
import type { Sql } from 'postgres';
import {
  PRODUCTION_SHAPED_DRY_RUN, QWEN_PREVIEW_SLUG, REQUIRED_PROVIDERS,
  seedCatalog20261111TokenPlanH3Image, seedStepCounts,
} from '../data/catalog-2026-11-11-token-plan-h3-image';
import { H3_IMAGE_SLUGS } from '../../src/lib/image-model-catalog';
import { runRehearsable } from './rehearsal';

// Opt-in on a migrated loopback DB only; even fixture writes roll back.
const localUrl = process.env.ARGON_TEST_DATABASE_URL;
const slugs = [QWEN_PREVIEW_SLUG, ...H3_IMAGE_SLUGS];
test('Token Plan / H3 satisfies real constraints, re-runs to zero, and rolls back', { skip: !localUrl }, async () => {
  assert.ok(localUrl);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(localUrl).hostname));
  const { default: postgres } = await import('postgres');
  const sql = postgres(localUrl, { max: 1, onnotice: () => {} });
  try {
    const [{ n }] = await sql<Array<{ n: number }>>`SELECT count(*)::int AS n FROM models WHERE slug IN ${sql(slugs)}`;
    assert.equal(n, 0, 'loopback fixture expects target models absent');
    const run = () => runRehearsable(sql, false, async raw => {
      const tx = raw as unknown as Sql;
      for (const slug of REQUIRED_PROVIDERS) {
        const found = await tx`SELECT id FROM providers WHERE slug = ${slug}`;
        if (!found.length) await tx`INSERT INTO providers (slug, name, type) VALUES (${slug}, ${slug}, 'official')`;
      }
      const steps = await seedCatalog20261111TokenPlanH3Image(tx, true);
      assert.deepEqual(seedStepCounts(steps), PRODUCTION_SHAPED_DRY_RUN);
      assert.deepEqual(await seedCatalog20261111TokenPlanH3Image(tx), []);
      const [preview] = await tx`SELECT *, shutdown_date::text AS shutdown_day FROM models WHERE slug = ${QWEN_PREVIEW_SLUG}`;
      assert.equal(preview.pricing_unit, 'subscription_only'); assert.equal(preview.context_window, null);
      assert.equal(preview.shutdown_day, '2026-11-26');
      assert.match(preview.description, /2026-11-26T00:00:00\+08:00/);
      assert.match(preview.description, /待定 \/ pending/);
      for (const table of ['api_channel_prices', 'usage_prices']) {
        const [{ n }] = await tx`SELECT count(*)::int AS n FROM ${tx(table)} WHERE model_id = ${preview.id}`;
        assert.equal(n, 0);
      }
      const plans = await tx`SELECT * FROM plans WHERE slug LIKE 'qwen-token-plan-%' ORDER BY slug`;
      assert.equal(plans.length, 8);
      for (const [slug, price, currency] of [['qwen-token-plan-pro', 312, 'CNY'], ['qwen-token-plan-pro-intl', 43, 'USD']] as const) {
        const row = plans.find(p => p.slug === slug)!;
        assert.equal(row.price, price); assert.equal(row.currency, currency);
        assert.equal(row.included_credits, 200_000); assert.equal(row.plan_kind, 'agent');
      }
      const mappings = await tx`SELECT * FROM model_plan_mapping WHERE model_id = ${preview.id}`;
      assert.equal(mappings.length, 8);
      const prices = await tx`SELECT u.*, p.slug AS provider_slug, m.slug AS model_slug FROM usage_prices u JOIN providers p ON u.provider_id = p.id JOIN models m ON m.id = u.model_id WHERE m.slug IN ${tx([...H3_IMAGE_SLUGS])}`;
      assert.equal(prices.length, 16);
      for (const row of prices) {
        assert.equal(row.currency, row.provider_slug === 'minimax-china' ? 'CNY' : 'USD');
        assert.equal(row.constraints_json.conditional_promo.minimum_final_image_pixels, 16_600_000);
        assert.equal(row.constraints_json.conditional_promo.ends_at, '2026-11-17T16:00:00.000Z');
        if (row.unit === 'image') assert.equal(row.constraints_json.approximate, true);
      }
      assert.deepEqual(await seedCatalog20261111TokenPlanH3Image(tx, true), []);
    });
    // Other opt-in seed tests may create the same provider fixtures concurrently.
    for (let attempt = 0; attempt < 4; attempt++) {
      try { await run(); break; } catch (error) {
        if (attempt === 3 || !/duplicate key|could not serialize|23505|40001/.test(String(error))) throw error;
      }
    }
    const [{ n: left }] = await sql<Array<{ n: number }>>`SELECT count(*)::int AS n FROM models WHERE slug IN ${sql(slugs)}`;
    assert.equal(left, 0, 'rehearsal must not commit');
  } finally { await sql.end(); }
});
