import assert from 'node:assert/strict';
import test from 'node:test';
import type { Sql } from 'postgres';
import { GEMINI_DECISION_SPEC } from '../../src/lib/decision-models-2026-11-12';
import {
  PRODUCTION_SHAPED_DRY_RUN, seedCatalog20261112AuditFixes, seedStepCounts,
} from '../data/catalog-2026-11-12-audit-fixes';

// Opt-in: needs a loopback Postgres with every migration applied (CI "Postgres seed check" step).
const localUrl = process.env.ARGON_TEST_DATABASE_URL;
const slugs = [GEMINI_DECISION_SPEC.slug, 'google-gemini-decision-1'];

test('Gemini Decision 1 seed satisfies Postgres constraints, re-runs to 0, and rolls back', { skip: !localUrl }, async () => {
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
      await ensure({ slug: 'google', name: 'Google', type: 'producer' });
      await ensure({ slug: 'vercel-ai-gateway', name: 'Vercel AI Gateway', type: 'aggregator' });

      const applied = await seedCatalog20261112AuditFixes(tx, true);
      assert.deepEqual(seedStepCounts(applied), PRODUCTION_SHAPED_DRY_RUN);
      assert.deepEqual(
        (await seedCatalog20261112AuditFixes(tx, false)).filter(step => step.action !== 'skip'),
        [],
        'second dry-run after apply is empty',
      );

      const [model] = await tx<Array<Record<string, unknown>>>`
        SELECT slug, model_category, context_window, max_output_tokens, open_source
          FROM models WHERE slug = ${GEMINI_DECISION_SPEC.slug}`;
      assert.equal(model.model_category, 'decision');
      assert.equal(model.context_window, 262_144);
      assert.equal(model.max_output_tokens, 0);
      assert.equal(model.open_source, false);

      const prices = await tx<Array<Record<string, unknown>>>`
        SELECT p.slug AS provider, c.input_price_per_1m, c.output_price_per_1m, c.cached_input_price_per_1m,
               c.currency, c.is_available
          FROM api_channel_prices c
          JOIN models m ON m.id = c.model_id
          JOIN providers p ON p.id = c.provider_id
         WHERE m.slug = ${GEMINI_DECISION_SPEC.slug}
         ORDER BY p.slug`;
      assert.equal(prices.length, 2);
      for (const row of prices) {
        assert.equal(Number(row.input_price_per_1m), 0.10);
        assert.equal(Number(row.output_price_per_1m), 0);
        assert.equal(row.cached_input_price_per_1m, null);
        assert.equal(row.currency, 'USD');
        assert.equal(row.is_available, true);
      }
      assert.deepEqual(prices.map(row => row.provider).sort(), ['google', 'vercel-ai-gateway']);
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
