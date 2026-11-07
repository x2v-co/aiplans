import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EmbeddingModelCatalog, auditedPrice } from '../../src/components/audited-catalog';
import { catalogForKind } from '../../src/lib/ai-vertical-catalog';
import { EMBEDDING_MODELS_1104, GROK_VIDEO_1104, MUREKA_1104, SARVAM_PRISM_1104, VOICE_MODELS_1104 } from '../../src/lib/catalog-2026-11-04';
import { isVerifiedFreeOutput } from '../utils/audit-price-policy';
import { CATALOG_ITEMS, CREDIT_SOURCE, PLAN_CREDITS, QODER_SOURCE, VERIFIED_AT, catalog20261104SeedOptions, keepFresher, seedCatalog20261104 } from './catalog-2026-11-04';
import * as seedModule from './catalog-2026-11-04';
import { fakeSeedTx, type FakeRow } from './fake-seed-tx';

export function catalog1104Fixture(): Partial<Record<string, FakeRow[]>> {
  return {
    providers: [
      { id: 1, slug: 'openai', type: 'official' }, { id: 2, slug: 'google', type: 'producer' },
      { id: 3, slug: 'xai', type: 'producer' }, { id: 4, slug: 'meituan', type: 'official', access_from_china: null },
    ],
    plans: [
      { id: 10, slug: 'chatgpt-go', provider_id: 1, price: null, access_from_china: true },
      ...PLAN_CREDITS.map(([slug], index) => ({ id: 11 + index, slug, provider_id: 1, price: 999, notes: 'Existing unrelated evidence.' })),
      { id: 20, slug: 'google-ai-plus', provider_id: 2, price: 5 },
      { id: 21, slug: 'lingma-professional', provider_id: 99, price: 59, currency: 'CNY' },
    ],
    models: [
      { id: 30, slug: 'gpt-6.1-terra' }, { id: 31, slug: 'meituan-longcat-2-5', provider_ids: [4] },
      { id: 32, slug: 'embedding-2-preview' }, { id: 33, slug: 'gemini-embedding-001' },
      { id: 34, slug: 'grok-imagine-video-720p', name: 'old', provider_ids: [3] },
      { id: 35, slug: 'unrelated', description: 'keep' },
    ],
    api_channel_prices: [{ id: 40, model_id: 30, provider_id: 1, input_price_per_1m: '1.00', output_price_per_1m: '5', cached_input_price_per_1m: '0.05' }],
    api_channel_price_variants: [{ id: 41, model_id: 30, provider_id: 1, variant_key: 'batch', is_headline: false, notes: 'leave untouched' }],
    usage_prices: [{ id: 42, model_id: 35, provider_id: 3, price_kind: 'other', price: 9 }],
  };
}

test('1104 CLI defaults to read-only preview and rejects unknown/conflicting arguments', () => {
  assert.equal(catalog20261104SeedOptions([]).apply, false);
  assert.equal(catalog20261104SeedOptions(['--dry-run']).apply, false);
  assert.equal(catalog20261104SeedOptions(['--apply']).apply, true);
  for (const args of [['--apply', '--dry-run'], ['--force'], ['--slug', 'x']]) assert.throws(() => catalog20261104SeedOptions(args), /Usage/);
});

test('1104 real CLI prints a diff in a READ ONLY serializable transaction without importing a real DB', async () => {
  const f = fakeSeedTx(catalog1104Fixture());
  const messages: string[] = [];
  const process = { argv: ['tsx', 'seed-catalog-2026-11-04.ts'], exitCode: 0 };
  let readOnly = false;
  const tx = ((parts: TemplateStringsArray | unknown, ...values: unknown[]) => {
    if (Array.isArray(parts) && 'raw' in parts && parts.join('') === 'SET TRANSACTION READ ONLY') { readOnly = true; return Promise.resolve([]); }
    assert.equal(readOnly, true);
    return (f.tx as unknown as (...args: unknown[]) => unknown)(parts, ...values);
  });
  let closed = false;
  const sql = { begin: async (mode: string, callback: (tx: unknown) => unknown) => { assert.equal(mode, 'isolation level serializable'); await callback(tx); }, end: async () => { closed = true; } };
  const source = readFileSync(new URL('../seed-catalog-2026-11-04.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const before = structuredClone(f.data);
  await new Promise<void>((resolve, reject) => {
    runInNewContext(compiled, {
      exports: {}, process,
      require: (id: string) => {
        if (id === './data/catalog-2026-11-04') return seedModule;
        assert.equal(id, './db/postgres-admin');
        return { databaseSql: sql };
      },
      console: { log: (...args: unknown[]) => { messages.push(args.join(' ')); if (String(args[0]).startsWith('Rows verified')) resolve(); }, error: reject },
    });
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(process.exitCode, 0);
  assert.equal(closed, true);
  assert.equal(f.writes(), 0);
  assert.deepEqual(f.data, before);
  assert.match(messages.join('\n'), /Dry-run; no writes/);
  assert.match(messages.join('\n'), /providers: 4 insert, 1 update/);
});

test('1104 seed previews the same diff as memory-only apply and a second apply writes nothing', async t => {
  const f = fakeSeedTx(catalog1104Fixture());
  const before = structuredClone(f.data);
  const preview = await seedCatalog20261104(f.tx);
  t.diagnostic(`Memory fixture dry-run: ${preview.length} changes; ${preview.filter(s => s.action === 'insert').length} inserts, ${preview.filter(s => s.action === 'update').length} updates; no database connection.`);
  assert.ok(preview.length > 50);
  assert.equal(f.writes(), 0);
  assert.deepEqual(f.data, before);
  const applied = await seedCatalog20261104(f.tx, true);
  assert.deepEqual(applied, preview);
  const writes = f.writes();
  assert.deepEqual(await seedCatalog20261104(f.tx, true), []);
  assert.deepEqual(await seedCatalog20261104(f.tx), []);
  assert.equal(f.writes(), writes);
  assert.deepEqual(f.data.models.find(r => r.id === 35), before.models.find(r => r.id === 35));
  assert.deepEqual(f.data.plans.find(r => r.id === 21), before.plans.find(r => r.id === 21));
  assert.deepEqual(f.data.usage_prices.find(r => r.id === 42), before.usage_prices.find(r => r.id === 42));
  assert.deepEqual(f.data.api_channel_price_variants.find(r => r.id === 41), before.api_channel_price_variants.find(r => r.id === 41));
});

test('1104 plans preserve Go price and other prices while recording credits, US Plus price and international Qoder', async () => {
  const f = fakeSeedTx(catalog1104Fixture());
  await seedCatalog20261104(f.tx, true);
  const plan = (slug: string) => f.data.plans.find(r => r.slug === slug)!;
  assert.equal(plan('chatgpt-go').price, null);
  assert.equal(plan('chatgpt-go').access_from_china, false);
  for (const [slug, credit] of PLAN_CREDITS) {
    assert.equal(plan(slug).monthly_api_credit_usd, credit);
    assert.equal(plan(slug).price, 999);
    assert.match(String(plan(slug).notes), /Existing unrelated evidence/);
    assert.ok(String(plan(slug).notes).includes(CREDIT_SOURCE));
  }
  for (const slug of ['chatgpt-business', 'chatgpt-business-premium']) {
    assert.match(String(plan(slug).notes), /pooled per workspace, capped at \$500\/month/);
    assert.match(String(plan(slug).notes), /\$6,000/);
  }
  assert.equal(plan('google-ai-plus').price, 4.99);
  assert.equal(plan('google-ai-plus').currency, 'USD');
  for (const [slug, price, credits] of [['qoder-lite', 10, 1000], ['qoder-pro', 20, 2000]] as const) {
    assert.deepEqual([plan(slug).price, plan(slug).included_usage_amount, plan(slug).plan_kind], [price, credits, 'coding']);
    assert.equal(plan(slug).product_id, plan(slug).provider_id);
    assert.ok(String(plan(slug).notes).includes(QODER_SOURCE));
    assert.equal((plan(slug).last_verified as Date).toISOString(), VERIFIED_AT.toISOString());
  }
  assert.match(String(plan('qoder-lite').notes), /double credits; \+500 credits per Lite renewal/);
});

test('1104 reuses an existing international Qoder Pro without changing the CN plans', async () => {
  const fixture = catalog1104Fixture();
  fixture.providers!.push({ id: 8, slug: 'qoder', type: 'official' });
  fixture.plans!.push({ id: 22, slug: 'qoder-pro', provider_id: 8, notes: 'old' });
  const f = fakeSeedTx(fixture);
  const steps = await seedCatalog20261104(f.tx, true);
  assert.equal(steps.find(s => s.target === 'qoder-pro')!.action, 'update');
  assert.equal(f.data.plans.filter(r => r.slug === 'qoder-pro').length, 1);
  assert.equal(f.data.plans.find(r => r.id === 21)!.price, 59);
});

test('1104 voice rates retain real billing units, approximate conversions and future/batch boundaries', () => {
  const voice = (slug: string) => VOICE_MODELS_1104.find(r => r.slug === slug)!;
  assert.deepEqual(voice('eleven-v4').usageRates!.map(r => [r.unit, r.price]), [['per_1k_characters', 0.08]]);
  assert.equal(voice('eleven-v4-turbo').usageRates![0].price, 0.04);
  for (const [slug, output] of [['gemini-3.8-flash-tts', 9], ['gemini-3.8-flash-lite-tts', 6]] as const) {
    const item = voice(slug);
    assert.deepEqual([item.inputPricePer1M, item.outputPricePer1M], [0.5, output]);
    assert.deepEqual(item.usageRates!.filter(r => r.validThrough).map(r => r.price), [0.5, 0.25, output, output / 2]);
    assert.deepEqual(item.usageRates!.filter(r => r.validFrom).map(r => r.price), [1, 0.5, output * 2, output]);
    assert.ok(item.usageRates!.every(r => r.validThrough === '2026-12-31' || r.validFrom === '2027-01-01'));
  }
  assert.deepEqual(voice('gemini-3.5-transcribe').usageRates!.map(r => r.price), [2, 12]);
  assert.equal(voice('gemini-3.5-transcribe-live').usageRates![0].approximate, true);
  assert.equal(voice('gemini-3.5-transcribe-live').pricePerUnit, 0.009);
});

test('1104 embedding category has exact multimodal and OpenAI rates without fabricated output prices', () => {
  assert.equal(EMBEDDING_MODELS_1104.length, 4);
  const google = EMBEDDING_MODELS_1104[0];
  assert.equal(google.releasedAt, '2026-04-22');
  assert.deepEqual(google.usageRates!.map(r => r.price), [0.2, 0.1, 0.45, 0.225, 6.5, 3.25, 12, 6]);
  assert.match(google.notes!, /DEPRECATED|deprecated/);
  assert.match(google.notes!, /2026-11-06/);
  assert.match(google.notes!, /gemini-embedding-2-preview route to gemini-embedding-2/);
  assert.match(google.notes!, /embedding space/);
  assert.doesNotMatch(google.notes!, /2026-08-10/);
  assert.match(google.notes!, /2028-05-14/);
  assert.deepEqual(EMBEDDING_MODELS_1104.slice(1).map(r => r.inputPricePer1M), [0.02, 0.13, 0.1]);
  for (const item of EMBEDDING_MODELS_1104) assert.equal(item.outputPricePer1M, undefined);
  assert.deepEqual(catalogForKind('embedding-model').slice(0, EMBEDDING_MODELS_1104.length), EMBEDDING_MODELS_1104);
  for (const locale of ['en', 'zh']) {
    const html = renderToStaticMarkup(createElement(EmbeddingModelCatalog, { items: EMBEDDING_MODELS_1104, locale }));
    for (const item of EMBEDDING_MODELS_1104) assert.ok(html.includes(`/${locale}/embedding-models/${item.slug}`));
    assert.match(html, /2026-11-04/);
    assert.doesNotMatch(html, /Needs verification/);
  }
});

test('1104 music and video prices map to the verified API model and native units', () => {
  assert.deepEqual(MUREKA_1104.usageRates!.map(r => r.price), [0.045, 0.03, 0.15, 0.045, 0.03, 0.15, 0.3, 0.5]);
  assert.equal(auditedPrice(MUREKA_1104, 'en'), '$0.03–$0.50 / song');
  assert.equal(GROK_VIDEO_1104[0].pricePerUnit, 0.07);
  assert.match(GROK_VIDEO_1104[0].notes!, /1\.0/);
  assert.deepEqual(GROK_VIDEO_1104[1].usageRates!.map(r => r.price), [0.08, 0.14, 0.25]);
  assert.doesNotMatch(auditedPrice(GROK_VIDEO_1104[1], 'en'), /Price not public/);
});

test('1104 keeps INR decision price static (no INR channel row), Terra context tiers, source/date evidence and LongCat access', async () => {
  const f = fakeSeedTx(catalog1104Fixture());
  await seedCatalog20261104(f.tx, true);
  const prism = f.data.models.find(r => r.slug === 'sarvam-prism')!;
  // channel_prices_currency_check has no INR (production rejected it), so no channel row is written.
  assert.equal(f.data.api_channel_prices.some(r => r.model_id === prism.id), false);
  assert.equal(f.data.api_channel_prices.some(r => r.currency === 'INR'), false);
  assert.match(auditedPrice(SARVAM_PRISM_1104, 'en'), /₹4/);
  assert.match(String(prism.description), /state counted once per request/);
  assert.equal(isVerifiedFreeOutput('sarvam-prism', 'sarvam', 4), true);
  assert.equal(isVerifiedFreeOutput('sarvam-prism', 'openrouter', 4), false);
  assert.equal(isVerifiedFreeOutput('sarvam-prism', 'sarvam', 0), false);
  const tiers = f.data.api_channel_price_variants.filter(r => r.variant_key !== 'batch');
  assert.deepEqual(tiers.map(r => [r.input_price_per_1m, r.output_price_per_1m, r.cached_input_price_per_1m, r.is_headline]), [[1, 5, 0.05, true], [2, 7.5, 0.1, false]]);
  assert.deepEqual(tiers[1].constraints_json, { min_input_tokens_exclusive: 272000 });
  assert.equal(f.data.providers.find(r => r.slug === 'meituan')!.access_from_china, true);
  const preview = f.data.models.find(r => r.id === 32)!;
  assert.equal(preview.shutdown_date, '2026-11-06');
  assert.match(String(preview.description), /route to gemini-embedding-2/);
  assert.doesNotMatch(String(preview.description), /2026-08-10/);
  assert.equal(f.data.models.find(r => r.id === 33)!.shutdown_date, '2028-05-14');
  for (const row of f.data.usage_prices.filter(r => r.id !== 42)) {
    assert.match(String(row.source_url), /^https:\/\//);
    assert.equal((row.last_verified as Date).toISOString(), VERIFIED_AT.toISOString());
    assert.ok(Number(row.provider_id) > 0 && Number(row.model_id) > 0);
  }
  for (const item of CATALOG_ITEMS) {
    assert.equal(item.verifiedAt, '2026-11-04');
    assert.ok(item.sourceUrls?.length);
    assert.ok(String(f.data.models.find(r => r.slug === item.slug)!.description).includes(item.sourceUrls![0].url));
  }
});

test('1104 late duplicate/missing/ownership/headline errors abort before every write', async () => {
  const corruptions: ((s: ReturnType<typeof catalog1104Fixture>) => void)[] = [
    s => { s.providers!.push({ id: 9, slug: 'google', type: 'official' }); },
    s => { s.providers![0].type = 'aggregator'; },
    s => { s.models = s.models!.filter(r => r.slug !== 'gpt-6.1-terra'); },
    s => { s.plans![0].provider_id = 2; },
    s => { s.models!.find(r => r.id === 31)!.provider_ids = [3]; },
    s => { s.api_channel_price_variants!.push({ id: 90, model_id: 30, provider_id: 1, variant_key: 'other', is_headline: true }); },
    s => { s.api_channel_price_variants!.push(...[91, 92].map(id => ({ id, model_id: 30, provider_id: 1, variant_key: 'long-context' }))); },
    s => { s.usage_prices!.push(...[93, 94].map(id => ({ id, model_id: 34, provider_id: 3, price_kind: 'grok-imagine-video 1.0 720p', unit: 'second' }))); },
    s => { s.models!.push({ id: 95, slug: 'gemini-embedding-2-preview' }); },
  ];
  for (const corrupt of corruptions) {
    const initial = catalog1104Fixture(); corrupt(initial);
    const f = fakeSeedTx(initial); const before = structuredClone(f.data);
    await assert.rejects(seedCatalog20261104(f.tx, true), /nothing written/i);
    assert.equal(f.writes(), 0);
    assert.deepEqual(f.data, before);
  }
});

test('1104 freshness and availability locks survive updates, including numeric DB read-back', async () => {
  assert.deepEqual(keepFresher({ id: 1, last_verified: '2026-11-04T03:00:00+08:00', notes: 'new' }, { notes: 'old', last_verified: VERIFIED_AT, price: 4 }), { price: 4 });
  const f = fakeSeedTx(catalog1104Fixture());
  await seedCatalog20261104(f.tx, true);
  const variant = f.data.api_channel_price_variants.find(r => r.variant_key === 'long-context')!;
  Object.assign(variant, { input_price_per_1m: '2.0', output_price_per_1m: '7.50', cached_input_price_per_1m: '0.10', is_available: false, availability_locked: true, last_verified: '2026-11-05T00:00:00Z', notes: 'newer scraper evidence' });
  assert.deepEqual(await seedCatalog20261104(f.tx, true), []);
  assert.equal(variant.is_available, false);
  assert.equal(variant.notes, 'newer scraper evidence');
});

test('1104 keeps existing model type, capabilities, official link and description (no field regression)', async () => {
  const fixture = catalog1104Fixture();
  const grok = fixture.models!.find(r => r.slug === 'grok-imagine-video-720p')!;
  Object.assign(grok, { type: 'video', capabilities: ['leaderboard-version', 'text-to-video'], offical_link: 'https://docs.x.ai/docs/guides/video-generations', description: 'Arena AI rank #17.' });
  const f = fakeSeedTx(fixture);
  const steps = await seedCatalog20261104(f.tx, true);
  const change = steps.find(s => s.target === 'grok-imagine-video-720p')!.changes;
  for (const field of ['type', 'capabilities', 'offical_link']) assert.ok(!(field in change), field);
  const row = f.data.models.find(r => r.slug === 'grok-imagine-video-720p')!;
  assert.equal(row.type, 'video');
  assert.deepEqual(row.capabilities, ['leaderboard-version', 'text-to-video']);
  assert.match(String(row.description), /^Arena AI rank #17\.\n/);
  assert.equal(f.data.models.find(r => r.slug === 'eleven-v4')!.type, 'llm');
  assert.deepEqual(await seedCatalog20261104(f.tx, true), []);
});
