import assert from 'node:assert/strict';
import test from 'node:test';
import type { Sql } from 'postgres';
import { seedCatalog20261104, type Step } from '../data/catalog-2026-11-04';
import { loadCatalog1104ProductionFixture } from './catalog-2026-11-04-pg-fixture';

// Opt-in: needs a loopback Postgres with every migration applied (CI "Postgres seed check" step).
// The in-memory fake does not enforce CHECK constraints, which is how #303's apply failed in production.
const localUrl = process.env.ARGON_TEST_DATABASE_URL;
const count = (steps: Step[]) => Object.fromEntries(['providers', 'plans', 'models', 'usage_prices', 'api_channel_prices', 'api_channel_price_variants']
  .map(table => [table, [steps.filter(s => s.table === table && s.action === 'insert').length, steps.filter(s => s.table === table && s.action === 'update').length]]));

test('1104 seed applies on real Postgres constraints, preserves model fields, and re-runs to 0', { skip: !localUrl }, async () => {
  assert.ok(localUrl);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(localUrl).hostname));
  const { default: postgres } = await import('postgres');
  const sql = postgres(localUrl, { max: 1, onnotice: () => {} });
  try {
    await sql.begin('isolation level serializable', async raw => {
      const tx = raw as unknown as Sql;
      const [{ n }] = await tx`SELECT count(*)::int AS n FROM providers WHERE slug IN ('openai', 'google', 'xai', 'meituan', 'elevenlabs', 'mureka')`;
      assert.equal(n, 0, 'needs a freshly migrated database without catalog rows');
      await loadCatalog1104ProductionFixture(tx);
      const preview = await seedCatalog20261104(tx, false);
      // Production dry-run was 74 = 61 insert + 13 update; the INR Sarvam channel row is no longer written.
      assert.deepEqual(count(preview), { providers: [2, 1], plans: [2, 7], models: [10, 5], usage_prices: [44, 0], api_channel_prices: [0, 0], api_channel_price_variants: [2, 0] });
      const grok = preview.filter(s => s.table === 'models' && s.target.startsWith('grok-imagine-video'));
      assert.equal(grok.length, 2);
      for (const step of preview.filter(s => s.table === 'models' && s.action === 'update')) {
        for (const field of ['type', 'capabilities']) assert.ok(!(field in step.changes), `${step.target} must not change ${field}`);
        // An empty link may be filled; an existing one is never replaced.
        assert.ok(!step.changes.offical_link || step.changes.offical_link.from == null, `${step.target} must keep offical_link`);
        if (step.changes.description?.from) assert.ok(String(step.changes.description.to).startsWith(String(step.changes.description.from)), `${step.target} appends to description`);
      }
      const applied = await seedCatalog20261104(tx, true); // throws on any CHECK/NOT NULL/FK violation
      assert.equal(applied.length, preview.length);
      assert.deepEqual(await seedCatalog20261104(tx, false), [], 'second dry-run after apply is empty');
      const rows = await tx`SELECT slug, type, capabilities, pricing_unit, description FROM models WHERE slug IN ('grok-imagine-video-720p', 'grok-imagine-video-1-5-agent', 'mureka', 'eleven-v4', 'eleven-v4-turbo') ORDER BY slug`;
      const by = Object.fromEntries(rows.map(r => [r.slug, r]));
      for (const slug of ['grok-imagine-video-720p', 'grok-imagine-video-1-5-agent']) {
        assert.equal(by[slug].type, 'video');
        assert.deepEqual(by[slug].capabilities, ['leaderboard-version', 'text-to-video']);
        assert.equal(by[slug].pricing_unit, 'per_second');
        assert.match(by[slug].description, /Arena AI rank/);
      }
      assert.equal(by.mureka.type, 'multimodal');
      assert.equal(by['eleven-v4'].pricing_unit, 'per_1k_characters');
      assert.equal(by['eleven-v4-turbo'].pricing_unit, 'per_1k_characters');
      const [go] = await tx`SELECT access_from_china, price FROM plans WHERE slug = 'chatgpt-go'`;
      assert.deepEqual([go.access_from_china, go.price], [false, null]);
      throw new Error('rollback');
    }).catch(e => { if ((e as Error).message !== 'rollback') throw e; });
  } finally { await sql.end(); }
});
