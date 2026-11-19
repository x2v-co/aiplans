import assert from 'node:assert/strict';
import test from 'node:test';
import type { Sql } from 'postgres';
import {
  PRODUCTION_SHAPED_DRY_RUN, QWEN35_MODELS, seedCatalog20261115Intel, seedStepCounts,
} from '../data/catalog-2026-11-15-intel';

const localUrl = process.env.ARGON_TEST_DATABASE_URL;
const slugs = QWEN35_MODELS.map(spec => spec.slug);

test('11-15 intel seed satisfies Postgres constraints, re-runs to 0, and rolls back', { skip: !localUrl }, async () => {
  assert.ok(localUrl);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(localUrl).hostname));
  const { default: postgres } = await import('postgres');
  const sql = postgres(localUrl, { max: 1, onnotice: () => {} });
  try {
    const [{ n }] = await sql<Array<{ n: number }>>`SELECT count(*)::int AS n FROM models WHERE slug IN ${sql(slugs)}`;
    assert.equal(n, 0, 'loopback DB should not already contain these models');
    const run = () => sql.begin('isolation level serializable', async raw => {
      const tx = raw as unknown as Sql;
      const provider = async (slug: string, name: string, type: string) => {
        const existing = (await tx<Array<{ id: number }>>`SELECT id FROM providers WHERE slug = ${slug}`)[0];
        if (existing) return existing.id;
        return (await tx<Array<{ id: number }>>`INSERT INTO ${tx('providers')} ${tx({ slug, name, type })} RETURNING id`)[0].id;
      };
      const qwenId = await provider('qwen', 'Qwen', 'official');
      const openrouterId = await provider('openrouter', 'OpenRouter', 'aggregator');
      const ids: Record<string, number> = {};
      for (const spec of QWEN35_MODELS) {
        ids[spec.slug] = (await tx<Array<{ id: number }>>`INSERT INTO ${tx('models')} ${tx({
          slug: spec.slug, name: spec.apiId, type: 'llm', model_category: 'text',
        })} RETURNING id`)[0].id;
      }
      const channel = (model: string, providerId: number) => tx`INSERT INTO ${tx('api_channel_prices')} ${tx({
        model_id: ids[model], provider_id: providerId, input_price_per_1m: 1, output_price_per_1m: 2,
        currency: 'CNY', price_unit: 'per_1m_tokens', last_verified: new Date('2026-11-14T00:00:00Z'),
      })}`;
      await channel('qwen3.5-plus', qwenId);
      await channel('qwen-qwen3-5-plus-02-15', openrouterId);
      await channel('qwen-qwen3-5-plus-20260420', openrouterId);
      await channel('qwen3.5-397b-a17b', qwenId);
      await channel('qwen3.5-397b-a17b', openrouterId);

      const applied = await seedCatalog20261115Intel(tx, true);
      assert.deepEqual(seedStepCounts(applied), PRODUCTION_SHAPED_DRY_RUN);
      assert.deepEqual(await seedCatalog20261115Intel(tx, false), [], 'second dry-run after apply is empty');
      const rows = await tx<Array<{ slug: string; shutdown_date: string | Date | null; replacement_model: string | null }>>`
        SELECT slug, shutdown_date::text AS shutdown_date, replacement_model FROM models WHERE slug IN ${tx(slugs)} ORDER BY slug`;
      const by = Object.fromEntries(rows.map(row => [row.slug, row]));
      for (const slug of ['qwen3.5-plus', 'qwen-qwen3-5-plus-02-15', 'qwen-qwen3-5-plus-20260420']) {
        assert.equal(by[slug].shutdown_date, '2027-01-19');
        assert.equal(by[slug].replacement_model, 'qwen3.8-flash');
      }
      assert.equal(by['qwen3.5-397b-a17b'].shutdown_date, null);
      const [note] = await tx<Array<{ notes: string }>>`SELECT notes FROM api_channel_prices WHERE model_id = ${ids['qwen3.5-397b-a17b']} AND provider_id = ${qwenId}`;
      assert.match(note.notes, /2027-01-19 10:00 Beijing time/);
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
