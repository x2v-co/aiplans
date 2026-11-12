import assert from 'node:assert/strict';
import test from 'node:test';
import type { Sql } from 'postgres';
import {
  EXISTING_PRODUCTION_SLUGS, NEW_PRODUCTION_SLUGS, PRODUCTION_SHAPED_DRY_RUN,
  PROVIDER_SLUG, seedCatalog20261112Cysuo, seedStepCounts,
} from '../data/catalog-2026-11-12-cysuo';

// Opt-in: needs a loopback Postgres with every migration applied (CI "Postgres seed check" step).
const localUrl = process.env.ARGON_TEST_DATABASE_URL;
const newSlugs = [...NEW_PRODUCTION_SLUGS];

test('cysuo seed satisfies Postgres constraints, re-runs to 0, and rolls back', { skip: !localUrl }, async () => {
  assert.ok(localUrl);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(localUrl).hostname));
  const { default: postgres } = await import('postgres');
  const sql = postgres(localUrl, { max: 1, onnotice: () => {} });
  try {
    const run = () => sql.begin('isolation level serializable', async raw => {
      const tx = raw as unknown as Sql;
      const ensureProvider = async (row: Record<string, unknown>) => {
        const existing = (await tx<Array<{ id: number }>>`SELECT id FROM providers WHERE slug = ${row.slug as string}`)[0];
        if (existing) return existing.id;
        return (await tx<Array<{ id: number }>>`INSERT INTO ${tx('providers')} ${tx(row)} RETURNING id`)[0].id;
      };
      const baiduId = await ensureProvider({ slug: 'baidu', name: '百度 (ERNIE)', type: 'official' });
      await ensureProvider({ slug: 'baidu-global', name: 'Baidu Qianfan International', type: 'official' });
      const [{ cysuoBefore }] = await tx<Array<{ cysuoBefore: number }>>`SELECT count(*)::int AS "cysuoBefore" FROM providers WHERE slug = ${PROVIDER_SLUG}`;
      assert.equal(cysuoBefore, 0, 'loopback DB should not already contain cysuo');

      for (const slug of EXISTING_PRODUCTION_SLUGS) {
        const existing = (await tx<Array<{ id: number }>>`SELECT id FROM models WHERE slug = ${slug}`)[0];
        if (existing) continue;
        await tx`INSERT INTO ${tx('models')} ${tx({
          slug, name: slug, type: 'llm', model_category: 'text', provider_ids: [baiduId],
        })}`;
      }

      const applied = await seedCatalog20261112Cysuo(tx, true);
      assert.deepEqual(seedStepCounts(applied), PRODUCTION_SHAPED_DRY_RUN);
      assert.deepEqual(
        (await seedCatalog20261112Cysuo(tx, false)).filter(step => step.action !== 'skip'),
        [],
        'second dry-run after apply is empty',
      );

      const [provider] = await tx<Array<Record<string, unknown>>>`
        SELECT slug, type, currency, region, access_from_china FROM providers WHERE slug = ${PROVIDER_SLUG}`;
      assert.equal(provider.type, 'aggregator');
      assert.equal(provider.currency, 'CNY');
      assert.equal(provider.region, 'china');
      assert.equal(provider.access_from_china, true);

      const channels = await tx<Array<{ n: number }>>`
        SELECT count(*)::int AS n FROM api_channel_prices c
          JOIN providers p ON p.id = c.provider_id WHERE p.slug = ${PROVIDER_SLUG}`;
      assert.equal(channels[0].n, 12);
      const variants = await tx<Array<{ n: number }>>`
        SELECT count(*)::int AS n FROM api_channel_price_variants v
          JOIN providers p ON p.id = v.provider_id WHERE p.slug = ${PROVIDER_SLUG}`;
      assert.equal(variants[0].n, 42);
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
    const [{ left }] = await sql<Array<{ left: number }>>`SELECT count(*)::int AS left FROM models WHERE slug IN ${sql(newSlugs)}`;
    assert.equal(left, 0, 'constraint check must not commit');
  } finally { await sql.end(); }
});
