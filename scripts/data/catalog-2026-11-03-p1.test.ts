import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { auditedPrice, DecisionModelCatalog } from '../../src/components/audited-catalog';
import { catalogForKind } from '../../src/lib/ai-vertical-catalog';
import { DECISION_1103_SPECS } from '../../src/lib/decision-models-2026-11-03';
import { VEO_SLUGS, VERTEX_SOURCE, catalog20261103P1SeedOptions, keepFresher, seedCatalog20261103P1, seedDiff, veoItem } from './catalog-2026-11-03-p1';
import { fakeSeedTx } from './fake-seed-tx';

const providers = [
  { id: 7, slug: 'google', type: 'producer' }, { id: 8, slug: 'vercel-ai-gateway', type: 'aggregator', notes: 'keep' },
  { id: 9, slug: 'liquid', type: 'official', name: 'Liquid AI' },
];
const models = [
  { id: 1, slug: 'veo-3-1', shutdown_date: '2026-10-22', replacement_model: 'gemini-omni-1.1-flash', pricing_unit: 'per_second', deprecated_at: '2026-10-01' },
  { id: 2, slug: 'veo-3-1-fast', shutdown_date: '2026-10-22', replacement_model: 'gemini-omni-1.1-flash', pricing_unit: 'per_second' },
  { id: 3, slug: 'veo-3-1-lite', shutdown_date: '2026-10-22', replacement_model: 'gemini-omni-1.1-flash', pricing_unit: 'per_second' },
  { id: 4, slug: 'veo', description: 'old', name: 'Veo' },
  { id: 5, slug: 'gpt-oss-120b' },
];
const legacyUsage = { id: 300, model_id: 1, provider_id: 7, plan_id: 400, price_kind: 'video_second', unit: 'second', price: '0.40', is_available: false };
const vertexRow = { id: 301, model_id: 2, provider_id: 7, plan_id: 401, price_kind: 'veo-3.1-fast 720p (video + audio)', unit: 'second', price: '0.10', currency: 'USD', is_available: false, last_verified: '2026-11-03T02:00:00Z', source_url: 'x' };
const scraperChannel = { id: 500, model_id: 5, provider_id: 8, last_verified: '2026-11-03T03:17:00+08:00', notes: 'scraper notes' };
const initial = () => ({
  providers, models,
  plans: [{ id: 400, provider_id: 7, slug: 'veo-3-1-official-pricing' }, { id: 401, provider_id: 7, slug: 'veo-3-1-fast-official-pricing' }],
  usage_prices: [legacyUsage, vertexRow],
  api_channel_prices: [scraperChannel],
});

test('CLI options default to dry-run', () => {
  assert.equal(catalog20261103P1SeedOptions([]).apply, false);
  assert.equal(catalog20261103P1SeedOptions(['--dry-run']).apply, false);
  assert.equal(catalog20261103P1SeedOptions(['--apply']).apply, true);
  for (const args of [['--apply', '--dry-run'], ['--force']]) assert.throws(() => catalog20261103P1SeedOptions(args), /Usage/);
});

test('Veo catalog: Vertex available, Gemini API preview shut down, silent tiers and $0.03 floor', () => {
  const expect: Record<string, [number, number, number]> = { 'veo-3-1': [0.2, 0.6, 4], 'veo-3-1-fast': [0.08, 0.3, 6], 'veo-3-1-lite': [0.03, 0.08, 4] };
  for (const slug of VEO_SLUGS) {
    const item = veoItem(slug);
    assert.equal(item.status, 'available');
    assert.equal(item.shutdownDate, undefined);
    assert.equal(item.sourceUrls?.[0].url, VERTEX_SOURCE);
    assert.match(item.notes!, /Vertex AI available/);
    assert.match(item.notes!, /shut down on 2026-10-22/);
    assert.deepEqual([item.pricePerUnit, item.pricePerUnitHigh, item.usageRates!.length], expect[slug]);
    assert.ok(item.usageRates!.some(r => /video only/.test(r.priceKind)));
    assert.equal(Math.min(...item.usageRates!.map(r => r.price)), item.pricePerUnit);
    assert.equal(Math.max(...item.usageRates!.map(r => r.price)), item.pricePerUnitHigh);
  }
  const lite = veoItem('veo-3-1-lite').usageRates!;
  assert.deepEqual(lite.map(r => r.price), [0.05, 0.08, 0.03, 0.05]);
  const family = veoItem('veo');
  assert.deepEqual([family.pricePerUnit, family.pricePerUnitHigh], [0.03, 0.6]);
  assert.match(family.notes!, /Veo 3 video \+ audio \$0\.40/);
  assert.match(family.notes!, /Veo 2 video \$0\.50/);
  assert.doesNotMatch(family.notes!, /not verified/);
  assert.equal(auditedPrice(family, 'en'), '$0.03–$0.60 / second');
});

test('decision catalog lists the 8 new input-only models', () => {
  const items = catalogForKind('decision-model');
  const expected: Record<string, number> = {
    'cloudflare-clef': 0.24, 'cloudflare-clef-omni': 0.15, 'cloudflare-clef-flash': 0.038, 'cloudflare-clairic': 0.1,
    'baseten-mammoth-1': 0.1, 'baseten-elephant-1': 0.035, 'liquid-d1': 0.02, 'liquid-d1-ultra': 0.042,
  };
  for (const [slug, input] of Object.entries(expected)) {
    const item = items.find(i => i.slug === slug)!;
    assert.ok(item, slug);
    assert.deepEqual([item.inputPricePer1M, item.outputPricePer1M, item.pricePer1MTasks], [input, 0, null]);
    assert.equal(item.deferredDbSeedScript, 'seed:catalog-2026-11-03-p1:apply');
  }
  assert.equal(items.find(i => i.slug === 'cloudflare-clef-flash')!.contextWindow, 24_576);
  assert.equal(items.find(i => i.slug === 'cloudflare-clairic')!.status, 'preview');
  const html = renderToStaticMarkup(createElement(DecisionModelCatalog, { items, locale: 'en' }));
  for (const slug of Object.keys(expected)) assert.ok(html.includes(`/decision-models/${slug}`), slug);
});

test('seedDiff treats numeric strings as numbers; keepFresher never regresses scraper rows', () => {
  assert.deepEqual(seedDiff({ id: 1, max_output_tokens: '262144', price: '0.40' }, { max_output_tokens: 262144, price: 0.4 }), {});
  assert.ok(Object.keys(seedDiff({ id: 1, price: '0.41' }, { price: 0.4 })).length === 1);
  const fresh = keepFresher({ id: 1, last_verified: '2026-11-03T03:17:00+08:00', notes: 'n' } as never, { price: 1, last_verified: new Date('2026-11-03T00:00:00Z'), notes: 'seed' });
  assert.deepEqual(fresh, { price: 1 });
  const stale = keepFresher({ id: 1, last_verified: '2026-10-29' } as never, { last_verified: 'x', notes: 'seed' });
  assert.deepEqual(stale, { last_verified: 'x', notes: 'seed' });
});

test('dry-run writes nothing; apply writes only the intended rows and replays to zero', async () => {
  const f = fakeSeedTx(initial());
  const before = structuredClone(f.data);
  const preview = await seedCatalog20261103P1(f.tx);
  assert.equal(f.writes(), 0);
  assert.deepEqual(f.data, before);
  const applied = await seedCatalog20261103P1(f.tx, true);
  assert.deepEqual(applied.map(s => [s.table, s.target, s.action]), preview.map(s => [s.table, s.target, s.action]));

  // Veo models: shutdown cleared, unrelated fields kept.
  for (const id of [1, 2, 3]) {
    const m = f.data.models.find(r => r.id === id)!;
    assert.equal(m.shutdown_date, null);
    assert.equal(m.replacement_model, null);
    assert.match(String(m.description), /Status: available\./);
  }
  assert.equal(f.data.models.find(r => r.id === 1)!.deprecated_at, '2026-10-01');
  assert.match(String(f.data.models.find(r => r.id === 4)!.description), /Veo 2/);
  assert.deepEqual(f.data.models.find(r => r.id === 5), models[4]);

  // Usage rows: legacy row untouched; existing Vertex row updated in place but keeps its fresher last_verified.
  assert.deepEqual(f.data.usage_prices.find(r => r.id === 300), legacyUsage);
  const fast = f.data.usage_prices.find(r => r.id === 301)!;
  assert.equal(fast.is_available, true);
  assert.equal(fast.source_url, VERTEX_SOURCE);
  assert.equal(fast.last_verified, '2026-11-03T02:00:00Z');
  const veoRows = f.data.usage_prices.filter(r => r.id !== 300);
  assert.equal(veoRows.length, 4 + 6 + 4);
  assert.ok(veoRows.filter(r => r.model_id === 1).every(r => r.plan_id === 400));
  assert.ok(veoRows.filter(r => r.model_id === 3).every(r => r.plan_id === null));
  assert.deepEqual(veoRows.filter(r => r.model_id === 3).map(r => r.price).sort(), [0.03, 0.05, 0.05, 0.08]);

  // Decision models: 2 providers created, liquid / vercel reused, 8 models + 8 channels.
  assert.deepEqual(f.data.providers.map(p => p.slug).sort(), ['baseten', 'cloudflare', 'google', 'liquid', 'vercel-ai-gateway']);
  assert.deepEqual(f.data.providers.find(p => p.id === 8), providers[1]);
  for (const spec of DECISION_1103_SPECS) {
    const m = f.data.models.find(r => r.slug === spec.slug)!;
    assert.equal(m.model_category, 'decision');
    const ch = f.data.api_channel_prices.filter(r => r.model_id === m.id);
    assert.equal(ch.length, 1, spec.slug);
    assert.deepEqual([ch[0].input_price_per_1m, ch[0].output_price_per_1m], [spec.input, 0]);
    const gateway = f.data.providers.find(p => p.id === ch[0].provider_id)!;
    assert.equal(gateway.slug, spec.channel === 'vercel' ? 'vercel-ai-gateway' : 'cloudflare');
  }
  assert.deepEqual(f.data.api_channel_prices.find(r => r.id === 500), scraperChannel);

  const counts = Object.fromEntries(['providers', 'models', 'usage_prices', 'api_channel_prices'].map(t => [t, applied.filter(s => s.table === t).length]));
  assert.deepEqual(counts, { providers: 2, models: 4 + 8, usage_prices: 14, api_channel_prices: 8 });

  const writes = f.writes();
  assert.deepEqual(await seedCatalog20261103P1(f.tx, true), []);
  assert.equal(f.writes(), writes);
});

test('ambiguous or non-canonical identities abort before any write', async () => {
  const dup = fakeSeedTx({ ...initial(), models: [...models, { id: 9, slug: 'clef' }] });
  await assert.rejects(seedCatalog20261103P1(dup.tx, true), /Non-canonical row for cloudflare-clef/);
  assert.equal(dup.writes(), 0);
  const noGoogle = fakeSeedTx({ ...initial(), providers: providers.filter(p => p.slug !== 'google') });
  await assert.rejects(seedCatalog20261103P1(noGoogle.tx, true), /providers\/google/);
  const badType = fakeSeedTx({ ...initial(), providers: [...providers, { id: 10, slug: 'cloudflare', type: 'aggregator' }] });
  await assert.rejects(seedCatalog20261103P1(badType.tx, true), /providers\/cloudflare has type aggregator/);
  assert.equal(badType.writes(), 0);
});
