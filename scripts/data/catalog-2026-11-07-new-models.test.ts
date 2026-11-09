import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  AMP_CHANNEL_NOTES, AMP_CONTEXT, AMP_FACTS, AMP_MAX_OUTPUT, AMP_PROMO_ENDS_AT, AMP_SLUG,
  LFM_CONTEXT, LFM_FACTS, LFM_FREE_FACTS, LFM_FREE_NOTES, LFM_FREE_SLUG, LFM_OFFICIAL_NOTES,
  LFM_OR_NOTES, LFM_PAID, LFM_SLUG, LFM_TRAINING_NOTE, PRODUCTION_SHAPED_DRY_RUN, VERIFIED_AT,
  catalog20261107NewModelsSeedOptions, seedCatalog20261107NewModels, seedStepCounts,
} from './catalog-2026-11-07-new-models';
import { fakeSeedTx, type FakeRow } from './fake-seed-tx';
import { isVerifiedFreePrice } from '../utils/audit-price-policy';
import { checkModelIdentity } from '../utils/model-identity-guard';
import { generateOpenRouterSlug } from '../scrapers/openrouter';

const liquid = { id: 4, slug: 'liquid', name: 'Liquid AI', type: 'official', website: 'https://existing.example', pricing_url: 'https://kept.example/old' };
const humansand = { id: 8, slug: 'humansand', name: 'Humans&', type: 'official', website: 'https://kept.example/humans' };
const openrouter = { id: 9, slug: 'openrouter', name: 'OpenRouter', type: 'aggregator' };
const vercel = { id: 10, slug: 'vercel-ai-gateway', name: 'Vercel AI Gateway', type: 'aggregator' };

function shaped(extra: { providers?: FakeRow[]; models?: FakeRow[] } = {}) {
  return fakeSeedTx({
    providers: extra.providers ?? [liquid, openrouter, vercel],
    models: extra.models ?? [{ id: 11, slug: 'liquid-lfm-2-5-24b-a2b', provider_ids: [4], name: 'LFM2.5-24B-A2B' }],
  });
}

test('CLI defaults to dry-run, :apply is separate, and rehearsal is the write path', () => {
  assert.equal(catalog20261107NewModelsSeedOptions([]).apply, false);
  assert.equal(catalog20261107NewModelsSeedOptions(['--dry-run']).apply, false);
  assert.equal(catalog20261107NewModelsSeedOptions(['--apply']).apply, true);
  for (const args of [['--force'], ['--dry-run', '--apply']]) assert.throws(() => catalog20261107NewModelsSeedOptions(args), /Usage/);
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { scripts: Record<string, string> };
  assert.equal(pkg.scripts['seed:catalog-2026-11-07-new-models'], 'tsx scripts/seed-catalog-2026-11-07-new-models.ts');
  assert.equal(pkg.scripts['seed:catalog-2026-11-07-new-models:apply'], 'tsx scripts/seed-catalog-2026-11-07-new-models.ts --apply');
  const cli = readFileSync(new URL('../seed-catalog-2026-11-07-new-models.ts', import.meta.url), 'utf8');
  assert.match(cli, /runRehearsable/);
  assert.doesNotMatch(cli, /READ ONLY/);
  for (const file of ['../../deploy/production/rollout.sh', '../../deploy/production/seed-catalog.sh', '../../.github/workflows/deploy-production.yml', '../../.github/workflows/seed-catalog.yml']) {
    assert.doesNotMatch(readFileSync(new URL(file, import.meta.url), 'utf8'), /2026-11-07-new-models/);
  }
});

test('published prices, slugs and explicit NULLs match the cited pages', () => {
  assert.equal(generateOpenRouterSlug('liquid/lfm-3-1.7b'), LFM_SLUG);
  assert.equal(generateOpenRouterSlug('liquid/lfm-3-1.7b:free'), LFM_FREE_SLUG);
  assert.equal(LFM_CONTEXT, 262_144);
  assert.deepEqual([LFM_PAID.input, LFM_PAID.output, LFM_PAID.cache], [0.08, 0.2, 0.02]);
  assert.equal(AMP_CONTEXT, 1_000_000);
  assert.equal(AMP_MAX_OUTPUT, 32_768);
  assert.equal(AMP_PROMO_ENDS_AT.toISOString(), '2026-11-14T08:00:00.000Z');
  assert.match(LFM_OFFICIAL_NOTES, /\$0\.08/);
  assert.match(LFM_OFFICIAL_NOTES, /\$0\.02/);
  assert.match(LFM_OFFICIAL_NOTES, /\$0\.20/);
  assert.match(LFM_OFFICIAL_NOTES, /data_for_discount is NULL/);
  assert.match(LFM_OR_NOTES, /0\.00000008/);
  assert.match(LFM_OR_NOTES, /status -2/);
  assert.match(LFM_FREE_NOTES, /cached_input_price_per_1m is NULL/);
  assert.match(LFM_FACTS, /1\.73B/);
  assert.match(LFM_FACTS, /256000 is not stored/);
  assert.match(LFM_FACTS, /8192/);
  assert.match(LFM_FREE_FACTS, /Not a second Liquid Console SKU/);
  assert.match(AMP_CHANNEL_NOTES, /2026-11-13/);
  assert.match(AMP_CHANNEL_NOTES, /regular input\/output\/cache are NULL/);
  assert.match(AMP_CHANNEL_NOTES, /data_for_discount is NULL/);
  assert.match(AMP_FACTS, /through November 13, 2026/);
  assert.equal(checkModelIdentity('LFM3-1.7B', LFM_SLUG).ok, true);
  assert.equal(checkModelIdentity('LFM3-1.7B (free)', LFM_FREE_SLUG).ok, true);
  assert.equal(checkModelIdentity('Ampersand v0.1', AMP_SLUG).ok, true);
  assert.equal(isVerifiedFreePrice(AMP_SLUG, 'vercel-ai-gateway'), true);
  assert.equal(isVerifiedFreePrice(AMP_SLUG, 'vercel'), true);
  assert.equal(isVerifiedFreePrice(AMP_SLUG, 'openrouter'), false);
  assert.equal(isVerifiedFreePrice(LFM_SLUG, 'liquid'), false);
  assert.equal(isVerifiedFreePrice(LFM_FREE_SLUG, 'openrouter'), false);
  assert.equal(isVerifiedFreePrice(LFM_FREE_SLUG, 'vercel-ai-gateway'), false);
});

test('production-shaped dry-run previews humansand, three models and four channels without writing', async () => {
  const f = shaped();
  const before = structuredClone(f.data);
  const steps = await seedCatalog20261107NewModels(f.tx);
  assert.equal(f.writes(), 0);
  assert.deepEqual(f.data, before);
  assert.deepEqual(seedStepCounts(steps), PRODUCTION_SHAPED_DRY_RUN);
  assert.deepEqual(steps.map(step => `${step.action} ${step.table} ${step.target}`), [
    'insert providers humansand',
    `insert models ${LFM_SLUG}`,
    `insert models ${LFM_FREE_SLUG}`,
    `insert models ${AMP_SLUG}`,
    `insert api_channel_prices liquid/${LFM_SLUG}`,
    `insert api_channel_prices openrouter/${LFM_SLUG}`,
    `insert api_channel_prices openrouter/${LFM_FREE_SLUG}`,
    `insert api_channel_prices vercel-ai-gateway/${AMP_SLUG}`,
  ]);
  const official = steps.find(step => step.target === `liquid/${LFM_SLUG}`)!;
  assert.deepEqual([
    official.changes.input_price_per_1m.to,
    official.changes.output_price_per_1m.to,
    official.changes.cached_input_price_per_1m.to,
    official.changes.promo_ends_at.to,
    official.changes.currency.to,
  ], [0.08, 0.2, 0.02, null, 'USD']);
  assert.equal(official.changes.model_id.to, -2);
  const free = steps.find(step => step.target === `openrouter/${LFM_FREE_SLUG}`)!;
  assert.equal(free.changes.input_price_per_1m.to, 0);
  assert.equal(free.changes.output_price_per_1m.to, 0);
  assert.equal(free.changes.cached_input_price_per_1m.to, null);
  assert.equal(free.changes.data_for_discount.to, true);
  assert.equal(free.changes.data_for_discount_note.to, LFM_TRAINING_NOTE);
  const gateway = steps.find(step => step.target === `vercel-ai-gateway/${AMP_SLUG}`)!;
  assert.equal((gateway.changes.promo_ends_at.to as Date).toISOString(), AMP_PROMO_ENDS_AT.toISOString());
  assert.equal(gateway.changes.regular_input_price_per_1m.to, null);
  assert.equal(gateway.changes.regular_output_price_per_1m.to, null);
  assert.equal(gateway.changes.regular_cached_input_price_per_1m.to, null);
  assert.equal(gateway.changes.cached_input_price_per_1m.to, 0);
  assert.ok(!('data_for_discount' in gateway.changes));
  const paidModel = steps.find(step => step.target === LFM_SLUG)!;
  assert.equal(paidModel.changes.context_window.to, LFM_CONTEXT);
  assert.equal(paidModel.changes.parameters.to, '1.73B');
  assert.equal(paidModel.changes.open_source.to, true);
  assert.ok(!('max_output_tokens' in paidModel.changes));
  const ampModel = steps.find(step => step.target === AMP_SLUG)!;
  assert.equal(ampModel.changes.max_output_tokens.to, AMP_MAX_OUTPUT);
  assert.equal(ampModel.changes.open_source.to, null);
});

test('apply reuses liquid, writes the new rows, and a second apply is a no-op', async () => {
  const f = shaped();
  const steps = await seedCatalog20261107NewModels(f.tx, true);
  assert.equal(steps.some(step => step.target === 'liquid'), false);
  assert.equal(f.data.providers.find(row => row.slug === 'liquid')!.website, 'https://existing.example');
  assert.equal(f.data.providers.find(row => row.slug === 'liquid')!.pricing_url, 'https://kept.example/old');
  const created = f.data.providers.find(row => row.slug === 'humansand')!;
  assert.equal(created.type, 'official');
  assert.equal(created.website, null);
  assert.equal(created.region, null);
  assert.equal(created.access_from_china, null);
  assert.equal(created.supported_regions, null);
  const paid = f.data.models.find(row => row.slug === LFM_SLUG)!;
  const free = f.data.models.find(row => row.slug === LFM_FREE_SLUG)!;
  const amp = f.data.models.find(row => row.slug === AMP_SLUG)!;
  assert.deepEqual(paid.provider_ids, [4]);
  assert.deepEqual(free.provider_ids, [4]);
  assert.deepEqual(amp.provider_ids, [created.id]);
  assert.equal(paid.offical_link, 'https://huggingface.co/LiquidAI/LFM3-1.7B');
  assert.equal(free.name, 'LFM3-1.7B (free)');
  assert.equal(paid.description, LFM_FACTS);
  assert.equal(amp.description, AMP_FACTS);
  assert.deepEqual(paid.capabilities, ['reasoning', 'tool-calling', 'structured-outputs']);
  assert.deepEqual(amp.capabilities, ['reasoning', 'tool-calling']);
  const official = f.data.api_channel_prices.find(row => row.model_id === paid.id && row.provider_id === 4)!;
  assert.deepEqual([official.input_price_per_1m, official.output_price_per_1m, official.cached_input_price_per_1m], [0.08, 0.2, 0.02]);
  assert.equal(official.notes, LFM_OFFICIAL_NOTES);
  assert.equal((official.last_verified as Date).toISOString(), VERIFIED_AT.toISOString());
  assert.equal(official.data_for_discount, undefined);
  const orPaid = f.data.api_channel_prices.find(row => row.model_id === paid.id && row.provider_id === 9)!;
  assert.equal(orPaid.data_for_discount, true);
  assert.equal(orPaid.notes, LFM_OR_NOTES);
  const orFree = f.data.api_channel_prices.find(row => row.model_id === free.id && row.provider_id === 9)!;
  assert.deepEqual([orFree.input_price_per_1m, orFree.output_price_per_1m, orFree.cached_input_price_per_1m], [0, 0, null]);
  const gateway = f.data.api_channel_prices.find(row => row.model_id === amp.id && row.provider_id === 10)!;
  assert.equal((gateway.promo_ends_at as Date).toISOString(), AMP_PROMO_ENDS_AT.toISOString());
  assert.equal(gateway.regular_output_price_per_1m, null);
  assert.equal(gateway.notes, AMP_CHANNEL_NOTES);
  assert.equal(f.data.models.find(row => row.slug === 'liquid-lfm-2-5-24b-a2b')!.name, 'LFM2.5-24B-A2B');
  const writes = f.writes();
  assert.deepEqual(await seedCatalog20261107NewModels(f.tx, true), []);
  assert.equal(f.writes(), writes);
});

test('a missing liquid provider is inserted and an existing model keeps curated fields', async () => {
  const created = fakeSeedTx({ providers: [openrouter, vercel], models: [] });
  await seedCatalog20261107NewModels(created.tx, true);
  const liquidRow = created.data.providers.find(row => row.slug === 'liquid')!;
  assert.equal(liquidRow.type, 'official');
  assert.equal(liquidRow.pricing_url, 'https://www.liquid.ai/pricing');
  assert.equal(liquidRow.access_from_china, null);
  assert.equal(liquidRow.supported_regions, null);
  assert.equal(created.data.models.find(row => row.slug === LFM_SLUG)!.provider_ids[0], liquidRow.id);

  const curated = shaped({
    models: [{
      id: 21, slug: LFM_SLUG, provider_ids: [4, 99], offical_link: 'https://kept.example/model',
      description: 'Arena note.', capabilities: ['leaderboard'], name: 'LFM3-1.7B',
    }],
  });
  await seedCatalog20261107NewModels(curated.tx, true);
  const paid = curated.data.models.find(row => row.slug === LFM_SLUG)!;
  assert.equal(paid.offical_link, 'https://kept.example/model');
  assert.deepEqual(paid.provider_ids, [4, 99]);
  assert.ok(String(paid.description).startsWith('Arena note.'));
  assert.match(String(paid.description), /Catalog 2026-11-07 LFM3-1\.7B/);
  assert.deepEqual(paid.capabilities, ['leaderboard', 'reasoning', 'tool-calling', 'structured-outputs']);
  assert.deepEqual(await seedCatalog20261107NewModels(curated.tx, true), []);
});

test('a locked-off channel stays unavailable', async () => {
  const f = shaped({
    providers: [liquid, humansand, openrouter, vercel],
    models: [{
      id: 30, slug: AMP_SLUG, provider_ids: [8], description: AMP_FACTS, offical_link: 'https://vercel.com/changelog/humans-and-ampersand-now-available-on-ai-gateway',
      capabilities: ['reasoning', 'tool-calling'], open_source: null, license: null, license_url: null,
      context_window: AMP_CONTEXT, max_output_tokens: AMP_MAX_OUTPUT, type: 'llm', model_category: 'text',
      name: 'Ampersand v0.1', input_modalities: ['text'], output_modalities: ['text'],
      input_type: ['text'], output_type: ['text'], pricing_unit: 'per_1m_tokens',
      released_at: new Date('2026-11-06T00:00:00Z'),
    }],
  });
  f.data.api_channel_prices.push({
    id: 70, model_id: 30, provider_id: 10, is_available: false, availability_locked: true,
    input_price_per_1m: 0, output_price_per_1m: 0, cached_input_price_per_1m: 0,
    currency: 'USD', price_unit: 'per_1m_tokens', notes: AMP_CHANNEL_NOTES, last_verified: VERIFIED_AT,
    promo_ends_at: AMP_PROMO_ENDS_AT, regular_input_price_per_1m: null, regular_output_price_per_1m: null, regular_cached_input_price_per_1m: null,
  });
  await seedCatalog20261107NewModels(f.tx, true);
  assert.equal(f.data.api_channel_prices.find(row => row.id === 70)!.is_available, false);
});

test('missing gateway providers, the wrong type, duplicates or a non-canonical slug abort with nothing written', async () => {
  const cases = [
    { providers: [liquid, vercel], models: [] },
    { providers: [liquid, openrouter], models: [] },
    { providers: [liquid, openrouter, vercel, { id: 12, slug: 'vercel', type: 'aggregator' }], models: [] },
    { providers: [{ ...liquid, type: 'reseller' }, openrouter, vercel], models: [] },
    { providers: [liquid, openrouter, { ...vercel, type: 'official' }], models: [] },
    { providers: [liquid, humansand, openrouter, vercel], models: [{ id: 40, slug: LFM_SLUG }, { id: 41, slug: LFM_SLUG }] },
    { providers: [liquid, humansand, openrouter, vercel], models: [{ id: 42, slug: 'lfm-3-1.7b' }] },
    { providers: [liquid, humansand, openrouter, vercel], models: [{ id: 43, slug: 'ampersand-v0-1' }] },
    { providers: [liquid, { ...humansand, type: 'aggregator' }, openrouter, vercel], models: [] },
  ];
  for (const initial of cases) {
    const f = fakeSeedTx(initial);
    await assert.rejects(() => seedCatalog20261107NewModels(f.tx, true), /nothing written/i);
    assert.equal(f.writes(), 0);
  }
});


test('replaying the dated seed preserves newer live pricing and verification evidence', async () => {
  const f = shaped();
  await seedCatalog20261107NewModels(f.tx, true);
  const row = f.data.api_channel_prices.find(r => r.provider_id === liquid.id)!;
  Object.assign(row, {
    input_price_per_1m: 0.04, output_price_per_1m: 0.10, cached_input_price_per_1m: 0.01,
    last_verified: new Date('2026-11-09T10:35:00Z'), notes: 'Newer official source evidence',
  });
  const before = structuredClone(row);
  await seedCatalog20261107NewModels(f.tx, true);
  assert.deepEqual(row, before);
});
