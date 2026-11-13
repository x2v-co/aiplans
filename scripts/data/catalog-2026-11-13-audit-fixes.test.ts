import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  ELEVENLABS_1113, XAI_VIDEO_1113, CATALOG_1113_SLUGS,
} from '../../src/lib/catalog-2026-11-13';
import { AI_VERTICAL_CATALOG } from '../../src/lib/ai-vertical-catalog';
import { ASR_TTS_1105 } from '../../src/lib/catalog-2026-11-05';
import { GROK_VIDEO_1104 } from '../../src/lib/catalog-2026-11-04';
import {
  LIFECYCLE, PRODUCTION_SHAPED_DRY_RUN, QWEN_PREVIEW_SHUTDOWN, QWEN_PREVIEW_SLUG,
  catalog20261113AuditFixesSeedOptions, seedCatalog20261113AuditFixes, seedStepCounts,
} from './catalog-2026-11-13-audit-fixes';
import { fakeSeedTx } from './fake-seed-tx';

const elevenlabs = { id: 11, slug: 'elevenlabs', name: 'ElevenLabs', type: 'official' };
const xai = { id: 12, slug: 'xai', name: 'xAI', type: 'official' };
const qwen = { id: 13, slug: 'qwen', name: 'Qwen', type: 'official' };

const existingModels = [
  { id: 21, slug: 'elevenlabs-scribe-v2', name: 'Scribe v2', type: 'multimodal', provider_ids: [11], description: 'old v2', offical_link: 'https://elevenlabs.io/pricing/api' },
  { id: 22, slug: 'elevenlabs-scribe-v2-realtime', name: 'Scribe v2 Realtime', type: 'multimodal', provider_ids: [11], description: 'old rt' },
  { id: 23, slug: 'mistral-medium-3.5', name: 'Mistral Medium 3.5', type: 'llm', provider_ids: [8], description: 'or only' },
  { id: 24, slug: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash-Lite', type: 'llm', provider_ids: [2], description: 'flash lite' },
  { id: 25, slug: 'mistral-devstral-2512', name: 'Devstral 2', type: 'llm', provider_ids: [8], description: 'devstral' },
  { id: 26, slug: 'gpt-image-2', name: 'GPT Image 2', type: 'image', provider_ids: [1], description: 'image copy', shutdown_date: null },
  { id: 27, slug: 'grok-imagine-video-1-5-agent', name: 'grok-imagine-video-1.5-agent', type: 'multimodal', provider_ids: [12], description: '1.5 tiers' },
  { id: 28, slug: 'grok-imagine-video-720p', name: 'grok-imagine-video-720p', type: 'multimodal', provider_ids: [12], description: '720p' },
];

const existingUsage = [
  { id: 31, model_id: 21, provider_id: 11, plan_id: null, price_kind: 'transcription_batch', unit: 'hour', price: 0.22, currency: 'USD', is_available: true },
  { id: 32, model_id: 22, provider_id: 11, plan_id: null, price_kind: 'transcription_streaming', unit: 'hour', price: 0.39, currency: 'USD', is_available: true },
  { id: 33, model_id: 27, provider_id: 12, plan_id: null, price_kind: 'grok-imagine-video-1.5 480p', unit: 'second', price: 0.08, currency: 'USD', is_available: true },
  { id: 34, model_id: 27, provider_id: 12, plan_id: null, price_kind: 'grok-imagine-video-1.5 720p', unit: 'second', price: 0.14, currency: 'USD', is_available: true },
  { id: 35, model_id: 27, provider_id: 12, plan_id: null, price_kind: 'grok-imagine-video-1.5 1080p', unit: 'second', price: 0.25, currency: 'USD', is_available: true },
  { id: 36, model_id: 28, provider_id: 12, plan_id: null, price_kind: 'grok-imagine-video 1.0 720p', unit: 'second', price: 0.07, currency: 'USD', is_available: true },
];

const productionShaped = () => fakeSeedTx({
  providers: [elevenlabs, xai, qwen],
  models: existingModels,
  usage_prices: existingUsage,
});

test('CLI defaults to dry-run, :apply is separate, and the seed is not in deploy', () => {
  assert.equal(catalog20261113AuditFixesSeedOptions([]).apply, false);
  assert.equal(catalog20261113AuditFixesSeedOptions(['--dry-run']).apply, false);
  assert.equal(catalog20261113AuditFixesSeedOptions(['--apply']).apply, true);
  for (const args of [['--apply', '--dry-run'], ['--force']]) {
    assert.throws(() => catalog20261113AuditFixesSeedOptions(args), /Usage/);
  }
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { scripts: Record<string, string> };
  assert.equal(pkg.scripts['seed:catalog-2026-11-13-audit-fixes'], 'tsx scripts/seed-catalog-2026-11-13-audit-fixes.ts');
  assert.equal(pkg.scripts['seed:catalog-2026-11-13-audit-fixes:apply'], 'tsx scripts/seed-catalog-2026-11-13-audit-fixes.ts --apply');
  const deploy = readFileSync(new URL('../../deploy/production/seed-catalog.sh', import.meta.url), 'utf8');
  assert.equal(deploy.includes('2026-11-13-audit-fixes'), false);
});

test('official 11-13 prices, lifecycle dates and catalog overrides match the cited pages', () => {
  const bySlug = Object.fromEntries(ELEVENLABS_1113.map(item => [item.slug, item]));
  assert.equal(bySlug['elevenlabs-scribe-v2']!.pricePerUnit, 0.2);
  assert.equal(bySlug['elevenlabs-scribe-v2-realtime']!.pricePerUnit, 0.22);
  assert.equal(bySlug['elevenlabs-scribe-v3']!.pricePerUnit, 0.2);
  assert.equal(bySlug['elevenlabs-scribe-v3-live']!.pricePerUnit, 0.22);
  assert.equal(bySlug['elevenlabs-scribe-v2-medical']!.pricePerUnit, 0.2);
  assert.equal(bySlug['elevenlabs-realtime-v1-mini']!.usageRates!.find(r => r.priceKind === 'connected_audio')!.price, 0.08);
  assert.deepEqual(bySlug['elevenlabs-realtime-v1-mini']!.usageRates!.map(r => r.price), [0.08, 0.2, 6]);
  assert.deepEqual(bySlug['elevenlabs-realtime-v1-max']!.usageRates!.map(r => r.price), [0.08, 1.8, 9]);
  const medium = LIFECYCLE.find(item => item.key === 'mistral-medium-3.5')!;
  assert.equal(medium.deprecatedAt, '2026-10-31');
  assert.equal(medium.shutdownDate, '2027-04-30');
  const lite = LIFECYCLE.find(item => item.key === 'gemini-3.1-flash-lite')!;
  assert.equal(lite.deprecatedAt, undefined);
  assert.equal(lite.shutdownDate, '2027-05-07');
  assert.match(lite.note, /earliest possible/);
  const devstral = LIFECYCLE.find(item => item.key === 'devstral-2512')!;
  assert.equal(devstral.shutdownDate, '2026-07-31');
  assert.ok(devstral.slugs.includes('mistral-devstral-2512'));
  const image = LIFECYCLE.find(item => item.key === 'gpt-image-2')!;
  assert.equal(image.deprecatedAt, '2026-11-10');
  assert.equal(image.shutdownDate, '2027-02-10');
  assert.equal(QWEN_PREVIEW_SHUTDOWN, '2026-11-26');
  const grok15 = XAI_VIDEO_1113.find(item => item.slug === 'grok-imagine-video-1-5-agent')!;
  const grok720 = XAI_VIDEO_1113.find(item => item.slug === 'grok-imagine-video-720p')!;
  assert.equal(grok15.pricePerUnit, 0.08);
  assert.equal(grok15.pricePerUnitHigh, undefined);
  assert.equal(grok15.usageRates!.length, 1);
  assert.equal(grok720.pricePerUnit, 0.05);
  // Live catalog uses the 11-13 prices, not the 11-04 / 11-05 snapshots.
  assert.equal(AI_VERTICAL_CATALOG.find(i => i.slug === 'elevenlabs-scribe-v2')!.pricePerUnit, 0.2);
  assert.equal(AI_VERTICAL_CATALOG.find(i => i.slug === 'elevenlabs-scribe-v2-realtime')!.pricePerUnit, 0.22);
  assert.equal(ASR_TTS_1105.find(i => i.slug === 'elevenlabs-scribe-v2')!.pricePerUnit, 0.22);
  assert.equal(GROK_VIDEO_1104.find(i => i.slug === 'grok-imagine-video-720p')!.pricePerUnit, 0.07);
  assert.equal(AI_VERTICAL_CATALOG.filter(i => i.slug && CATALOG_1113_SLUGS.has(i.slug)).length, CATALOG_1113_SLUGS.size);
  const slugs = AI_VERTICAL_CATALOG.map(i => i.slug).filter(Boolean) as string[];
  assert.equal(slugs.length, new Set(slugs).size);
});

test('production-shaped dry-run previews lifecycle, Scribe, xAI video and qwen preview without writing', async () => {
  const { tx, writes } = productionShaped();
  const steps = await seedCatalog20261113AuditFixes(tx, false);
  assert.deepEqual(seedStepCounts(steps), PRODUCTION_SHAPED_DRY_RUN);
  assert.equal(writes(), 0);
});

test('apply writes official rates and dates, attaches aliases in place, then re-runs empty', async () => {
  const { tx, data } = productionShaped();
  const applied = await seedCatalog20261113AuditFixes(tx, true);
  assert.deepEqual(seedStepCounts(applied), PRODUCTION_SHAPED_DRY_RUN);
  assert.deepEqual(
    (await seedCatalog20261113AuditFixes(tx, false)).filter(step => step.action !== 'skip'),
    [],
    'second dry-run after apply is empty except skips',
  );

  const bySlug = Object.fromEntries(data.models.map(row => [row.slug, row]));
  assert.equal(bySlug['mistral-medium-3.5'].deprecated_at, '2026-10-31');
  assert.equal(bySlug['mistral-medium-3.5'].shutdown_date, '2027-04-30');
  assert.equal(bySlug['mistral-medium-3.5'].replacement_model, 'mistral-large-4');
  assert.equal(bySlug['gemini-3.1-flash-lite'].shutdown_date, '2027-05-07');
  assert.equal(bySlug['gemini-3.1-flash-lite'].deprecated_at, undefined);
  assert.equal(bySlug['mistral-devstral-2512'].slug, 'mistral-devstral-2512');
  assert.equal(bySlug['mistral-devstral-2512'].shutdown_date, '2026-07-31');
  assert.equal(data.models.filter(row => row.slug === 'devstral-2512').length, 0);
  assert.equal(bySlug['gpt-image-2'].shutdown_date, '2027-02-10');
  assert.equal(bySlug['gpt-image-2'].deprecated_at, '2026-11-10');
  assert.equal(bySlug[QWEN_PREVIEW_SLUG].shutdown_date, '2026-11-26');
  assert.equal(bySlug[QWEN_PREVIEW_SLUG].pricing_unit, 'subscription_only');
  assert.equal(bySlug['elevenlabs-scribe-v3'].name, 'Scribe v3');
  assert.equal(bySlug['elevenlabs-realtime-v1-mini'].pricing_unit, 'per_minute');

  const usageFor = (slug: string) => data.usage_prices.filter(row => {
    const model = data.models.find(m => m.id === row.model_id);
    return model?.slug === slug;
  });
  const v2 = usageFor('elevenlabs-scribe-v2').find(row => row.price_kind === 'transcription_batch')!;
  const rt = usageFor('elevenlabs-scribe-v2-realtime').find(row => row.price_kind === 'transcription_streaming')!;
  assert.equal(v2.price, 0.2);
  assert.equal(rt.price, 0.22);
  const agent = usageFor('grok-imagine-video-1-5-agent');
  const live = agent.filter(row => row.is_available !== false);
  const retired = agent.filter(row => row.is_available === false);
  assert.equal(live.length, 1);
  assert.equal(live[0].price, 0.08);
  assert.equal(live[0].price_kind, 'video_second');
  assert.equal(retired.length, 2);
  const video720 = usageFor('grok-imagine-video-720p');
  assert.equal(video720.filter(row => row.is_available !== false).length, 1);
  assert.equal(video720.find(row => row.is_available !== false)!.price, 0.05);
  assert.equal(data.providers.length, 3);
});

test('a missing baidu-style wrong type, two lookup slugs, or a non-canonical qwen alias abort with nothing written', async () => {
  const clash = fakeSeedTx({
    providers: [elevenlabs, xai, qwen],
    models: [
      ...existingModels,
      { id: 99, slug: 'devstral-2512', name: 'dup', type: 'llm', provider_ids: [] },
    ],
    usage_prices: existingUsage,
  });
  await assert.rejects(() => seedCatalog20261113AuditFixes(clash.tx, true), /Ambiguous/);
  assert.equal(clash.writes(), 0);

  const alias = fakeSeedTx({
    providers: [elevenlabs, xai, qwen],
    models: [...existingModels, { id: 40, slug: 'qwen4.0-max-preview', name: 'alias', type: 'llm', provider_ids: [13] }],
    usage_prices: existingUsage,
  });
  await assert.rejects(() => seedCatalog20261113AuditFixes(alias.tx, true), /Non-canonical qwen4.0-max-preview/);
  assert.equal(alias.writes(), 0);

  const wrong = fakeSeedTx({
    providers: [elevenlabs, xai, { id: 13, slug: 'qwen', type: 'aggregator' }],
    models: existingModels,
    usage_prices: existingUsage,
  });
  await assert.rejects(() => seedCatalog20261113AuditFixes(wrong.tx, true), /has type aggregator/);
  assert.equal(wrong.writes(), 0);
});
