import assert from 'node:assert/strict';
import test from 'node:test';
import type { Sql } from 'postgres';
import {
  BAIDU_PROVIDER, BILLING_PAGE, LIST_PRICE_CNY_PER_SECOND, MODEL_SLUG,
  PRICE_KIND, PRICE_UNIT, PRICING_UNIT, PRODUCTION_SHAPED_DRY_RUN,
  seedCatalog20261112ErnieWizshotMe, seedStepCounts,
} from '../data/catalog-2026-11-12-ernie-wizshot-me';

// Opt-in: needs a loopback Postgres with every migration applied (CI "Postgres seed check" step).
const localUrl = process.env.ARGON_TEST_DATABASE_URL;

test('ernie-wizshot-me seed satisfies Postgres constraints, re-runs to 0, and rolls back', { skip: !localUrl }, async () => {
  assert.ok(localUrl);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(localUrl).hostname));
  const { default: postgres } = await import('postgres');
  const sql = postgres(localUrl, { max: 1, onnotice: () => {} });
  try {
    const run = () => sql.begin('isolation level serializable', async raw => {
      const tx = raw as unknown as Sql;
      const existing = (await tx<Array<{ id: number }>>`SELECT id FROM providers WHERE slug = ${BAIDU_PROVIDER}`)[0];
      if (!existing) {
        await tx`INSERT INTO ${tx('providers')} ${tx({ slug: BAIDU_PROVIDER, name: '百度 (ERNIE)', type: 'official' })}`;
      } else {
        await tx`UPDATE providers SET type = 'official' WHERE id = ${existing.id}`;
      }
      const [{ before }] = await tx<Array<{ before: number }>>`SELECT count(*)::int AS before FROM models WHERE slug = ${MODEL_SLUG}`;
      assert.equal(before, 0, 'loopback DB should not already contain ernie-wizshot-me');

      const applied = await seedCatalog20261112ErnieWizshotMe(tx, true);
      assert.deepEqual(seedStepCounts(applied), PRODUCTION_SHAPED_DRY_RUN);
      assert.deepEqual(await seedCatalog20261112ErnieWizshotMe(tx, false), [], 'second dry-run after apply is empty');

      const [model] = await tx<Array<Record<string, unknown>>>`
        SELECT slug, name, type, model_category, pricing_unit FROM models WHERE slug = ${MODEL_SLUG}`;
      assert.equal(model.name, 'ERNIE-Wizshot-ME');
      assert.equal(model.type, 'multimodal');
      assert.equal(model.model_category, 'video');
      assert.equal(model.pricing_unit, PRICING_UNIT);

      const [price] = await tx<Array<Record<string, unknown>>>`
        SELECT u.price, u.currency, u.unit, u.price_kind, u.source_url, u.plan_id
          FROM usage_prices u
          JOIN models m ON m.id = u.model_id
          JOIN providers p ON p.id = u.provider_id
         WHERE m.slug = ${MODEL_SLUG} AND p.slug = ${BAIDU_PROVIDER}`;
      assert.equal(Number(price.price), LIST_PRICE_CNY_PER_SECOND);
      assert.equal(price.currency, 'CNY');
      assert.equal(price.unit, PRICE_UNIT);
      assert.equal(price.price_kind, PRICE_KIND);
      assert.equal(price.source_url, BILLING_PAGE);
      assert.equal(price.plan_id, null);

      const [{ channels }] = await tx<Array<{ channels: number }>>`
        SELECT count(*)::int AS channels FROM api_channel_prices c
          JOIN models m ON m.id = c.model_id WHERE m.slug = ${MODEL_SLUG}`;
      assert.equal(channels, 0);
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
    const [{ left }] = await sql<Array<{ left: number }>>`SELECT count(*)::int AS left FROM models WHERE slug = ${MODEL_SLUG}`;
    assert.equal(left, 0, 'constraint check must not commit');
  } finally { await sql.end(); }
});
