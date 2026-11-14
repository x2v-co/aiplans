import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  CATALOG_1114, CF_EMBEDDING_300M_SLUG, CF_EMBEDDING_PRICE, CF_EMBEDDING_SLUG,
  PARALLEL_OFFICIAL_PER_1K, PARALLEL_SLUG, PARALLEL_VERCEL_FREE_THROUGH,
  TOKEN_PASS_CREDIT_USD, TOKEN_PASS_FEE_USD, VERIFIED, ZONOS_PRICE, ZONOS_SLUG,
} from '../../src/lib/catalog-2026-11-14';
import {
  PRODUCTION_SHAPED_DRY_RUN, TOKEN_PASS_FEATURES, TOKEN_PASS_MODELS,
  catalog20261114IntelSeedOptions, seedCatalog20261114Intel, seedStepCounts,
} from './catalog-2026-11-14-intel';

test('seed options accept only --dry-run or --apply', () => {
  assert.deepEqual(catalog20261114IntelSeedOptions([]), { apply: false });
  assert.deepEqual(catalog20261114IntelSeedOptions(['--dry-run']), { apply: false });
  assert.deepEqual(catalog20261114IntelSeedOptions(['--apply']), { apply: true });
  assert.throws(() => catalog20261114IntelSeedOptions(['--apply', '--dry-run']));
  assert.throws(() => catalog20261114IntelSeedOptions(['--force']));
});

test('catalog rows match official 2026-11-14 pages', () => {
  assert.equal(VERIFIED, '2026-11-14');
  assert.equal(TOKEN_PASS_CREDIT_USD, 150);
  assert.equal(TOKEN_PASS_FEE_USD, 30);
  assert.ok(TOKEN_PASS_FEATURES[0].includes('$150'));
  assert.ok(TOKEN_PASS_FEATURES.some(line => line.includes('GLM 5.3 Flash')));
  assert.equal(TOKEN_PASS_MODELS.length, 5);
  assert.equal(CATALOG_1114.length, 5);
  const by = Object.fromEntries(CATALOG_1114.map(item => [item.slug, item]));

  const parallel = by[PARALLEL_SLUG]!;
  assert.equal(parallel.kind, 'decision-model');
  assert.equal(parallel.usageRates![0].price, PARALLEL_OFFICIAL_PER_1K);
  assert.equal(parallel.usageRates![0].unit, 'per_1k_requests');
  assert.ok(parallel.notes!.includes(PARALLEL_VERCEL_FREE_THROUGH));
  assert.ok(parallel.notes!.includes('Official docs name the product'));
  assert.deepEqual(parallel.inputModalities, ['text']);

  const embedding = by[CF_EMBEDDING_SLUG]!;
  assert.equal(embedding.kind, 'embedding-model');
  assert.equal(embedding.inputPricePer1M, CF_EMBEDDING_PRICE);
  assert.equal(embedding.contextWindow, 8192);
  assert.ok(embedding.notes!.includes('128, 256 or 512'));
  assert.deepEqual(embedding.inputModalities, ['text', 'image', 'audio', 'video']);

  const zonos = by[ZONOS_SLUG]!;
  assert.equal(zonos.kind, 'voice-model');
  assert.equal(zonos.usageRates![0].price, ZONOS_PRICE);
  assert.equal(zonos.usageRates![0].unit, 'per_1m_utf8_bytes');
  assert.equal(zonos.license, 'Apache-2.0');
  assert.equal(zonos.contextWindowLabel, '32K');

  const tts = by['deepseek-tts']!;
  assert.equal(tts.usageRates![0].price, 0.45);
  assert.ok(tts.notes!.includes('$0.225'));
  assert.ok(tts.notes!.includes('No promo end date'));
  assert.ok(tts.notes!.includes('Chinese character counts as 2'));
  assert.ok(tts.notes!.includes('3 元'));

  const asr = by['deepseek-asr']!;
  assert.equal(asr.usageRates![0].price, 0.116);
  assert.equal(asr.pricingUnit, 'per_hour');
  assert.ok(asr.notes!.includes('$0.058'));
  assert.ok(asr.notes!.includes('0.78 元'));
});

test('package.json registers the dry-run and apply scripts, not deploy', () => {
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.scripts['seed:catalog-2026-11-14-intel'], 'tsx scripts/seed-catalog-2026-11-14-intel.ts');
  assert.equal(pkg.scripts['seed:catalog-2026-11-14-intel:apply'], 'tsx scripts/seed-catalog-2026-11-14-intel.ts --apply');
  assert.ok(pkg.scripts['test:db'].includes('catalog-2026-11-14-intel-postgres.test.ts'));
  const deploy = JSON.stringify(pkg.scripts.deploy ?? '') + JSON.stringify(pkg.scripts['seed-catalog'] ?? '');
  assert.ok(!deploy.includes('2026-11-14-intel'));
});

type Row = Record<string, unknown> & { id: number };
function memory() {
  const data: Record<string, Row[]> = {
    providers: [], models: [], plans: [], model_plan_mapping: [], usage_prices: [], api_channel_prices: [],
  };
  let next = 1;
  const sql = Object.assign((first: TemplateStringsArray | unknown[], ...values: unknown[]) => {
    // postgres.sql(array) interpolates a list; it is synchronous and has no `.raw`.
    if (!Array.isArray(first) || !Object.prototype.hasOwnProperty.call(first, 'raw')) {
      return first;
    }
    const text = (first as TemplateStringsArray).join('?');
    if (text.includes('FROM providers WHERE slug IN')) {
      const slugs = new Set((values[0] as string[]) ?? []);
      return data.providers.filter(row => slugs.has(String(row.slug)));
    }
    if (text.includes('FROM models WHERE slug IN')) {
      const slugs = new Set((values[0] as string[]) ?? []);
      return data.models.filter(row => slugs.has(String(row.slug)));
    }
    if (text.includes('FROM usage_prices')) {
      return data.usage_prices.filter(row => row.model_id === values[0] && row.provider_id === values[1]);
    }
    if (text.includes('FROM api_channel_prices')) {
      return data.api_channel_prices.filter(row => row.model_id === values[0] && row.provider_id === values[1]);
    }
    if (text.includes('FROM plans WHERE provider_id')) {
      return data.plans.filter(row => row.provider_id === values[0] && row.slug === values[1]);
    }
    if (text.includes('FROM model_plan_mapping')) {
      return data.model_plan_mapping.filter(row => row.plan_id === values[0]);
    }
    throw new Error(`unexpected query: ${text}`);
  }, {
    json: (value: unknown) => value,
  });
  const insert = (table: string, row: Omit<Row, 'id'> & { id?: number }) => {
    const saved = { ...row, id: row.id ?? next++ } as Row;
    data[table].push(saved);
    return saved;
  };
  return { data, sql, insert };
}

function productionShaped(db: ReturnType<typeof memory>) {
  const vercel = db.insert('providers', { slug: 'vercel-ai-gateway', name: 'Vercel AI Gateway', type: 'aggregator' });
  const cloudflare = db.insert('providers', { slug: 'cloudflare', name: 'Cloudflare', type: 'official' });
  db.insert('providers', { slug: 'deepseek', name: 'DeepSeek', type: 'official' });
  const kimi = db.insert('models', { slug: 'kimi-k3', name: 'Kimi K3' });
  const glm = db.insert('models', { slug: 'glm-5.3', name: 'GLM 5.3' });
  db.insert('models', { slug: 'moonshotai-kimi-k3-1-pro', name: 'Kimi K3.1 Pro' });
  db.insert('models', { slug: 'glm-5.3-flash', name: 'GLM 5.3 Flash' });
  db.insert('models', { slug: 'deepseek-v4.1-flash', name: 'DeepSeek V4.1 Flash' });
  db.insert('models', {
    slug: CF_EMBEDDING_300M_SLUG, name: '@cf/google/embeddinggemma 300m',
    replacement_model: '@cf/google/embeddinggemma-2 (available soon)',
    description: 'Recommended replacement: @cf/google/embeddinggemma-2 (available soon).',
  });
  const plan = db.insert('plans', {
    provider_id: vercel.id, slug: 'vercel-token-pass', name: 'Token Pass',
    monthly_api_credit_usd: 80, has_overage_pricing: false, last_verified: new Date('2026-10-16T00:00:00Z'),
    features: ['$80 monthly credit for $30/month'], notes: 'old', model_selector: { only_extra: true, extra: ['kimi-k3', 'glm-5.3'] },
  });
  db.insert('model_plan_mapping', { model_id: kimi.id, plan_id: plan.id, source: 'manual' });
  db.insert('model_plan_mapping', { model_id: glm.id, plan_id: plan.id, source: 'manual' });
  return { vercel, cloudflare };
}

test('production-shaped dry-run matches the published shape', async () => {
  const db = memory();
  productionShaped(db);
  const first = await seedCatalog20261114Intel(db.sql as never, false);
  assert.deepEqual(seedStepCounts(first), PRODUCTION_SHAPED_DRY_RUN);
  assert.equal(first.filter(step => step.action === 'skip').length, 0);

});

test('seed skips Token Pass and owners that are missing rather than inventing them', async () => {
  const db = memory();
  const steps = await seedCatalog20261114Intel(db.sql as never, false);
  assert.ok(steps.some(step => step.action === 'skip' && step.target === 'vercel-token-pass'));
  assert.ok(steps.some(step => step.action === 'insert' && step.target === 'parallel'));
  assert.ok(steps.some(step => step.action === 'skip' && step.target === 'deepseek-tts'));
  assert.ok(steps.some(step => step.action === 'skip' && step.target === 'cloudflare-embeddinggemma-2'));
  assert.ok(steps.some(step => step.action === 'skip' && step.target === CF_EMBEDDING_300M_SLUG));
});
