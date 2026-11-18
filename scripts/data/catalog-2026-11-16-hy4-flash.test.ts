import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { effectivePrice } from '../../src/lib/effective-price';
import { runRehearsable, RehearsalRollback } from '../db/rehearsal';
import { fakeSeedTx, type FakeRow } from './fake-seed-tx';
import {
  CHANNEL_NOTES, CHINA_MODELS, CHINA_PRICES, FLASH_API_ID, FLASH_FACTS, FLASH_SLUG,
  INTERNATIONAL_PRICES, LOOKUP_SLUGS, PREVIEW_NOTICE, PREVIEW_SLUG, PROMO_ENDS_AT,
  USD_CURRENT, USD_LIST, VERIFIED_AT, flashChannelRow, flashModelRow, hy4FlashSeedOptions, seedHy4Flash,
} from './catalog-2026-11-16-hy4-flash';

function fixture(flash = false) {
  const db = fakeSeedTx({
    providers: [
      { id: 7, slug: 'tencent', name: 'Tencent', type: 'producer', notes: 'keep producer' },
      { id: 8, slug: 'openrouter', type: 'aggregator' },
      { id: 9, slug: 'other-producer', type: 'official' },
    ],
    models: [
      { id: 20, slug: PREVIEW_SLUG, name: 'Hy4 Preview', type: 'llm', model_category: 'text',
        provider_ids: [7, 8], description: 'Original Preview description.\n', shutdown_date: null,
        deprecated_at: null, replacement_model: null, deprecation_source_url: null,
        updated_at: new Date('2026-11-04T10:00:00Z'), capabilities: ['reasoning'], license: 'existing preview metadata' },
      { id: 21, slug: 'tencent-hy4', name: 'Hy4', type: 'llm', model_category: 'text', provider_ids: [7],
        description: 'GA metadata', shutdown_date: null, context_window: 1_048_576, max_output_tokens: '65536' },
      ...(flash ? [{ ...flashModelRow(7), id: 22, description: 'Existing Flash metadata',
        capabilities: ['extra capability'], features: ['keep me'], parameters: 'existing parameter evidence' }] : []),
    ],
    api_channel_prices: [
      { id: 30, model_id: 20, provider_id: 7, input_price_per_1m: 0.834, output_price_per_1m: 2.501,
        is_available: true, currency: 'USD', promo_ends_at: new Date('2026-12-31T15:59:59Z') },
      { id: 31, model_id: 20, provider_id: 8, input_price_per_1m: 0.417, output_price_per_1m: 1.251,
        is_available: false, availability_locked: true },
      { id: 32, ...flashChannelRow(21, 7), notes: 'GA price evidence' },
      ...(flash ? [{ ...flashChannelRow(22, 7), id: 33, input_price_per_1m: 0.06,
        notes: 'Keep unrelated channel note.', last_verified: new Date('2026-11-15T00:00:00Z'),
        rate_limit: 987, data_for_discount: false, data_for_discount_note: 'keep', quota_unit: 'usd' }] : []),
    ],
    api_channel_price_variants: [{ id: 40, model_id: 20, provider_id: 8, variant_key: 'preview', input_price_per_1m: 1 }],
    usage_prices: [{ id: 41, model_id: 21, price: 1, constraints_json: { z: 1, a: 2 } }],
    plans: [{ id: 42, name: 'Unrelated plan', price: 10 }],
    model_plan_mapping: [{ id: 43, model_id: 21, plan_id: 42 }],
  });
  return db;
}

test('planning has the exact independent insert/channel/Preview-description shape and zero writes', async () => {
  const db = fixture();
  const before = structuredClone(db.data);
  const steps = await seedHy4Flash(db.tx);
  assert.deepEqual(steps.map(s => [s.table, s.target, s.action]), [
    ['models', FLASH_SLUG, 'insert'], ['api_channel_prices', `tencent/${FLASH_SLUG}`, 'insert'],
    ['models', PREVIEW_SLUG, 'update'],
  ]);
  const desired = (index: number) => Object.fromEntries(Object.entries(steps[index].changes).map(([key, change]) => [key, change.to]));
  assert.deepEqual(desired(0), flashModelRow(7));
  assert.deepEqual(desired(1), flashChannelRow(-1, 7));
  assert.deepEqual(desired(2), { description: before.models[0].description + '\n\n' + PREVIEW_NOTICE });
  assert.equal(db.writes(), 0);
  assert.deepEqual(db.data, before);
});

test('fake apply inserts only Flash and USD, appends Preview once, preserves all lifecycle/prices/GA and unrelated tables', async () => {
  const db = fixture();
  const before = structuredClone(db.data);
  await seedHy4Flash(db.tx, true);
  assert.equal(db.writes(), 3);
  const model = db.data.models.find(row => row.slug === FLASH_SLUG)!;
  assert.deepEqual(model, { ...flashModelRow(7), id: model.id });
  const channel = db.data.api_channel_prices.find(row => row.model_id === model.id)!;
  assert.deepEqual(channel, { ...flashChannelRow(model.id, 7), id: channel.id });
  assert.deepEqual(db.data.models.find(row => row.id === 20), { ...before.models[0], description: String(before.models[0].description) + '\n\n' + PREVIEW_NOTICE });
  assert.deepEqual(db.data.models.find(row => row.id === 21), before.models[1]);
  assert.deepEqual(db.data.api_channel_prices.filter(row => row.model_id !== model.id), before.api_channel_prices);
  for (const table of ['providers', 'api_channel_price_variants', 'usage_prices', 'plans', 'model_plan_mapping']) {
    assert.deepEqual(db.data[table], before[table], table);
  }
  assert.deepEqual(await seedHy4Flash(db.tx, true), []);
  assert.equal(db.writes(), 3);
});

test('existing model/channel update preserves extra metadata, notes and memberships, then re-runs to zero', async () => {
  const db = fixture(true);
  const before = structuredClone(db.data.models.find(row => row.id === 22)!);
  const steps = await seedHy4Flash(db.tx, true);
  assert.deepEqual(steps.map(s => [s.table, s.action]), [['models', 'update'], ['api_channel_prices', 'update'], ['models', 'update']]);
  const model = db.data.models.find(row => row.id === 22)!;
  assert.deepEqual(model.features, before.features);
  assert.equal(model.parameters, before.parameters);
  assert.deepEqual(model.provider_ids, before.provider_ids);
  assert.deepEqual(model.capabilities, ['extra capability', 'reasoning', 'tool-calling', 'structured-outputs', 'vision']);
  assert.equal(model.description, 'Existing Flash metadata\n\n' + FLASH_FACTS);
  const channel = db.data.api_channel_prices.find(row => row.id === 33)!;
  assert.equal(channel.notes, 'Keep unrelated channel note.\n\n' + CHANNEL_NOTES);
  assert.equal(channel.rate_limit, 987);
  assert.equal(channel.data_for_discount, false);
  assert.equal(channel.data_for_discount_note, 'keep');
  assert.equal(channel.quota_unit, 'usd');
  assert.deepEqual(await seedHy4Flash(db.tx, true), []);
});

test('numeric strings, real storage precision, timestamp strings/Dates and reordered unrelated JSONB produce no false changes', async () => {
  const db = fixture();
  await seedHy4Flash(db.tx, true);
  const model = db.data.models.find(row => row.slug === FLASH_SLUG)!;
  model.context_window = '1000000';
  const channel = db.data.api_channel_prices.find(row => row.model_id === model.id)!;
  for (const key of Object.keys(channel).filter(key => /price_per_1m$/.test(key))) {
    channel[key] = String(Math.fround(Number(channel[key])));
  }
  channel.last_verified = VERIFIED_AT.toISOString();
  channel.promo_ends_at = '2026-11-30T12:00:00+08:00';
  db.data.usage_prices[0].constraints_json = { a: 2, z: 1 };
  assert.deepEqual(await seedHy4Flash(db.tx, true), []);
  channel.last_verified = new Date(VERIFIED_AT);
  channel.promo_ends_at = new Date(PROMO_ENDS_AT);
  assert.deepEqual(await seedHy4Flash(db.tx, true), []);
  // A real, representable price change must still be repaired.
  channel.output_price_per_1m = 0.1406;
  assert.ok((await seedHy4Flash(db.tx)).some(s => 'output_price_per_1m' in s.changes));
});

test('promotion restores directory input/output/cache-read exactly at the Beijing-to-UTC cutoff', () => {
  const row = flashChannelRow(1, 7);
  assert.equal(PROMO_ENDS_AT.toISOString(), '2026-11-30T04:00:00.000Z');
  assert.equal(new Date('2026-11-30T12:00:00+08:00').getTime(), PROMO_ENDS_AT.getTime());
  const prices = (r: typeof row) => [r.input_price_per_1m, r.output_price_per_1m, r.cached_input_price_per_1m];
  assert.deepEqual(prices(effectivePrice(row, new Date(PROMO_ENDS_AT.getTime() - 1))), [0.035, 0.1405, 0.0015]);
  for (const offset of [0, 1, 86400000]) {
    assert.deepEqual(prices(effectivePrice(row, new Date(PROMO_ENDS_AT.getTime() + offset))), [0.07, 0.281, 0.003]);
  }
  for (const key of ['input', 'output', 'cacheRead'] as const) assert.equal(USD_CURRENT[key], USD_LIST[key] * 0.5);
  assert.ok(!('cache_create_price_per_1m' in row));
  assert.ok(!('promo_starts_at' in row));
});

test('source notes scope CNY and derived discounts, unknown cache write/start/64k, and planned open weights', () => {
  assert.equal(FLASH_API_ID, 'hy4-flash');
  const row = flashModelRow(7);
  assert.equal(row.max_output_tokens, null);
  assert.equal(row.open_source, null);
  assert.equal(row.license, null);
  assert.deepEqual(row.input_modalities, ['text', 'image']);
  assert.deepEqual(row.output_modalities, ['text']);
  assert.match(FLASH_FACTS, /max input 960k, max output 64k/);
  assert.match(FLASH_FACTS, /planned, not verified released/);
  assert.match(CHANNEL_NOTES, /Only actual usage/);
  assert.match(CHANNEL_NOTES, /precise start instant unknown/);
  assert.match(CHANNEL_NOTES, /Cache WRITE.*dashes/);
  assert.match(CHANNEL_NOTES, /CNY.*list input 0\.5, output 2, cache HIT\/read 0\.02/);
  assert.match(CHANNEL_NOTES, /derived 50% current input 0\.25, output 1, cache read 0\.01/);
  assert.match(CHANNEL_NOTES, /variants has no promo\/regular fields/);
  for (const url of [INTERNATIONAL_PRICES, CHINA_PRICES]) assert.ok(CHANNEL_NOTES.includes(url));
  assert.ok(PREVIEW_NOTICE.includes(CHINA_MODELS));
  assert.match(PREVIEW_NOTICE, /without a dated international cutoff/);
  assert.match(PREVIEW_NOTICE, /2026-12-07下线/);
  assert.match(PREVIEW_NOTICE, /not assumed universal/);
});

test('every alias fails independently, including case/separators/name aliases, before any writes', async () => {
  for (const slug of [...LOOKUP_SLUGS.filter(slug => slug !== FLASH_SLUG), ' TENCENT/Hy4_Flash ', 'tencent-hunyuan-hy4_flash']) {
    const db = fixture();
    db.data.models.push({ ...flashModelRow(7), slug, id: 99 });
    await assert.rejects(seedHy4Flash(db.tx, true), /Noncanonical.*nothing written/);
    assert.equal(db.writes(), 0, slug);
  }
  const db = fixture();
  db.data.models.push({ ...flashModelRow(7), slug: 'unanticipated-slug', name: 'Hy4 Flash', id: 99 });
  await assert.rejects(seedHy4Flash(db.tx, true), /Noncanonical/);
  assert.equal(db.writes(), 0);
});

test('all ambiguity, type, ownership, missing-provider/Preview and wrong-channel guards fail before writes', async () => {
  const cases: Array<(data: Record<string, FakeRow[]>) => void> = [
    data => { data.providers = data.providers.filter(row => row.id !== 7); },
    data => { data.providers[0].type = 'aggregator'; },
    data => { data.providers.push({ ...data.providers[0], id: 77 }); },
    data => { data.models = data.models.filter(row => row.id !== 20); },
    data => { data.models.push({ ...data.models[0], id: 88 }); },
    data => { data.models[0].type = 'subscription'; },
    data => { data.models[0].provider_ids = [9]; },
    data => { data.models.find(row => row.id === 22)!.type = 'multimodal'; },
    data => { data.models.find(row => row.id === 22)!.model_category = 'image'; },
    data => { data.models.find(row => row.id === 22)!.provider_ids = [9]; },
    data => { data.models.find(row => row.id === 22)!.provider_ids = [7, 9]; },
    data => { data.models.find(row => row.id === 22)!.provider_ids = [7, 999]; },
    data => { data.models.push({ ...flashModelRow(7), id: 99 }); },
    data => { data.models.push({ ...flashModelRow(7), slug: 'hy4-flash', id: 99 }); },
    data => { data.api_channel_prices.push({ ...data.api_channel_prices.find(row => row.id === 33)!, id: 99 }); },
    data => { data.api_channel_prices.find(row => row.id === 33)!.currency = 'CNY'; },
    data => { data.api_channel_prices.find(row => row.id === 33)!.price_unit = 'per_token'; },
    data => { data.api_channel_prices.find(row => row.id === 33)!.last_verified = 'invalid'; },
  ];
  for (const mutate of cases) {
    const db = fixture(true);
    mutate(db.data);
    const before = structuredClone(db.data);
    await assert.rejects(seedHy4Flash(db.tx, true), /nothing written/);
    assert.equal(db.writes(), 0);
    assert.deepEqual(db.data, before);
  }
});

test('fresher evidence protects the whole USD row including conflicting promo/notes/availability', async () => {
  for (const timestamp of [new Date(VERIFIED_AT.getTime() + 1), '2026-11-17T00:00:00Z']) {
    const db = fixture(true);
    const channel = db.data.api_channel_prices.find(row => row.id === 33)!;
    Object.assign(channel, { last_verified: timestamp, input_price_per_1m: 1, output_price_per_1m: 2,
      cached_input_price_per_1m: 0.5, regular_input_price_per_1m: 7,
      promo_ends_at: new Date('2027-01-01T00:00:00Z'), notes: 'Fresher evidence', is_available: false });
    const before = structuredClone(channel);
    const steps = await seedHy4Flash(db.tx, true);
    assert.ok(steps.every(s => s.table !== 'api_channel_prices'));
    assert.deepEqual(channel, before);
    assert.deepEqual(await seedHy4Flash(db.tx, true), []);
  }
});

test('locked and other unavailable official rows remain unavailable and retain their metadata', async () => {
  for (const locked of [true, false]) {
    const db = fixture(true);
    const channel = db.data.api_channel_prices.find(row => row.id === 33)!;
    channel.is_available = false;
    channel.availability_locked = locked;
    await seedHy4Flash(db.tx, true);
    assert.equal(channel.is_available, false);
    assert.equal(channel.availability_locked, locked);
    assert.equal(channel.input_price_per_1m, 0.035);
    assert.deepEqual(await seedHy4Flash(db.tx, true), []);
  }
});

test('Preview description appends idempotently for null, empty and existing text, preserving every other field', async () => {
  for (const description of [null, '', 'Custom description\n\n', PREVIEW_NOTICE, 'Existing\n\n' + PREVIEW_NOTICE]) {
    const db = fixture();
    const preview = db.data.models[0];
    preview.description = description;
    preview.shutdown_date = '2027-01-02';
    preview.deprecated_at = '2026-11-01';
    preview.replacement_model = 'Existing replacement';
    const before = structuredClone(preview);
    await seedHy4Flash(db.tx, true);
    const expected = String(description ?? '').includes(PREVIEW_NOTICE)
      ? description : (description ? description + '\n\n' : '') + PREVIEW_NOTICE;
    assert.deepEqual(preview, { ...before, description: expected });
    assert.deepEqual(await seedHy4Flash(db.tx, true), []);
  }
});

test('manual CLI defaults to runRehearsable rollback, explicit apply is separate, and CI registers the fixture', async () => {
  assert.deepEqual(hy4FlashSeedOptions([]), { apply: false });
  assert.deepEqual(hy4FlashSeedOptions(['--dry-run']), { apply: false });
  assert.deepEqual(hy4FlashSeedOptions(['--apply']), { apply: true });
  for (const args of [['--apply', '--dry-run'], ['--force'], ['--apply=true']]) assert.throws(() => hy4FlashSeedOptions(args));
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.scripts['seed:catalog-2026-11-16-hy4-flash'], 'tsx scripts/seed-catalog-2026-11-16-hy4-flash.ts');
  assert.equal(pkg.scripts['seed:catalog-2026-11-16-hy4-flash:apply'], 'tsx scripts/seed-catalog-2026-11-16-hy4-flash.ts --apply');
  assert.ok(pkg.scripts['test:db'].includes('scripts/db/catalog-2026-11-16-hy4-flash-postgres.test.ts'));
  const cli = readFileSync(new URL('../seed-catalog-2026-11-16-hy4-flash.ts', import.meta.url), 'utf8');
  assert.match(cli, /runRehearsable\(sql, apply, tx => seedHy4Flash\([^\n]+true\)\)/);
  for (const file of ['../../deploy/production/seed-catalog.sh', '../../deploy/production/rollout.sh', '../../.github/workflows/seed-catalog.yml']) {
    assert.ok(!readFileSync(new URL(file, import.meta.url), 'utf8').includes('2026-11-16-hy4-flash'));
  }
  // Exercise the rollback hook with a caller-owned fake transaction; never the CLI/admin import.
  for (const apply of [false, true]) {
    const db = fixture();
    const events: string[] = [];
    const sql = { begin: async (isolation: string, work: (tx: typeof db.tx) => Promise<unknown>) => {
      assert.equal(isolation, 'isolation level serializable');
      try { await work(db.tx); events.push('commit'); }
      catch (error) { assert.ok(error instanceof RehearsalRollback); events.push('rollback'); throw error; }
    } };
    const result = await runRehearsable(sql, apply, tx => seedHy4Flash(tx, true));
    assert.equal(result.length, 3);
    assert.equal(db.writes(), 3);
    assert.deepEqual(events, [apply ? 'commit' : 'rollback']);
  }
});
