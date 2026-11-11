import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { ANNOUNCED_DESCRIPTION_PATTERN } from '../../src/lib/model-announcement';
import { ARGON_PROMO_ENDS_AT } from './gemini-4-argon';
import { CARBON_PROMO_ENDS_AT, CARBON_SLUG, carbonModelRow } from './gemini-4-carbon';
import {
  CARBON_BATCH_INTRO, CARBON_BATCH_REGULAR, CARBON_BATCH_SLUG, ERNIE_CN, ERNIE_CONTEXT, ERNIE_INTL, ERNIE_SLUG,
  PRODUCTION_SHAPED_DRY_RUN, VERIFIED_AT, catalog20261111CarbonErnieSeedOptions, seedCatalog20261111CarbonErnie, seedStepCounts,
} from './catalog-2026-11-11-carbon-ernie';
import { fakeSeedTx, type FakeRow } from './fake-seed-tx';
import { checkModelIdentity } from '../utils/model-identity-guard';
import { generateOpenRouterSlug } from '../scrapers/openrouter';

const google = { id: 1, slug: 'google', name: 'Google', type: 'producer' };
const vertex = { id: 2, slug: 'vertex-ai', name: 'Google Vertex AI', type: 'cloud' };
const openrouter = { id: 3, slug: 'openrouter', name: 'OpenRouter', type: 'aggregator' };
const vercel = { id: 4, slug: 'vercel-ai-gateway', name: 'Vercel AI Gateway', type: 'aggregator' };
const baidu = { id: 5, slug: 'baidu', name: '百度 (ERNIE)', type: 'official' };
const carbon = {
  id: 10, slug: CARBON_SLUG, name: 'Gemini 4 Carbon', type: 'llm', provider_ids: [1],
  description: 'Status: announced.\nAnnounced; developer API not yet available. Access is limited to cyber defenders and trusted partners through the Fairwind Program.',
  context_window: null,
};
const googleChannel = {
  id: 20, model_id: 10, provider_id: 1, input_price_per_1m: 2, output_price_per_1m: 10, cached_input_price_per_1m: 0.1,
  currency: 'USD', price_unit: 'per_1m_tokens', is_available: false, availability_locked: true, promo_ends_at: null,
  regular_input_price_per_1m: null, regular_output_price_per_1m: null, regular_cached_input_price_per_1m: null,
  last_verified: new Date('2026-10-29T00:00:00Z'), notes: 'reference only',
};
const vertexChannel = {
  id: 21, model_id: 10, provider_id: 2, input_price_per_1m: 2, output_price_per_1m: 10, cached_input_price_per_1m: null,
  currency: 'USD', price_unit: 'per_1m_tokens', is_available: true, promo_ends_at: null,
  last_verified: new Date('2026-10-29T00:00:00Z'), notes: 'Vertex $2/$10',
};

function shaped(extra: { providers?: FakeRow[]; models?: FakeRow[]; api_channel_prices?: FakeRow[] } = {}) {
  return fakeSeedTx({
    providers: extra.providers ?? [google, vertex, openrouter, vercel, baidu],
    models: extra.models ?? [carbon, { id: 99, slug: 'gemini-4-argon', name: 'Gemini 4 Argon', provider_ids: [1] }],
    api_channel_prices: extra.api_channel_prices ?? [googleChannel, vertexChannel],
  });
}

test('CLI defaults to dry-run, :apply is separate, and rehearsal is the write path', () => {
  assert.equal(catalog20261111CarbonErnieSeedOptions([]).apply, false);
  assert.equal(catalog20261111CarbonErnieSeedOptions(['--dry-run']).apply, false);
  assert.equal(catalog20261111CarbonErnieSeedOptions(['--apply']).apply, true);
  for (const args of [['--force'], ['--dry-run', '--apply']]) assert.throws(() => catalog20261111CarbonErnieSeedOptions(args), /Usage/);
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { scripts: Record<string, string> };
  assert.equal(pkg.scripts['seed:catalog-2026-11-11-carbon-ernie'], 'tsx scripts/seed-catalog-2026-11-11-carbon-ernie.ts');
  assert.equal(pkg.scripts['seed:catalog-2026-11-11-carbon-ernie:apply'], 'tsx scripts/seed-catalog-2026-11-11-carbon-ernie.ts --apply');
  const cli = readFileSync(new URL('../seed-catalog-2026-11-11-carbon-ernie.ts', import.meta.url), 'utf8');
  assert.match(cli, /runRehearsable/);
  assert.doesNotMatch(cli, /READ ONLY/);
  for (const file of ['../../deploy/production/rollout.sh', '../../deploy/production/seed-catalog.sh', '../../.github/workflows/deploy-production.yml', '../../.github/workflows/seed-catalog.yml']) {
    assert.doesNotMatch(readFileSync(new URL(file, import.meta.url), 'utf8'), /2026-11-11-carbon-ernie/);
  }
});

test('published prices, slugs and the unpublished CN promo end match the cited pages', () => {
  assert.equal(generateOpenRouterSlug('google/gemini-4-carbon'), CARBON_SLUG);
  assert.equal(generateOpenRouterSlug('google/gemini-4-carbon:batch'), CARBON_BATCH_SLUG);
  assert.equal(generateOpenRouterSlug('baidu/ernie-5.5-flash-preview'), ERNIE_SLUG);
  assert.equal(CARBON_PROMO_ENDS_AT, ARGON_PROMO_ENDS_AT);
  assert.equal(ERNIE_CONTEXT, 1_024_000);
  assert.deepEqual([ERNIE_CN.peak.promo.input, ERNIE_CN.peak.promo.output, ERNIE_CN.peak.promo.cache], [1, 4, 0.1]);
  assert.deepEqual([ERNIE_CN.peak.list.input, ERNIE_CN.idle.promo.input, ERNIE_CN.idle.list.cache], [2, 0.5, 0.1]);
  assert.deepEqual([ERNIE_INTL.input, ERNIE_INTL.output, ERNIE_INTL.cache], [0.28, 1.13, 0.028]);
  assert.deepEqual([CARBON_BATCH_INTRO.input, CARBON_BATCH_REGULAR.output, CARBON_BATCH_REGULAR.cache], [1, 10, 0.1]);
  assert.equal(new RegExp(ANNOUNCED_DESCRIPTION_PATTERN).test(carbonModelRow(1).description), false);
  assert.equal(checkModelIdentity('Gemini 4 Carbon', CARBON_SLUG).ok, true);
  assert.equal(checkModelIdentity('Gemini 4 Carbon (batch)', CARBON_BATCH_SLUG).ok, true);
  assert.equal(checkModelIdentity('ERNIE-5.5-Flash-Preview', ERNIE_SLUG).ok, true);
  const source = readFileSync(new URL('./catalog-2026-11-11-carbon-ernie.ts', import.meta.url), 'utf8');
  assert.match(source, /Seedream 5\.5 is not seeded/);
  assert.doesNotMatch(source, /slug: 'seedream/);
  assert.match(source, /promo_ends_at and regular_\* are NULL/);
});

test('production-shaped dry-run previews the Carbon unlock, channels and ERNIE without writing', async () => {
  const f = shaped();
  const before = structuredClone(f.data);
  const steps = await seedCatalog20261111CarbonErnie(f.tx);
  assert.deepEqual(seedStepCounts(steps), PRODUCTION_SHAPED_DRY_RUN);
  assert.equal(f.writes(), 0);
  assert.deepEqual(f.data, before);
  const googleStep = steps.find(step => step.target === `google/${CARBON_SLUG}`)!;
  assert.equal(googleStep.action, 'update');
  assert.equal(googleStep.changes.is_available.to, true);
  assert.equal(googleStep.changes.availability_locked.to, false);
  assert.equal(googleStep.changes.promo_ends_at.to, ARGON_PROMO_ENDS_AT);
  assert.equal(googleStep.changes.regular_input_price_per_1m.to, 4);
  const vertexStep = steps.find(step => step.target === `vertex-ai/${CARBON_SLUG}`)!;
  assert.equal(vertexStep.changes.promo_ends_at.to, ARGON_PROMO_ENDS_AT);
  assert.equal(vertexStep.changes.cached_input_price_per_1m.to, 0.1);
  assert.equal(vertexStep.changes.regular_output_price_per_1m.to, 20);
  const model = steps.find(step => step.table === 'models' && step.target === CARBON_SLUG)!;
  assert.equal(model.action, 'update');
  assert.match(String(model.changes.description.to), /^Status: available\./);
  assert.equal(steps.find(step => step.target === `baidu/${ERNIE_SLUG}`)!.changes.currency.to, 'CNY');
  assert.equal(steps.find(step => step.target === `baidu/${ERNIE_SLUG}`)!.changes.promo_ends_at.to, null);
  assert.equal(steps.find(step => step.target === `baidu-global/${ERNIE_SLUG}`)!.changes.input_price_per_1m.to, 0.28);
  assert.equal(steps.find(step => step.target === `openrouter/${CARBON_BATCH_SLUG}`)!.changes.input_price_per_1m.to, 1);
  const peak = steps.find(step => step.target === `baidu/${ERNIE_SLUG}/peak`)!;
  assert.equal(peak.changes.is_headline.to, true);
  assert.equal((peak.changes.constraints_json.to as { list_input_price_per_1m: number }).list_input_price_per_1m, 2);
  assert.equal((peak.changes.constraints_json.to as { promo_end_published: boolean }).promo_end_published, false);
});

test('apply then a second dry-run is empty, and a newer Vertex verification is kept', async () => {
  const f = shaped();
  const argon = structuredClone(f.data.models.find(row => row.slug === 'gemini-4-argon')!);
  assert.equal((await seedCatalog20261111CarbonErnie(f.tx, true)).length, 14);
  assert.deepEqual(await seedCatalog20261111CarbonErnie(f.tx), []);
  assert.deepEqual(f.data.models.find(row => row.slug === 'gemini-4-argon'), argon);
  const googleRow = f.data.api_channel_prices.find(row => row.id === 20)!;
  assert.equal(googleRow.is_available, true);
  assert.equal(googleRow.availability_locked, false);
  assert.equal(googleRow.promo_ends_at, ARGON_PROMO_ENDS_AT);
  const ernie = f.data.models.find(row => row.slug === ERNIE_SLUG)!;
  assert.equal(ernie.context_window, ERNIE_CONTEXT);
  assert.equal(ernie.max_output_tokens, null);
  assert.equal(ernie.parameters, null);
  const cn = f.data.api_channel_prices.find(row => row.model_id === ernie.id && row.provider_id === 5)!;
  assert.equal(cn.currency, 'CNY');
  assert.equal(cn.promo_ends_at, null);
  assert.equal(cn.regular_input_price_per_1m, null);
  assert.deepEqual([cn.input_price_per_1m, cn.output_price_per_1m, cn.cached_input_price_per_1m], [1, 4, 0.1]);
  const variants = f.data.api_channel_price_variants.filter(row => row.model_id === ernie.id);
  assert.equal(variants.length, 2);
  assert.equal(variants.find(row => row.variant_key === 'idle')!.input_price_per_1m, 0.5);
  assert.equal(f.data.api_channel_prices.find(row => row.model_id === ernie.id && row.currency === 'USD' && row.provider_id !== 3)!.cached_input_price_per_1m, 0.028);
  const batch = f.data.models.find(row => row.slug === CARBON_BATCH_SLUG)!;
  assert.equal(batch.context_window, null);
  assert.equal(f.data.api_channel_prices.filter(row => row.model_id === batch.id).length, 1);

  Object.assign(f.data.api_channel_prices.find(row => row.id === 21)!, {
    input_price_per_1m: 9, output_price_per_1m: 10, cached_input_price_per_1m: null,
    promo_ends_at: null, regular_input_price_per_1m: null, last_verified: new Date('2026-11-11T18:00:00Z'), notes: 'Newer scrape',
  });
  const kept = structuredClone(f.data.api_channel_prices.find(row => row.id === 21)!);
  await seedCatalog20261111CarbonErnie(f.tx, true);
  assert.deepEqual(f.data.api_channel_prices.find(row => row.id === 21), kept);
  assert.ok(new Date(String(kept.last_verified)).getTime() > VERIFIED_AT.getTime());
});

test('the October Carbon lock is cleared and a later lock on another channel stays off', async () => {
  const f = shaped();
  await seedCatalog20261111CarbonErnie(f.tx, true);
  assert.equal(f.data.api_channel_prices.find(row => row.id === 20)!.is_available, true);
  const or = f.data.api_channel_prices.find(row => row.provider_id === 3 && row.input_price_per_1m === ERNIE_INTL.input)!;
  Object.assign(or, { is_available: false, availability_locked: true, last_verified: new Date('2026-11-01T00:00:00Z') });
  await seedCatalog20261111CarbonErnie(f.tx, true);
  assert.equal(or.is_available, false);
  assert.equal(or.input_price_per_1m, ERNIE_INTL.input);
});

test('missing providers, the wrong type, duplicates or a non-canonical slug abort with nothing written', async () => {
  const cases = [
    { providers: [vertex, openrouter, vercel, baidu] },
    { providers: [google, openrouter, vercel, baidu] },
    { providers: [{ ...vertex, type: 'reseller' }, google, openrouter, vercel, baidu] },
    { providers: [google, vertex, openrouter, vercel, { ...baidu, type: 'aggregator' }] },
    { providers: [google, vertex, openrouter, vercel, { id: 6, slug: 'vercel', type: 'aggregator' }, baidu] },
    { providers: [google, vertex, openrouter, vercel, baidu, { id: 7, slug: 'qianfan-intl', type: 'official' }] },
    { models: [carbon, { id: 11, slug: 'google-gemini-4-carbon' }] },
    { models: [carbon, { id: 12, slug: 'ernie-5.5-flash-preview' }] },
  ];
  for (const initial of cases) {
    const f = shaped(initial);
    await assert.rejects(seedCatalog20261111CarbonErnie(f.tx, true), /nothing written/);
    assert.equal(f.writes(), 0);
  }
});
