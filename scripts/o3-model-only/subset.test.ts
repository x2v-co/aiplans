import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { PAIR, assertPair, canonical } from './adapter';
import { requireO3TestUrl } from './guard';
import { applicationPaths, memoryClient, actualHistorySeries, type Row } from './testing';
import { O3_BATCH_FEED, currentChannelWriteTarget } from '../db/channel-write-target';
import { generateOpenRouterSlug, scrapeOpenRouter } from '../scrapers/openrouter';
import { resolveCatalogIdentity } from '../../src/lib/catalog-identity';
import { resolveSelector } from '../../src/lib/plan-selector';

export function pairTables(merged = true): Record<string, Row[]> {
  return {
    models: [{ id: 3192, slug: 'openai-o3-batch', name: 'o3-batch' }, ...(merged ? [] : [{ id: 3014, slug: 'o3-(batch)', name: 'o3-(batch)' }])],
    model_slug_redirects: merged ? [{ old_slug: 'o3-(batch)', model_id: 3192 }] : [],
    api_channel_prices: [
      { id: 15031, model_id: merged ? 3192 : 3014, provider_id: 59, is_available: false, notes: 'synthetic opaque retained note', input_price_per_1m: 1, output_price_per_1m: 4 },
      { id: 15334, model_id: 3192, provider_id: 59, is_available: true, notes: 'synthetic writer note', input_price_per_1m: 1, output_price_per_1m: 4 },
    ], api_channel_price_variants: [], price_history: [],
  };
}
const result = (upstreamModelId: string | undefined = O3_BATCH_FEED.upstreamModelId) => ({
  success: true, source: 'OpenRouter', prices: [{ upstreamModelId, modelName: 'OpenAI: o3 (batch)',
    modelSlug: generateOpenRouterSlug(O3_BATCH_FEED.upstreamModelId), inputPricePer1M: 2, outputPricePer1M: 8, isAvailable: true }],
});

test('fixed pair and exact canonical approval evidence reject lossy values', () => {
  assertPair(PAIR);
  for (const pair of [{ ...PAIR, sourceId: 1 }, { ...PAIR, targetSlug: 'o3' }, { ...PAIR, approval: true }]) assert.throws(() => assertPair(pair));
  assert.equal(canonical({ b: 1, a: '2026-01-01T00:00:00.123450Z' }), canonical({ a: '2026-01-01T00:00:00.123450Z', b: 1 }));
  assert.throws(() => canonical(new Date()), /timestamps/);
  assert.throws(() => canonical(Number.MAX_SAFE_INTEGER + 1));
  assert.notEqual(canonical('2026-01-01T00:00:00.123450Z'), canonical('2026-01-01T00:00:00.123456Z'));
});

test('native test URL guard rejects absent/nonlocal/other-port/other-name/URL parameter paths', () => {
  const driver = readFileSync(new URL('./postgres.integration.ts', import.meta.url), 'utf8');
  // DB-free regression: strip the inet netmask in SQL while retaining exact identity assertions.
  assert.match(driver, /SELECT current_database\(\) AS name,HOST\(inet_server_addr\(\)\) AS host,inet_server_port\(\) AS port/);
  assert.match(driver, /assert\.equal\(identity\.name, new URL\(url\)\.pathname\.slice\(1\)\)/);
  assert.match(driver, /assert\.equal\(identity\.host, '127\.0\.0\.1'\)/);
  assert.match(driver, /assert\.equal\(identity\.port, 55439\)/);
  const valid = 'postgres://dedupe54@127.0.0.1:55439/dedupe54_test_o3_0438';
  assert.equal(requireO3TestUrl(valid), valid);
  for (const value of [undefined, valid.replace('127.0.0.1', 'localhost'), valid.replace('55439', '5432'),
    valid.replace('dedupe54_test_o3_0438', 'planprice'), valid + '?host=example.test', valid + '#x', valid.replace('_0438', '-prod')]) {
    assert.throws(() => requireO3TestUrl(value));
  }
});

test('actual current upsert and history pipeline continue cp15334 before/after merge; retained quote is byte/value exact', async () => {
  for (const merged of [false, true]) {
    const tables = pairTables(merged); const source = structuredClone(tables.api_channel_prices[0]);
    const memory = memoryClient(tables); const app = applicationPaths(memory.db);
    assert.equal((await app.run(result())).errors, 0);
    assert.deepEqual(tables.api_channel_prices[0], source);
    assert.equal(tables.api_channel_prices.length, 2);
    assert.equal(tables.api_channel_prices[1].input_price_per_1m, 2);
    assert.equal(tables.price_history.length, 1);
    assert.equal(tables.price_history[0].channel_price_id, 15334);
    assert.equal((await app.run(result())).errors, 0);
    assert.equal(tables.price_history.length, 1);
  }
});

test('unbound/wrong-feed multirow and all binding drifts write nothing and suppress unseen retirement', async () => {
  const cases: Array<{ feed?: string; change: (t: Record<string, Row[]>) => void }> = [
    { feed: 'openai/o3', change: () => {} },
    { change: t => { t.api_channel_prices.push({ ...t.api_channel_prices[1], id: 99999 }); } },
    { change: t => { t.models[0].slug = 'ordinary-o3'; } },
    { change: t => { t.api_channel_prices[0].is_available = true; } },
    { change: t => { t.api_channel_prices[1].id = 99999; } },
  ];
  for (const { feed, change } of cases) {
    const tables = pairTables(); change(tables);
    const memory = memoryClient(tables); const app = applicationPaths(memory.db);
    const response = await app.run(result(feed), true);
    await assert.rejects(currentChannelWriteTarget(memory.db, 3192, 59), /Ambiguous/);
    assert.equal(response.errors, 1);
    assert.deepEqual(memory.mutations, []); assert.equal(app.retirements(), 0);
  }
});

test('unbound source writes before merge cannot reactivate retained channel15031', async () => {
  const tables = pairTables(false); const memory = memoryClient(tables); const app = applicationPaths(memory.db);
  const input = result('unreviewed/feed'); input.prices[0].modelSlug = 'o3-(batch)';
  assert.equal((await app.run(input, true, true)).errors, 1);
  await assert.rejects(app.upsertChannelPrice({model_id:3014,provider_id:59,input_price_per_1m:2,output_price_per_1m:8,is_available:true}), /Retained/);
  assert.deepEqual(memory.mutations, []); assert.equal(app.retirements(), 0);
});

test('fixed target also requires reviewed feed before merge or when its quote is missing', async () => {
  for (const missing of [false, true]) {
    const tables = pairTables(false);
    if (missing) tables.api_channel_prices = tables.api_channel_prices.filter(row => row.id !== 15334);
    const memory = memoryClient(tables); const app = applicationPaths(memory.db);
    assert.equal((await app.run(result('unreviewed/feed'), true, true)).errors, 1);
    assert.deepEqual(memory.mutations, []); assert.equal(app.retirements(), 0);
  }
});

test('bound feed verifies retained channel provider/model identity even when it leaves the candidate pair', async () => {
  for (const changed of [{ provider_id: 60 }, { model_id: 4000 }]) {
    const tables = pairTables(); Object.assign(tables.api_channel_prices[0], changed);
    const memory = memoryClient(tables); const app = applicationPaths(memory.db);
    assert.equal((await app.run(result(), true)).errors, 1);
    assert.deepEqual(memory.mutations, []); assert.equal(app.retirements(), 0);
  }
});

test('read and update failures propagate through actual scrape result without insert/history/retirement; ordinary single/absent writers still work', async () => {
  for (const fail of ['failRead', 'failWrite'] as const) {
    const memory = memoryClient(pairTables()); const app = applicationPaths(memory.db); memory[fail]();
    assert.equal((await app.run(result(), true)).errors, 1);
    assert.equal(app.retirements(), 0); assert.deepEqual(memory.mutations, []);
  }
  const tables = pairTables(); const memory = memoryClient(tables); const app = applicationPaths(memory.db);
  const data = { model_id: 4000, provider_id: 60, input_price_per_1m: 1, output_price_per_1m: 3, is_available: true, last_verified: new Date() };
  await app.upsertChannelPrice(data); await app.upsertChannelPrice({ ...data, input_price_per_1m: 2 });
  assert.equal(tables.api_channel_prices.filter(row => row.model_id === 4000).length, 1);
});

test('ordinary missing and single model scrape/seed paths retain their behavior', async () => {
  const tables = pairTables(); tables.providers = [{ id: 33, slug: 'openai' }];
  const memory = memoryClient(tables); const app = applicationPaths(memory.db);
  const input = { success: true, source: 'OpenRouter', prices: [{ producerSlug: 'openai', modelSlug: 'gpt-4o',
    modelName: 'GPT-4o', inputPricePer1M: 2, outputPricePer1M: 8, isAvailable: true }] };
  assert.equal((await app.run(input, false, true)).errors, 0);
  const ordinary = tables.models.find(row => row.slug === 'gpt-4o'); assert.ok(ordinary);
  assert.equal((await app.run(input, false, true)).errors, 0);
  assert.equal(tables.models.filter(row => row.slug === 'gpt-4o').length, 1);
  assert.equal(tables.api_channel_prices.filter(row => row.model_id === ordinary.id).length, 1);
});

test('raw source alias resolves through real getOrCreate before lossy normalization and refuses missing/rebound aliases', async () => {
  for (const merged of [false, true]) {
    const tables = pairTables(merged); const memory = memoryClient(tables); const app = applicationPaths(memory.db);
    const model = await app.getOrCreateProduct({ slug: 'o3-(batch)', name: 'o3-(batch)', type: 'llm' });
    assert.equal(model.id, merged ? 3192 : 3014); assert.deepEqual(memory.mutations, []);
  }
  const tables = pairTables(); tables.model_slug_redirects = [];
  const memory = memoryClient(tables); const app = applicationPaths(memory.db);
  await assert.rejects(app.getOrCreateProduct({ slug: 'o3-(batch)', name: 'o3-(batch)', type: 'llm' }), /creation refused/);
  assert.deepEqual(memory.mutations, []);
});

test('source spelling on the real scrape path follows its exact alias before normalization', async () => {
  const tables = pairTables(); const memory = memoryClient(tables); const app = applicationPaths(memory.db);
  const input = result(); input.prices[0].modelSlug = 'o3-(batch)';
  assert.equal((await app.run(input)).errors, 0);
  assert.equal(tables.models.length, 1); assert.equal(tables.api_channel_prices.length, 2);
  assert.equal(tables.price_history[0].channel_price_id, 15334);
  for (const aliases of [[{ old_slug:'o3-(batch)', model_id:4000 }],
    [{ old_slug:'o3-(batch)', model_id:3192 }, { old_slug:'o3-(batch)', model_id:3192 }]]) {
    const refused = pairTables(); refused.model_slug_redirects = aliases;
    const db = memoryClient(refused); const paths = applicationPaths(db.db);
    assert.equal((await paths.run(input, true, true)).errors, 1);
    assert.deepEqual(db.mutations, []); assert.equal(paths.retirements(), 0);
  }
});

test('bound feed history insertion failure propagates to result and blocks unseen retirement', async () => {
  const tables = pairTables(); const memory = memoryClient(tables); const app = applicationPaths(memory.db);
  memory.failHistory();
  const response = await app.run(result(), true);
  assert.equal(response.errors, 1); assert.equal(app.retirements(), 0);
  assert.equal(tables.price_history.length, 0);
  assert.deepEqual(memory.mutations, ['api_channel_prices:update']);
  // Existing application upsert+history are separate transactions; an update
  // can precede a history failure. This test promises error propagation only.
});

test('actual variant batch rejection blocks both unseen retirement paths', async () => {
  const tables = pairTables(); const memory = memoryClient(tables); const app = applicationPaths(memory.db);
  const input = { ...result(), variants: [{ modelSlug:'openai-o3-batch', modelName:'o3-batch',
    variantKey:'invalid', variantName:'Invalid', inputPricePer1M:-1, outputPricePer1M:8, isAvailable:true }] };
  assert.equal((await app.run(input, true)).errors, 1);
  assert.ok(app.errors.some(error => error.includes('batchUpsertChannelPriceVariants: negative price rejected')));
  assert.equal(app.retirements(), 0); assert.equal(tables.api_channel_price_variants.length, 0);
});

test('existing selector excludes both batch identities from automatic subscription selection', () => {
  for (const merged of [false, true]) {
    const catalog = pairTables(merged).models.map(row => ({ id: row.id, slug: row.slug, providerSlugs: ['openai'], elo: null }));
    assert.equal(resolveSelector({ providers: ['openai'] }, catalog).models.length, 0);
    assert.equal(resolveSelector({ families: ['o3'], providers: ['openai'] }, catalog).models.length, 0);
  }
});

test('actual OpenRouter parser preserves exact upstream feed identity alongside existing normalized slug', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async input => new Response(JSON.stringify(String(input).endsWith('/endpoints') ? { data: { endpoints: [] } }
    : { data: [{ id: 'openai/o3:batch', name: 'OpenAI: o3 (batch)', context_length: 200000, pricing: { prompt: '0.000001', completion: '0.000004' } }] }), { status: 200 });
  try {
    const parsed = await scrapeOpenRouter();
    assert.equal(parsed.success, true);
    assert.equal(parsed.prices[0].upstreamModelId, 'openai/o3:batch');
    assert.equal(parsed.prices[0].modelSlug, 'openai-o3-batch');
  } finally { globalThis.fetch = original; }
});

test('actual chart computation has no new provider/currency collision when source OFF has zero history', () => {
  const history = Array.from({ length: 71 }, (_, index) => ({ channelPriceId: 15334, providerSlug: 'openrouter',
    providerName: 'OpenRouter', recordedAt: `2026-11-${String(index % 16 + 1).padStart(2, '0')}T00:00:00.123456Z`,
    newInputPrice: 1 + index / 100, newOutputPrice: 4, currency: 'USD' }));
  const before = actualHistorySeries(history);
  const after = actualHistorySeries(structuredClone(history)); // IDs/history/availability do not change.
  assert.equal(before.seriesMeta.length, 1);
  assert.equal(after.seriesMeta.length, 1);
  assert.equal(JSON.stringify(before.series), JSON.stringify(after.series));
  // General two-offer chart ambiguity remains a blocker outside this pair's preconditions.
  const future = actualHistorySeries([...history, { ...history[0], channelPriceId: 15031, newInputPrice: 9 }]);
  assert.equal(future.seriesMeta.length, 1);
});
