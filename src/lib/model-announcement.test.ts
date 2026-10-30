import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import en from '../../messages/en.json';
import zh from '../../messages/zh.json';
import { ANNOUNCED_DESCRIPTION_PATTERN, modelAvailabilityStatus, modelAnnouncementLabel } from './model-announcement';
import { buildModelPricingSeo } from './model-pricing-seo';
import { resolveSelector, type SelectableModel } from './plan-selector';
import { payAsYouGoEstimate, PAYG_MIXES } from './quota/pay-as-you-go';
import { carbonChannelRow, carbonModelRow } from '../../scripts/data/gemini-4-carbon';
import { retainManualUnavailable } from '../../scripts/utils/manual-unavailable';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('existing LLM descriptions default to available; only explicit metadata opts in', () => {
  for (const description of [undefined, null, '', 'An available model.', 'Status: available.',
    'This was announced yesterday.', 'A note: Status: announced.', 'Status: announced.preview']) {
    assert.equal(modelAvailabilityStatus(description), 'available');
    assert.equal(modelAnnouncementLabel(description, en.modelAnnouncement), null);
  }
  const description = carbonModelRow(7).description;
  assert.equal(modelAvailabilityStatus(description), 'announced');
  assert.equal(modelAvailabilityStatus(`Model details.\n${description}`), 'announced');
  assert.equal(new RegExp(ANNOUNCED_DESCRIPTION_PATTERN).test(description), true);
});

test('announced badge helper uses the en and zh message catalogs', () => {
  const description = carbonModelRow(7).description;
  assert.equal(modelAnnouncementLabel(description, en.modelAnnouncement), 'Announced · API not yet available');
  assert.equal(modelAnnouncementLabel(description, zh.modelAnnouncement), '已公布 · API 未开放');
});

test('announced reference prices cannot become cheapest rates, cache FAQs, or structured offers', () => {
  const reference = { ...carbonChannelRow(7, 10), id: 30, providers: { name: 'Google', type: 'producer' } };
  for (const locale of ['en', 'zh'] as const) {
    const pricing = buildModelPricingSeo(carbonModelRow(7), [reference], locale);
    assert.deepEqual(pricing.channels, []);
    assert.deepEqual(pricing.pricedChannels, []);
    assert.deepEqual(pricing.tableChannels, []);
    assert.deepEqual(pricing.official, []);
    assert.equal(pricing.cheapest, undefined);
    assert.equal(pricing.aggregateOffer, undefined);
    assert.equal(pricing.exampleLabel, null);
  }
  assert.deepEqual(payAsYouGoEstimate({ ...reference, provider_slug: 'google', model_slug: 'gemini-4-carbon', pricing_url: null },
    PAYG_MIXES[0], { asOf: new Date('2026-10-29') }), { status: 'skipped', reason: 'channel unavailable' });
  assert.equal(retainManualUnavailable({ ...reference, is_available: true }, reference).is_available, false);
});

test('wildcard and explicit subscription selectors exclude announced models, preserving normal defaults', () => {
  const catalog: SelectableModel[] = [
    { id: 1, slug: 'gemini-4-argon', providerSlugs: ['google'], elo: 100 },
    { id: 2, slug: 'gemini-4-carbon', providerSlugs: ['google'], elo: 200, description: carbonModelRow(7).description },
  ];
  assert.deepEqual(resolveSelector({ families: ['gemini'] }, catalog, ['google']).models.map(row => row.slug), ['gemini-4-argon']);
  const explicit = resolveSelector({ extra: ['gemini-4-carbon'], only_extra: true }, catalog);
  assert.deepEqual(explicit.models, []);
  assert.deepEqual(explicit.unknownExtra, []); // Known but unavailable is not a config typo.
  assert.equal(resolveSelector({ families: ['gemini'] }, catalog.map(({ description: _description, ...row }) => row), ['google']).models.length, 2);
});

test('detail references remain a separate, announced-only SELECT, outside available offers', () => {
  const page = read('../app/[locale]/models/[slug]/page.tsx');
  assert.match(page, /modelAvailabilityStatus\(model.description\) === 'announced'\s*\? await sql/);
  assert.match(page, /cp\.is_available = false\s+AND p\.type IN \('official', 'producer'\)/);
  assert.match(page, /referencePrices\.map\(reference/);
  assert.match(page, /channelPrices: normalizedChannelPrices,\s+referencePrices,/);
  assert.match(page, /buildModelPricingSeo\([^;]+channelPrices,/);
  assert.match(page, /const channelIds = normalizedChannelPrices\.map/);
  assert.match(page, /!announcementLabel && <ModelPricingSummary/);
});

test('comparison, search, sitemap and publication queries retain their availability guards', () => {
  const guards: Array<[string, RegExp]> = [
    ['./grouped-products.ts', /WHERE cp\.is_available = true/],
    ['./grouped-products.ts', /\.filter\(\(group\) => group\.versions\.length > 0\)/],
    ['./products.ts', /FROM api_channel_prices\s+WHERE is_available = true/],
    ['./home-seo.ts', /JOIN api_channel_prices cp ON cp\.model_id = m\.id AND cp\.is_available = true/],
    ['./pricing-guides.ts', /JOIN api_channel_prices cp ON cp\.model_id = m\.id AND cp\.is_available = true/],
    ['./pricing-seo-data.ts', /m\.type = 'llm' AND cp\.is_available = true/],
    ['../app/api/search-index/route.ts', /WHERE cp\.model_id = m\.id AND cp\.is_available = true/],
    ['./seo-index-data.ts', /WHERE cp\.model_id = m\.id AND cp\.is_available = true/],
    ['../app/api/products/[slug]/channels/route.ts', /AND cp\.is_available = true/],
    ['../app/api/channels/[productId]/route.ts', /AND cp\.is_available = true/],
    ['../../scripts/publish-planprice-v1-snapshot.ts', /WHERE c\.is_available = true/],
  ];
  for (const [path, guard] of guards) assert.match(read(path), guard, path);
  const priceIndex = read('./api-price-index.ts');
  assert.match(priceIndex, /m\.type ILIKE '%llm%' AND cp\.is_available = true/); // Counts
  assert.match(priceIndex, /JOIN api_channel_prices cp ON cp\.model_id = m\.id AND cp\.is_available = true/); // Cheapest
  assert.match(priceIndex, /COALESCE\(m.description, ''\) !~ \$\{ANNOUNCED_DESCRIPTION_PATTERN\}/); // History
  for (const path of ['../../scripts/materialize-model-plan-mappings.ts', '../../scripts/audit-data.ts']) {
    assert.match(read(path), /description: (?:row|m)\.description/);
  }
});
