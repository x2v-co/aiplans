import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { catalogForKind, AI_VERTICAL_CATALOG } from '../../src/lib/ai-vertical-catalog';
import { VOYAGE_EMBEDDINGS_1106 } from '../../src/lib/catalog-2026-11-06-embeddings';
import {
  VOYAGE_CATALOG_1126, VOYAGE_DOMAIN_EMBEDDINGS_1126, VOYAGE_MULTIMODAL_EMBEDDINGS_1126,
  VOYAGE_RERANKERS_1126, VOYAGE_PRICING_1126, VOYAGE_SEED_1126, RERANK_PROCESSED_TOKEN_FORMULA,
} from '../../src/lib/catalog-2026-11-26-voyage';
import { PRODUCTION_SHAPED_DRY_RUN, seedVoyage1126, seedStepCounts, voyageSeedOptions } from './catalog-2026-11-26-voyage';
import { fakeSeedTx } from './fake-seed-tx';
import { runRehearsable } from '../db/rehearsal';

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const voyage = { id: 42, slug: 'voyage', name: 'Voyage AI', type: 'official' };

test('Voyage CLI defaults to offline dry-run; explicit DB rehearsal also rolls back; deploy excludes it', () => {
  assert.deepEqual(voyageSeedOptions([]), { apply: false, db: false });
  assert.deepEqual(voyageSeedOptions(['--dry-run']), { apply: false, db: false });
  assert.deepEqual(voyageSeedOptions(['--db']), { apply: false, db: true });
  assert.deepEqual(voyageSeedOptions(['--apply']), { apply: true, db: true });
  for (const args of [['--dry-run', '--apply'], ['--force'], ['--apply=true']]) assert.throws(() => voyageSeedOptions(args), /Usage/);
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.scripts['seed:catalog-2026-11-26-voyage'], 'tsx scripts/seed-catalog-2026-11-26-voyage.ts');
  assert.equal(pkg.scripts[VOYAGE_SEED_1126], 'tsx scripts/seed-catalog-2026-11-26-voyage.ts --apply');
  assert.doesNotMatch(read('deploy/production/seed-catalog.sh'), /2026-11-26-voyage/);
  const cli = read('scripts/seed-catalog-2026-11-26-voyage.ts');
  assert.match(cli, /runRehearsable\(sql, apply, tx => seedVoyage1126\(tx as unknown as typeof sql, true\)\)/);
  assert.doesNotMatch(cli, /postgres-admin|dotenv|\.env\.local/);
  const result = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/seed-catalog-2026-11-26-voyage.ts'], {
    cwd: new URL('../../', import.meta.url), encoding: 'utf8', env: { ...process.env, DATABASE_URL: 'invalid-do-not-connect' },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /OFFLINE fakeSeedTx rehearsal/);
  assert.match(result.stdout, /NOT a production dry-run/);
  assert.match(result.stdout, /"usage_prices":\s*\{\s*"insert": 6,\s*"update": 0/);
});

test('six separate current-table identities cite the official page and 2026-11-26 without invented specifications', () => {
  assert.deepEqual(VOYAGE_CATALOG_1126.map(item => item.slug), [
    'voyage-finance-2', 'voyage-law-2', 'voyage-multimodal-3.5', 'voyage-multimodal-3', 'rerank-3', 'rerank-3-lite',
  ]);
  for (const item of VOYAGE_CATALOG_1126) {
    assert.equal(AI_VERTICAL_CATALOG.filter(row => row.slug === item.slug).length, 1);
    assert.equal(item.name, item.slug);
    assert.equal(item.provider, 'Voyage AI');
    assert.equal(item.providerSlug, 'voyage');
    assert.equal(item.currency, 'USD');
    assert.equal(item.url, VOYAGE_PRICING_1126);
    assert.equal(item.sourceUrls![0].url, VOYAGE_PRICING_1126);
    assert.equal(item.lastVerified, '2026-11-26');
    assert.equal(item.verifiedAt, '2026-11-26');
    assert.equal(item.deferredDbSeed, true);
    assert.equal(item.deferredDbSeedScript, VOYAGE_SEED_1126);
    assert.equal(item.contextWindow, undefined);
    assert.equal(item.contextWindowLabel, undefined);
    assert.equal(item.releasedAt, undefined);
    assert.equal(item.outputPricePer1M, undefined);
    assert.match(item.notes!, /33%/);
    assert.match(item.notes!, /free credits do not apply to Batch/);
    assert.doesNotMatch(item.notes!, /expires|90 days|30 days/i);
    assert.equal(item.usageRates!.some(rate => /batch|request/i.test(rate.priceKind)), false);
  }
});

test('finance and law are text embeddings with 50 million free tokens per account', () => {
  for (const item of VOYAGE_DOMAIN_EMBEDDINGS_1126) {
    assert.ok(catalogForKind('embedding-model').includes(item));
    assert.equal(item.modelCategory, 'embedding');
    assert.equal(item.pricing, '$0.12/M input tokens');
    assert.deepEqual(item.inputModalities, ['text']);
    assert.deepEqual(item.outputModalities, ['embedding']);
    assert.deepEqual(item.capabilities, ['text embedding']);
    assert.deepEqual(item.usageRates, [{ priceKind: 'text input', unit: 'per_1m_tokens', price: 0.12 }]);
    assert.match(item.notes!, /First 50 million tokens are free per account/);
    assert.doesNotMatch(item.notes!, /200|pixels|multimodal|rerank/i);
  }
});

test('both multimodal identities retain dual rates, free tokens/pixels, video and image billing bounds', () => {
  for (const item of VOYAGE_MULTIMODAL_EMBEDDINGS_1126) {
    assert.ok(catalogForKind('embedding-model').includes(item));
    assert.equal(item.modelCategory, 'embedding');
    assert.deepEqual(item.inputModalities, ['text', 'image', 'video']);
    assert.deepEqual(item.outputModalities, ['embedding']);
    assert.deepEqual(item.capabilities, ['multimodal embedding']);
    assert.equal(item.pricing, '$0.12/M text tokens + $0.60/billion pixels');
    assert.deepEqual(item.usageRates, [
      { priceKind: 'text input', unit: 'per_1m_tokens', price: 0.12 },
      { priceKind: 'image/video pixels', unit: 'per_1b_pixels', price: 0.6 },
    ]);
    for (const phrase of ['200M text tokens and 150B pixels are free per account', 'Each video frame is considered an image', '50,000 pixels', '2 million pixels', '$0.00003', '$0.0012']) {
      assert.ok(item.notes!.includes(phrase), phrase);
    }
    assert.doesNotMatch(item.notes!, /finance|law|rerank|50 million/i);
  }
});

test('rerankers have separate frontend kind, ranking output, exact processed-token formula and no billed request estimate', () => {
  assert.deepEqual(catalogForKind('rerank-model'), VOYAGE_RERANKERS_1126);
  assert.equal(RERANK_PROCESSED_TOKEN_FORMULA, '(the number of query tokens × the number of documents) + sum of the number of tokens in all documents');
  for (const [index, item] of VOYAGE_RERANKERS_1126.entries()) {
    assert.equal(catalogForKind('embedding-model').includes(item), false);
    assert.equal(item.modelCategory, 'text');
    assert.deepEqual(item.capabilities, ['rerank']);
    assert.deepEqual(item.inputModalities, ['text']);
    assert.deepEqual(item.outputModalities, ['ranking']);
    const price = index === 0 ? 0.05 : 0.02;
    assert.equal(item.pricing, `$${price.toFixed(2)}/M processed tokens`);
    assert.deepEqual(item.usageRates, [{ priceKind: 'processed tokens', price, unit: 'per_1m_tokens' }]);
    assert.ok(item.notes!.includes(`“${RERANK_PROCESSED_TOKEN_FORMULA}.”`));
    assert.match(item.notes!, /First 200 million tokens are free per account/);
    assert.match(item.notes!, /example only: 100 documents.*500 tokens/);
    assert.equal(item.inputPricePer1M, undefined, 'processed tokens are not ordinary input tokens');
  }
});

test('production-shaped expectation is exact with missing voyage; token rows preserve official pixel rate in constraints', async () => {
  const f = fakeSeedTx();
  assert.deepEqual(seedStepCounts(await seedVoyage1126(f.tx)), PRODUCTION_SHAPED_DRY_RUN);
  assert.equal(f.writes(), 0);
  assert.deepEqual(seedStepCounts(await seedVoyage1126(f.tx, true)), PRODUCTION_SHAPED_DRY_RUN);
  assert.equal(f.writes(), 13);
  assert.equal(f.data.providers.length, 1);
  assert.equal(f.data.providers[0].slug, 'voyage');
  assert.equal(f.data.api_channel_prices.length, 0);
  assert.equal(f.data.usage_prices.length, 6);
  for (const item of VOYAGE_CATALOG_1126) {
    const model = f.data.models.find(row => row.slug === item.slug)!;
    assert.equal(model.model_category, item.modelCategory);
    assert.deepEqual(model.output_modalities, item.outputModalities);
    assert.deepEqual(model.provider_ids, [f.data.providers[0].id]);
    const rates = f.data.usage_prices.filter(row => row.model_id === model.id);
    assert.equal(rates.length, 1);
    assert.equal(rates[0].unit, 'per_1m_tokens');
    assert.equal(rates[0].price, item.usageRates![0].price);
    assert.equal(rates[0].source_url, VOYAGE_PRICING_1126);
    assert.equal(rates[0].currency, 'USD');
    assert.deepEqual(rates[0].last_verified, new Date('2026-11-26T00:00:00Z'));
    assert.deepEqual(rates[0].constraints_json, {
      publishedPricingText: item.pricing, note: item.notes,
      catalogOnlyRates: item.usageRates!.filter(rate => rate.unit !== 'per_1m_tokens'),
    });
  }
  assert.deepEqual(await seedVoyage1126(f.tx, true), []);
  assert.equal(f.writes(), 13, 'idempotent second run writes nothing');
});

test('existing voyage is reused and all five #337 Voyage 4 models and prices remain untouched', async () => {
  assert.deepEqual(VOYAGE_EMBEDDINGS_1106.map(item => [item.slug, item.inputPricePer1M]), [
    ['voyage-4-large', 0.12], ['voyage-4', 0.06], ['voyage-4-lite', 0.02], ['voyage-context-4', 0.12], ['voyage-code-4', 0.12],
  ]);
  const models = VOYAGE_EMBEDDINGS_1106.map((item, index) => ({ id: index + 1, slug: item.slug, name: item.name }));
  const usage = models.map((model, index) => ({ id: index + 1, model_id: model.id, provider_id: voyage.id, price: VOYAGE_EMBEDDINGS_1106[index].inputPricePer1M }));
  const f = fakeSeedTx({ providers: [voyage], models, usage_prices: usage });
  const counts = seedStepCounts(await seedVoyage1126(f.tx, true));
  assert.deepEqual(counts, { ...PRODUCTION_SHAPED_DRY_RUN, providers: { insert: 0, update: 0 } });
  assert.deepEqual(f.data.providers, [voyage]);
  assert.deepEqual(f.data.models.slice(0, 5), models);
  assert.deepEqual(f.data.usage_prices.slice(0, 5), usage);
});

test('fakeSeedTx rehearsal executes writes then rolls back; errors are not swallowed', async () => {
  const f = fakeSeedTx();
  const before = structuredClone(f.data);
  const log: string[] = [];
  const sql = { async begin(isolation: string, work: (tx: typeof f.tx) => Promise<unknown>) {
    assert.equal(isolation, 'isolation level serializable');
    log.push('BEGIN');
    try { await work(f.tx); log.push('COMMIT'); }
    catch (error) { Object.assign(f.data, structuredClone(before)); log.push('ROLLBACK'); throw error; }
  } };
  const steps = await runRehearsable(sql, false, tx => seedVoyage1126(tx, true));
  assert.deepEqual(seedStepCounts(steps), PRODUCTION_SHAPED_DRY_RUN);
  assert.equal(f.writes(), 13, 'the default rehearsal must exercise write code');
  assert.deepEqual(f.data, before);
  assert.deepEqual(log, ['BEGIN', 'ROLLBACK']);
  await assert.rejects(runRehearsable(sql, false, async () => { throw new Error('constraint failure'); }), /constraint failure/);
});

test('ambiguous models/providers/prices and non-official voyage abort before writes', async () => {
  for (const initial of [
    { providers: [voyage, { ...voyage, id: 43 }] },
    { providers: [{ ...voyage, type: 'aggregator' }] },
    { providers: [voyage], models: [{ id: 1, slug: 'rerank-3' }, { id: 2, slug: 'rerank-3' }] },
    { providers: [voyage], models: [{ id: 1, slug: 'rerank-3' }], usage_prices: [
      { id: 1, model_id: 1, provider_id: voyage.id, price_kind: 'processed tokens', unit: 'per_1m_tokens' },
      { id: 2, model_id: 1, provider_id: voyage.id, price_kind: 'processed tokens', unit: 'per_1m_tokens' },
    ] },
  ]) {
    const f = fakeSeedTx(initial);
    await assert.rejects(seedVoyage1126(f.tx, true), /Ambiguous|Unexpected/);
    assert.equal(f.writes(), 0);
  }
});
