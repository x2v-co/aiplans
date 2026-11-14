import assert from 'node:assert/strict';
import test from 'node:test';
import type { Sql } from 'postgres';
import { CATALOG_1114, CF_EMBEDDING_300M_SLUG, CF_EMBEDDING_PRICE, TOKEN_PASS_CREDIT_USD } from '../../src/lib/catalog-2026-11-14';
import {
  PRODUCTION_SHAPED_DRY_RUN, TOKEN_PASS_MODELS, seedCatalog20261114Intel, seedStepCounts,
} from '../data/catalog-2026-11-14-intel';

const localUrl = process.env.ARGON_TEST_DATABASE_URL;
const newSlugs = CATALOG_1114.map(item => item.slug!);

test('11-14 intel seed satisfies Postgres constraints, re-runs to 0, and rolls back', { skip: !localUrl }, async () => {
  assert.ok(localUrl);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(localUrl).hostname));
  const { default: postgres } = await import('postgres');
  const sql = postgres(localUrl, { max: 1, onnotice: () => {} });
  try {
    const [{ n }] = await sql<Array<{ n: number }>>`SELECT count(*)::int AS n FROM models WHERE slug IN ${sql(newSlugs)}`;
    assert.equal(n, 0, 'loopback DB should not already contain these models');
    const run = () => sql.begin('isolation level serializable', async raw => {
      const tx = raw as unknown as Sql;
      const ensureProvider = async (row: Record<string, unknown>) => {
        const existing = (await tx<Array<{ id: number }>>`SELECT id FROM providers WHERE slug = ${row.slug as string}`)[0];
        if (existing) return existing.id;
        return (await tx<Array<{ id: number }>>`INSERT INTO ${tx('providers')} ${tx(row)} RETURNING id`)[0].id;
      };
      const ensureModel = async (slug: string, name: string, extra: Record<string, unknown> = {}) => {
        const existing = (await tx<Array<{ id: number }>>`SELECT id FROM models WHERE slug = ${slug}`)[0];
        if (existing) return existing.id;
        return (await tx<Array<{ id: number }>>`INSERT INTO ${tx('models')} ${tx({
          slug, name, type: 'llm', model_category: 'text', ...extra,
        })} RETURNING id`)[0].id;
      };
      const vercelId = await ensureProvider({ slug: 'vercel-ai-gateway', name: 'Vercel AI Gateway', type: 'aggregator' });
      await ensureProvider({ slug: 'cloudflare', name: 'Cloudflare', type: 'official' });
      await ensureProvider({ slug: 'deepseek', name: 'DeepSeek', type: 'official' });
      const slugs = Object.fromEntries(await Promise.all(TOKEN_PASS_MODELS.map(async model => {
        const slug = model.slugs[0];
        const id = await ensureModel(slug, model.name);
        return [slug, id] as const;
      })));
      // Official production slugs for the three already-mapped / lookup targets.
      if (!slugs['kimi-k3']) slugs['kimi-k3'] = await ensureModel('kimi-k3', 'Kimi K3');
      await ensureModel('kimi-k3', 'Kimi K3');
      await ensureModel('glm-5.3', 'GLM 5.3');
      await ensureModel('moonshotai-kimi-k3-1-pro', 'Kimi K3.1 Pro');
      await ensureModel('glm-5.3-flash', 'GLM 5.3 Flash');
      await ensureModel('deepseek-v4.1-flash', 'DeepSeek V4.1 Flash');
      await ensureModel(CF_EMBEDDING_300M_SLUG, '@cf/google/embeddinggemma 300m', {
        model_category: 'embedding',
        replacement_model: '@cf/google/embeddinggemma-2 (available soon)',
        description: 'Workers AI id @cf/google/embeddinggemma-300m. Recommended replacement: @cf/google/embeddinggemma-2 (available soon).',
      });
      const planId = (await tx<Array<{ id: number }>>`
        INSERT INTO ${tx('plans')} ${tx({
          provider_id: vercelId, product_id: vercelId, name: 'Token Pass', slug: 'vercel-token-pass',
          price: 30, currency: 'USD', pricing_model: 'subscription', price_unit: 'per_month',
          plan_kind: 'gateway_subscription', plan_category: 'api', is_official: true,
          monthly_api_credit_usd: 80, has_overage_pricing: false, last_verified: new Date('2026-10-16T00:00:00Z'),
        })} RETURNING id`)[0].id;
      const kimiId = (await tx<Array<{ id: number }>>`SELECT id FROM models WHERE slug = 'kimi-k3'`)[0].id;
      const glmId = (await tx<Array<{ id: number }>>`SELECT id FROM models WHERE slug = 'glm-5.3'`)[0].id;
      await tx`INSERT INTO model_plan_mapping ${tx({ model_id: kimiId, plan_id: planId, source: 'manual' })}`;
      await tx`INSERT INTO model_plan_mapping ${tx({ model_id: glmId, plan_id: planId, source: 'manual' })}`;

      const applied = await seedCatalog20261114Intel(tx, true);
      assert.deepEqual(seedStepCounts(applied), PRODUCTION_SHAPED_DRY_RUN);
      assert.deepEqual(
        (await seedCatalog20261114Intel(tx, false)).filter(step => step.action !== 'skip'),
        [],
        'second dry-run after apply is empty',
      );

      const credit = (await tx<Array<{ monthly_api_credit_usd: number }>>`SELECT monthly_api_credit_usd FROM plans WHERE id = ${planId}`)[0];
      assert.equal(Number(credit.monthly_api_credit_usd), TOKEN_PASS_CREDIT_USD);
      const mapped = (await tx<Array<{ n: number }>>`SELECT count(*)::int AS n FROM model_plan_mapping WHERE plan_id = ${planId}`)[0];
      assert.equal(mapped.n, 5);
      const gemma = (await tx<Array<{ replacement_model: string }>>`SELECT replacement_model FROM models WHERE slug = ${CF_EMBEDDING_300M_SLUG}`)[0];
      assert.equal(gemma.replacement_model, '@cf/google/embeddinggemma-2');
      const prices = await tx<Array<{ n: number }>>`
        SELECT count(*)::int AS n FROM api_channel_prices c JOIN models m ON m.id = c.model_id
         WHERE m.slug = 'cloudflare-embeddinggemma-2'`;
      assert.equal(prices[0].n, 1);
      const usage = await tx<Array<{ n: number }>>`
        SELECT count(*)::int AS n FROM usage_prices u JOIN models m ON m.id = u.model_id
         WHERE m.slug IN ${tx(newSlugs)}`;
      assert.equal(usage[0].n, 5);
      const channel = (await tx<Array<{ input_price_per_1m: number }>>`
        SELECT c.input_price_per_1m FROM api_channel_prices c JOIN models m ON m.id = c.model_id
         WHERE m.slug = 'cloudflare-embeddinggemma-2'`)[0];
      assert.equal(Number(channel.input_price_per_1m), CF_EMBEDDING_PRICE);
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
