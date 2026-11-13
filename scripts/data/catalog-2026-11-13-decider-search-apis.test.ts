import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { catalogForKind } from '../../src/lib/ai-vertical-catalog';
import {
  DECIDER_FLASH_V13, DECIDER_V13, PPLX_PRICING, PERPLEXITY_DECIDER_V13_CATALOG,
} from '../../src/lib/decision-models-2026-11-13';
import { isOpenRouterPublishedFree, isVerifiedFreeOutput, isVerifiedFreePrice } from '../utils/audit-price-policy';
import {
  PRODUCTION_SHAPED_DRY_RUN, catalog20261113DeciderSearchApisSeedOptions,
  seedCatalog20261113DeciderSearchApis, seedStepCounts,
} from './catalog-2026-11-13-decider-search-apis';
import { fakeSeedTx } from './fake-seed-tx';

const perplexity = { id: 4, slug: 'perplexity', name: 'Perplexity', type: 'official' };
const vercel = { id: 8, slug: 'vercel-ai-gateway', name: 'Vercel AI Gateway', type: 'aggregator' };
const openrouter = { id: 9, slug: 'openrouter', name: 'OpenRouter', type: 'aggregator' };
const productionShaped = () => fakeSeedTx({ providers: [perplexity, vercel, openrouter], models: [] });

test('CLI defaults to dry-run, :apply is separate, and the seed is not in deploy', () => {
  assert.equal(catalog20261113DeciderSearchApisSeedOptions([]).apply, false);
  assert.equal(catalog20261113DeciderSearchApisSeedOptions(['--dry-run']).apply, false);
  assert.equal(catalog20261113DeciderSearchApisSeedOptions(['--apply']).apply, true);
  for (const args of [['--apply', '--dry-run'], ['--force'], ['--apply=true']]) {
    assert.throws(() => catalog20261113DeciderSearchApisSeedOptions(args), /Usage/);
  }
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.scripts['seed:catalog-2026-11-13-decider-search-apis'], 'tsx scripts/seed-catalog-2026-11-13-decider-search-apis.ts');
  assert.equal(pkg.scripts['seed:catalog-2026-11-13-decider-search-apis:apply'], 'tsx scripts/seed-catalog-2026-11-13-decider-search-apis.ts --apply');
  const deploy = readFileSync(new URL('../../deploy/production/seed-catalog.sh', import.meta.url), 'utf8');
  assert.doesNotMatch(deploy, /2026-11-13-decider-search-apis/);
});

test('official v1.3 catalog rates, aliases and sources match the cited pages', () => {
  const items = catalogForKind('decision-model').filter(item => item.slug?.includes('decider-v1-3') || item.slug?.includes('decider-flash-v1-3'));
  assert.equal(items.length, 2);
  assert.deepEqual(items.map(item => item.slug), PERPLEXITY_DECIDER_V13_CATALOG.map(item => item.slug));
  const v13 = items.find(item => item.slug === DECIDER_V13.slug)!;
  const flash = items.find(item => item.slug === DECIDER_FLASH_V13.slug)!;
  assert.equal(v13.inputPricePer1M, 0.02);
  assert.equal(flash.inputPricePer1M, 0.01);
  for (const item of [v13, flash]) {
    assert.equal(item.providerSlug, 'perplexity');
    assert.equal(item.outputPricePer1M, 0);
    assert.equal(item.contextWindow, 262_144);
    assert.equal(item.license, 'Apache-2.0');
    assert.equal(item.url, PPLX_PRICING);
    assert.equal(item.deferredDbSeedScript, 'seed:catalog-2026-11-13-decider-search-apis:apply');
    assert.match(item.notes!, /256K/);
    assert.match(item.notes!, /262,144/);
    assert.match(item.notes!, /:free/);
    assert.deepEqual(item.inputModalities, ['text', 'image']);
  }
  assert.match(v13.notes!, /pplx-decider-latest/);
  assert.match(flash.notes!, /pplx-decider-flash-latest/);
});

test('verified free-output exemption covers official and Vercel v1.3 rates', () => {
  for (const channel of ['perplexity', 'vercel-ai-gateway', 'vercel']) {
    assert.equal(isVerifiedFreeOutput(DECIDER_V13.slug, channel, 0.02), true);
    assert.equal(isVerifiedFreeOutput(DECIDER_FLASH_V13.slug, channel, 0.01), true);
    assert.equal(isVerifiedFreeOutput(DECIDER_V13.slug, channel, 0), false);
  }
  assert.equal(isVerifiedFreeOutput(DECIDER_V13.slug, 'openrouter', 0.02), false);
  assert.equal(isVerifiedFreePrice(DECIDER_V13.slug, 'perplexity'), false);
  assert.equal(isOpenRouterPublishedFree('openrouter', 0, 0), true);
});

test('production-shaped dry-run inserts two models and six channels, then re-runs empty', async () => {
  const { tx, data, writes } = productionShaped();
  const steps = await seedCatalog20261113DeciderSearchApis(tx, false);
  assert.deepEqual(seedStepCounts(steps), PRODUCTION_SHAPED_DRY_RUN);
  assert.equal(writes(), 0);

  const applied = await seedCatalog20261113DeciderSearchApis(tx, true);
  assert.deepEqual(seedStepCounts(applied), PRODUCTION_SHAPED_DRY_RUN);
  assert.deepEqual(
    (await seedCatalog20261113DeciderSearchApis(tx, false)).filter(step => step.action !== 'skip'),
    [],
    'second dry-run after apply is empty except skips',
  );
  const bySlug = Object.fromEntries(data.models.map(row => [row.slug, row]));
  assert.equal(bySlug[DECIDER_V13.slug].parameters, '27B');
  assert.equal(bySlug[DECIDER_FLASH_V13.slug].parameters, '4B');
  assert.equal(bySlug[DECIDER_V13.slug].max_output_tokens, 0);
  const prices = data.api_channel_prices;
  assert.equal(prices.length, 6);
  const official = prices.find(row => row.provider_id === 4 && row.model_id === bySlug[DECIDER_V13.slug].id)!;
  const free = prices.find(row => row.provider_id === 9 && row.model_id === bySlug[DECIDER_V13.slug].id)!;
  assert.equal(official.input_price_per_1m, 0.02);
  assert.equal(official.output_price_per_1m, 0);
  assert.equal(free.input_price_per_1m, 0);
  assert.equal(free.output_price_per_1m, 0);
});

test('two lookup slugs or a non-official perplexity type abort with nothing written', async () => {
  const clash = fakeSeedTx({
    providers: [perplexity, vercel, openrouter],
    models: [
      { id: 21, slug: 'perplexity-pplx-decider-v1-3', name: 'a', type: 'llm', provider_ids: [4] },
      { id: 22, slug: 'pplx-decider-v1.3', name: 'b', type: 'llm', provider_ids: [4] },
    ],
  });
  await assert.rejects(() => seedCatalog20261113DeciderSearchApis(clash.tx, true), /Ambiguous/);
  assert.equal(clash.writes(), 0);

  const wrong = fakeSeedTx({
    providers: [{ id: 4, slug: 'perplexity', type: 'aggregator' }, vercel, openrouter],
    models: [],
  });
  await assert.rejects(() => seedCatalog20261113DeciderSearchApis(wrong.tx, true), /has type aggregator/);
  assert.equal(wrong.writes(), 0);
});
