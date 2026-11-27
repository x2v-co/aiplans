import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import {
  CAPABILITIES, CHANNEL_NOTES, CHANNEL_SLUG, CONTEXT, LISTED_ON, LOOKUP_SLUGS,
  MAX_INPUT, MAX_OUTPUT, MAX_THINKING_CHAIN, MODEL_FACTS, MODEL_ID, MODEL_PAGE,
  MODEL_SLUG, NEWLY_RELEASED_PAGE, PRICES_CNY, PRICING_PAGE, PRODUCTION_SHAPED_DRY_RUN,
  VERIFIED_AT, VENDOR_SLUG, seedXing1127, seedStepCounts, xingSeedOptions,
} from './catalog-2026-11-27-xing';
import { fakeSeedTx } from './fake-seed-tx';
import { runRehearsable } from '../db/rehearsal';
import { AI_VERTICAL_CATALOG } from '../../src/lib/ai-vertical-catalog';
import { generateOpenRouterSlug } from '../scrapers/openrouter';

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const qwen = { id: 1, slug: CHANNEL_SLUG, name: 'Qwen', type: 'official', notes: 'Existing channel metadata' };
const xing = { id: 2, slug: VENDOR_SLUG, name: '星辰大模型', type: 'producer', notes: 'Curated vendor metadata' };
const fixture = () => fakeSeedTx({ providers: [qwen] });

test('CLI is manual and offline by default, with explicit DB rehearsal and apply modes', () => {
  assert.deepEqual(xingSeedOptions([]), { apply: false, db: false });
  assert.deepEqual(xingSeedOptions(['--dry-run']), { apply: false, db: false });
  assert.deepEqual(xingSeedOptions(['--db']), { apply: false, db: true });
  assert.deepEqual(xingSeedOptions(['--dry-run', '--db']), { apply: false, db: true });
  assert.deepEqual(xingSeedOptions(['--apply']), { apply: true, db: true });
  for (const args of [['--apply', '--dry-run'], ['--force'], ['--apply=true']]) assert.throws(() => xingSeedOptions(args), /Usage/);
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.scripts['seed:catalog-2026-11-27-xing'], 'tsx scripts/seed-catalog-2026-11-27-xing.ts');
  assert.equal(pkg.scripts['seed:catalog-2026-11-27-xing:apply'], 'tsx scripts/seed-catalog-2026-11-27-xing.ts --apply');
  assert.doesNotMatch(read('deploy/production/seed-catalog.sh'), /2026-11-27-xing/);
  const cli = read('scripts/seed-catalog-2026-11-27-xing.ts');
  assert.match(cli, /runRehearsable\(sql, apply, tx => seedXing1127\(tx as unknown as typeof sql, true\)\)/);
  assert.doesNotMatch(cli, /dotenv|postgres-admin|\.env\.local/);
  assert.doesNotMatch(read('scripts/data/catalog-2026-11-27-xing.ts'), /\bDELETE\s+FROM\b/i);
  const result = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/seed-catalog-2026-11-27-xing.ts'], {
    cwd: new URL('../../', import.meta.url), encoding: 'utf8',
    env: { ...process.env, DATABASE_URL: 'invalid-do-not-connect' },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /OFFLINE fakeSeedTx rehearsal/);
  assert.match(result.stdout, /NOT a production dry-run/);
  assert.match(result.stdout, /"api_channel_prices":\s*\{\s*"insert": 1,\s*"update": 0/);
  assert.match(result.stdout, /Not measured against production/);
  const env = { ...process.env };
  delete env.DATABASE_URL;
  const missingUrl = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/seed-catalog-2026-11-27-xing.ts', '--db'], {
    cwd: new URL('../../', import.meta.url), encoding: 'utf8', env,
  });
  assert.equal(missingUrl.status, 1);
  assert.match(missingUrl.stderr, /requires an explicit DATABASE_URL/);
});

test('official identity and source facts stay separate from TeleAI and vertical-model taxonomies', () => {
  assert.equal(MODEL_ID, 'Xing/Xing4.1-Preview');
  assert.equal(generateOpenRouterSlug(MODEL_ID), MODEL_SLUG);
  assert.equal(VENDOR_SLUG, 'xing');
  assert.equal(CHANNEL_SLUG, 'qwen');
  assert.equal(LOOKUP_SLUGS.some(slug => /teleai|4[.-]0/i.test(slug)), false);
  assert.ok(!AI_VERTICAL_CATALOG.some(item => item.slug === MODEL_SLUG));
  assert.deepEqual(PRICES_CNY, { input: 1.5, output: 6, cacheHit: 0.03 });
  assert.deepEqual([CONTEXT, MAX_INPUT, MAX_OUTPUT, MAX_THINKING_CHAIN], [1048576, 917504, 131072, 131072]);
  assert.equal(LISTED_ON, '2026-11-23');
  assert.deepEqual(VERIFIED_AT, new Date('2026-11-27T00:00:00Z'));
  assert.equal(MODEL_PAGE, 'https://help.aliyun.com/zh/model-studio/xing-4-1-preview-by-xing.md');
  assert.ok(MODEL_FACTS.includes(NEWLY_RELEASED_PAGE));
  for (const phrase of ['285B', '17B', 'Ascend', 'Text input and Text output only', 'thinking-mode input/output have the same maxima', '131072', 'Batch inference, web search, prefix continuation, fine-tuning and model playground are unsupported']) assert.ok(MODEL_FACTS.includes(phrase), phrase);
  for (const phrase of ['华北2（北京） only', '思维链和回答', 'Free quota: 无', '0.03', 'cache-hit rate is from the model page', 'Batch inference: 不支持', 'RPM 300; TPM 1,000,000', PRICING_PAGE, MODEL_PAGE]) assert.ok(CHANNEL_NOTES.includes(phrase), phrase);
  assert.doesNotMatch(CHANNEL_NOTES, /50%|10%|0\.15\b|Singapore|Virginia|Frankfurt|Tokyo|Hong Kong/);
});

test('production-shaped fixture inserts exactly vendor/model/channel; preview writes nothing and rerun is empty', async () => {
  const f = fixture();
  assert.deepEqual(seedStepCounts(await seedXing1127(f.tx)), PRODUCTION_SHAPED_DRY_RUN);
  assert.equal(f.writes(), 0);
  assert.deepEqual(seedStepCounts(await seedXing1127(f.tx, true)), PRODUCTION_SHAPED_DRY_RUN);
  assert.equal(f.writes(), 3);
  assert.deepEqual(f.data.providers[0], qwen);
  const vendor = f.data.providers[1];
  assert.equal(vendor.slug, 'xing');
  assert.equal(vendor.name, '星辰大模型');
  assert.equal(vendor.supported_regions, null, 'deployment region is not a supported-country list');
  assert.equal(vendor.website, null);
  assert.equal(f.data.models.length, 1);
  const model = f.data.models[0];
  assert.equal(model.slug, MODEL_SLUG);
  assert.equal(model.name, MODEL_ID);
  assert.equal(model.type, 'llm');
  assert.equal(model.model_category, 'text');
  assert.deepEqual(model.provider_ids, [vendor.id]);
  assert.deepEqual(model.input_type, ['text']);
  assert.deepEqual(model.output_type, ['text']);
  assert.deepEqual(model.input_modalities, ['text']);
  assert.deepEqual(model.output_modalities, ['text']);
  assert.deepEqual(model.capabilities, CAPABILITIES);
  assert.equal(model.context_window, 1048576);
  assert.equal(model.max_output_tokens, 131072);
  assert.equal(model.parameters, '285B');
  assert.equal(model['active parameters'], '17B');
  assert.equal(model.pricing_unit, 'per_1m_tokens');
  assert.equal(model.offical_link, MODEL_PAGE);
  assert.equal(model.description, MODEL_FACTS);
  assert.equal(model.released_at, undefined, 'listing date does not invent a release clock');
  assert.equal(model.open_source, undefined);
  assert.equal(model.license, undefined);
  assert.equal(f.data.api_channel_prices.length, 1);
  const price = f.data.api_channel_prices[0];
  assert.equal(price.model_id, model.id);
  assert.equal(price.provider_id, qwen.id);
  assert.deepEqual([price.input_price_per_1m, price.output_price_per_1m, price.cached_input_price_per_1m], [1.5, 6, 0.03]);
  assert.equal(price.currency, 'CNY');
  assert.equal(price.price_unit, 'per_1m_tokens');
  assert.equal(price.rate_limit, 300);
  assert.equal(price.is_available, true);
  assert.deepEqual(price.last_verified, VERIFIED_AT);
  assert.equal(price.notes, CHANNEL_NOTES);
  for (const key of ['promo_ends_at', 'regular_input_price_per_1m', 'regular_output_price_per_1m', 'regular_cached_input_price_per_1m']) assert.equal(price[key], null);
  assert.equal(price.cache_create_price_per_1m, undefined);
  assert.deepEqual(f.data.usage_prices, []);
  assert.deepEqual(f.data.api_channel_price_variants, [], 'no invented Batch, cache-create or other-region rate');
  // postgres returns bigint columns as strings; this must still be a no-op.
  model.max_output_tokens = '131072';
  assert.deepEqual(await seedXing1127(f.tx, true), []);
  assert.equal(f.writes(), 3);
});

test('existing vendor and unrelated text, TeleAI, image and decision rows and all prices are untouched', async () => {
  // Synthetic isolation fixtures only, not a production dump or verified aliases.
  const other = { id: 3, slug: 'teleai', name: 'TeleAI', type: 'producer' };
  const models = [
    { id: 10, slug: 'teleai-xing4-0', name: 'Xing4.0', provider_ids: [3], type: 'llm' },
    { id: 11, slug: 'other-text-model', provider_ids: [1], type: 'llm' },
    { id: 12, slug: 'other-image-model', type: 'multimodal' },
    { id: 13, slug: 'other-decision-model', type: 'llm', model_category: 'decision' },
  ];
  const prices = models.map(model => ({ id: model.id, model_id: model.id, provider_id: 1, currency: 'CNY', input_price_per_1m: 99 }));
  const usage = [{ id: 20, model_id: 12, provider_id: 1, unit: 'per_image', price: 7 }];
  const variants = [{ id: 21, model_id: 11, provider_id: 1, variant_key: 'other-region' }];
  const f = fakeSeedTx({ providers: [qwen, xing, other], models, api_channel_prices: prices, usage_prices: usage, api_channel_price_variants: variants });
  assert.deepEqual(seedStepCounts(await seedXing1127(f.tx, true)), { ...PRODUCTION_SHAPED_DRY_RUN, providers: { insert: 0, update: 0 } });
  assert.deepEqual(f.data.providers, [qwen, xing, other]);
  assert.deepEqual(f.data.models.slice(0, models.length), models);
  assert.deepEqual(f.data.api_channel_prices.slice(0, prices.length), prices);
  assert.deepEqual(f.data.usage_prices, usage);
  assert.deepEqual(f.data.api_channel_price_variants, variants);
});

test('updates preserve curated fields, locked unavailability and newer channel prices', async () => {
  const f = fixture();
  await seedXing1127(f.tx, true);
  const model = f.data.models[0], price = f.data.api_channel_prices[0];
  model.description = `Curated description\n${MODEL_FACTS}`;
  model.offical_link = 'https://example.test/curated';
  model.capabilities = [...CAPABILITIES, 'curated capability'];
  price.input_price_per_1m = 2;
  price.is_available = false;
  price.availability_locked = true;
  assert.deepEqual(seedStepCounts(await seedXing1127(f.tx, true)), {
    providers: { insert: 0, update: 0 }, models: { insert: 0, update: 0 }, api_channel_prices: { insert: 0, update: 1 },
  });
  assert.equal(price.input_price_per_1m, 1.5);
  assert.equal(price.is_available, false);
  assert.equal(price.availability_locked, true);
  price.input_price_per_1m = 8;
  price.cached_input_price_per_1m = 0.08;
  price.last_verified = new Date('2026-11-28T00:00:00Z');
  price.notes = 'Newer channel evidence';
  assert.deepEqual(await seedXing1127(f.tx, true), []);
  assert.equal(price.input_price_per_1m, 8);
  assert.equal(price.cached_input_price_per_1m, 0.08);
  assert.equal(price.notes, 'Newer channel evidence');
});

test('runRehearsable exercises writes and rolls back by default, and surfaces failures', async () => {
  const f = fixture();
  const before = structuredClone(f.data);
  const log: string[] = [];
  const sql = { async begin(isolation: string, work: (tx: typeof f.tx) => Promise<unknown>) {
    assert.equal(isolation, 'isolation level serializable');
    log.push('BEGIN');
    try { await work(f.tx); log.push('COMMIT'); }
    catch (error) { Object.assign(f.data, structuredClone(before)); log.push('ROLLBACK'); throw error; }
  } };
  const steps = await runRehearsable(sql, false, tx => seedXing1127(tx, true));
  assert.deepEqual(seedStepCounts(steps), PRODUCTION_SHAPED_DRY_RUN);
  assert.equal(f.writes(), 3);
  assert.deepEqual(f.data, before);
  assert.deepEqual(log, ['BEGIN', 'ROLLBACK']);
  await assert.rejects(runRehearsable(sql, false, async () => { throw new Error('constraint failure'); }), /constraint failure/);
});

test('ambiguous, missing, non-canonical and wrong-owner identities fail before any writes', async () => {
  const existing = { id: 10, slug: MODEL_SLUG, provider_ids: [xing.id], type: 'llm', model_category: 'text' };
  const price = { id: 20, model_id: existing.id, provider_id: qwen.id };
  for (const initial of [
    {},
    { providers: [qwen, { ...qwen, id: 4 }] },
    { providers: [qwen, xing, { ...xing, id: 4 }] },
    { providers: [qwen, { ...xing, type: 'aggregator' }] },
    { providers: [qwen, { ...xing, name: 'TeleAI' }] },
    { providers: [{ ...qwen, type: 'reseller' }] },
    { providers: [qwen], models: [{ ...existing, provider_ids: [99] }] },
    { providers: [qwen, xing], models: [{ ...existing, provider_ids: [xing.id, 99] }] },
    { providers: [qwen, xing], models: [existing, { ...existing, id: 11 }] },
    { providers: [qwen, xing], models: [{ ...existing, model_category: 'image' }] },
    { providers: [qwen, xing], models: [existing], api_channel_prices: [price, { ...price, id: 21 }] },
    ...LOOKUP_SLUGS.filter(slug => slug !== MODEL_SLUG).map(slug => ({ providers: [qwen], models: [{ id: 10, slug }] })),
  ]) {
    const f = fakeSeedTx(initial);
    await assert.rejects(seedXing1127(f.tx, true), /nothing written/);
    assert.equal(f.writes(), 0);
  }
});
