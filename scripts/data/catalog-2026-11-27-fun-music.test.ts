import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AuditedPricingFacts } from '../../src/components/audited-catalog';
import {
  BILLING_RULE, FUN_MUSIC_CATALOG, FUN_MUSIC_MODELS, INVITE_NOTE, NEWLY_RELEASED_PAGE,
  PRICING_PAGE, QUOTA_VALIDITY, TICKET_URL,
} from '../../src/lib/catalog-2026-11-27-fun-music';
import { AI_VERTICAL_CATALOG, catalogForKind } from '../../src/lib/ai-vertical-catalog';
import { PRODUCTION_SHAPED_DRY_RUN, VERIFIED_AT, funMusicSeedOptions, seedFunMusic1127, seedStepCounts } from './catalog-2026-11-27-fun-music';
import { fakeSeedTx } from './fake-seed-tx';
import { runRehearsable } from '../db/rehearsal';

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const qwen = { id: 1, slug: 'qwen', name: 'Qwen', type: 'official', notes: 'Curated channel metadata' };
const fixture = () => fakeSeedTx({ providers: [qwen] });
const cli = 'scripts/seed-catalog-2026-11-27-fun-music.ts';

test('manual CLI defaults offline, only --apply commits and deploy does not invoke it', () => {
  for (const args of [[], ['--dry-run']]) assert.deepEqual(funMusicSeedOptions(args), { apply: false, db: false });
  for (const args of [['--db'], ['--db', '--dry-run']]) assert.deepEqual(funMusicSeedOptions(args), { apply: false, db: true });
  assert.deepEqual(funMusicSeedOptions(['--apply']), { apply: true, db: true });
  for (const args of [['--apply', '--dry-run'], ['--force'], ['--apply=true']]) assert.throws(() => funMusicSeedOptions(args), /Usage/);
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.scripts['seed:catalog-2026-11-27-fun-music'], `tsx ${cli}`);
  assert.equal(pkg.scripts['seed:catalog-2026-11-27-fun-music:apply'], `tsx ${cli} --apply`);
  assert.doesNotMatch(read('deploy/production/seed-catalog.sh'), /2026-11-27-fun-music/);
  assert.match(read(cli), /runRehearsable\(sql, apply, tx => seedFunMusic1127\(tx as unknown as typeof sql, true\)\)/);
  assert.doesNotMatch(read(cli), /dotenv|postgres-admin|\.env\.local/);
  assert.doesNotMatch(read('scripts/data/catalog-2026-11-27-fun-music.ts'), /\bDELETE\s+FROM\b/i);
  const result = spawnSync(process.execPath, ['--import', 'tsx', cli], {
    cwd: new URL('../../', import.meta.url), encoding: 'utf8', env: { ...process.env, DATABASE_URL: 'invalid-do-not-connect' },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /OFFLINE fakeSeedTx rehearsal/);
  assert.match(result.stdout, /NOT a production dry-run/);
  assert.match(result.stdout, /"usage_prices":\s*\{\s*"insert": 2,\s*"update": 0/);
  assert.match(result.stdout, /Not measured against production/);
  const env = { ...process.env };
  delete env.DATABASE_URL;
  const missing = spawnSync(process.execPath, ['--import', 'tsx', cli, '--db'], {
    cwd: new URL('../../', import.meta.url), encoding: 'utf8', env,
  });
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /requires an explicit DATABASE_URL/);
});

test('two music catalog identities retain official Beijing CNY prices, sources, quotas and invite-only copy', () => {
  assert.deepEqual(FUN_MUSIC_MODELS.map(m => [m.id, m.price, m.freeSeconds, m.listedOn]), [
    ['fun-music-preview', 0.005, 0, '2026-06-01'], ['fun-music-v1', 0.002, 1000, '2026-05-06'],
  ]);
  for (const [i, item] of FUN_MUSIC_CATALOG.entries()) {
    assert.equal(AI_VERTICAL_CATALOG.filter(row => row.slug === item.slug).length, 1);
    assert.ok(catalogForKind('music-model').some(row => row.slug === item.slug));
    assert.equal(item.modelCategory, 'music');
    assert.equal(item.status, 'waitlist');
    assert.equal(item.providerSlug, 'qwen');
    assert.equal(item.pricingProviderSlug, 'qwen');
    assert.equal(item.billingUnit, 'per_second');
    assert.equal(item.pricingUnit, 'per_second');
    assert.equal(item.currency, 'CNY');
    assert.deepEqual(item.inputModalities, ['text']);
    assert.deepEqual(item.outputModalities, ['audio', 'music']);
    assert.deepEqual(item.usageRates, [{ priceKind: 'audio_second', unit: 'second', price: FUN_MUSIC_MODELS[i].price }]);
    for (const phrase of [INVITE_NOTE, TICKET_URL, BILLING_RULE, FUN_MUSIC_MODELS[i].listedOn]) assert.ok(item.notes!.includes(phrase), phrase);
    assert.equal(item.lastVerified, '2026-11-27');
    assert.equal(item.releasedAt, undefined, 'listing dates are not release timestamps');
    assert.deepEqual(item.sourceUrls!.map(source => source.url), [PRICING_PAGE, NEWLY_RELEASED_PAGE]);
    assert.equal(item.url, PRICING_PAGE, 'no invented dedicated model page');
    assert.equal(item.deferredDbSeed, true);
    assert.equal(item.deferredDbSeedScript, 'seed:catalog-2026-11-27-fun-music:apply');
    assert.doesNotMatch(JSON.stringify(item), /0\.000695|0\.000275|USD|RPM|TPM|50%/);
  }
  assert.ok(FUN_MUSIC_CATALOG[1].notes!.includes(QUOTA_VALIDITY));
});

test('rendered pricing retains the invite note and ticket, labels output audio and shows CNY seconds', () => {
  for (const locale of ['zh', 'en']) for (const item of FUN_MUSIC_CATALOG) {
    const html = renderToStaticMarkup(createElement(AuditedPricingFacts, { item, locale }));
    assert.ok(html.includes(INVITE_NOTE));
    assert.ok(html.includes(TICKET_URL));
    assert.ok(html.includes(locale === 'zh' ? '输出音频（每秒）' : 'Output audio (per second)'));
    assert.ok(html.includes(locale === 'zh' ? '/ 秒' : '/ second'));
    assert.match(html, /¥0\.00[25]/);
    assert.doesNotMatch(html, /\$|audio_second|per_1m_tokens/);
  }
});

test('production-shaped fixture plans exactly two models and two usage rows; fake apply resolves IDs and rerun is empty', async () => {
  const f = fixture();
  assert.deepEqual(seedStepCounts(await seedFunMusic1127(f.tx)), PRODUCTION_SHAPED_DRY_RUN);
  assert.equal(f.writes(), 0);
  assert.deepEqual(seedStepCounts(await seedFunMusic1127(f.tx, true)), PRODUCTION_SHAPED_DRY_RUN);
  assert.equal(f.writes(), 4);
  assert.deepEqual(f.data.providers, [qwen]);
  assert.equal(f.data.api_channel_prices.length, 0);
  assert.equal(f.data.api_channel_price_variants.length, 0);
  assert.equal(f.data.plans.length, 0);
  for (const [i, model] of f.data.models.entries()) {
    const fact = FUN_MUSIC_MODELS[i];
    assert.equal(model.slug, fact.id);
    assert.equal(model.type, 'multimodal');
    assert.equal(model.model_category, 'music');
    assert.deepEqual(model.provider_ids, [qwen.id]);
    assert.equal(model.pricing_unit, 'per_second');
    assert.deepEqual(model.input_type, ['text']);
    assert.deepEqual(model.output_type, ['audio', 'music']);
    assert.ok(String(model.description).includes(INVITE_NOTE));
    for (const key of ['context_window', 'max_output_tokens', 'released_at', 'parameters']) assert.equal(model[key], undefined);
    const usage = f.data.usage_prices.find(row => row.model_id === model.id)!;
    assert.ok(usage);
    assert.equal(usage.provider_id, qwen.id);
    assert.equal(usage.plan_id, null);
    assert.equal(usage.price_kind, 'audio_second');
    assert.equal(usage.unit, 'second');
    assert.equal(usage.price, fact.price);
    assert.equal(usage.currency, 'CNY');
    assert.equal(usage.source_url, PRICING_PAGE);
    assert.deepEqual(usage.last_verified, VERIFIED_AT);
    assert.deepEqual(usage.constraints_json, {
      official_model_id: fact.id, region: 'cn-beijing', region_label: '华北2（北京）',
      billing_rule: BILLING_RULE, input_charged: false, note: INVITE_NOTE, ticket_url: TICKET_URL,
      access: 'invite-only', free_quota: { seconds: fact.freeSeconds, label: fact.freeSeconds ? '1,000 秒' : '无',
        ...(fact.freeSeconds ? { validity: QUOTA_VALIDITY } : {}) },
    });
    usage.price = String(usage.price); // postgres numeric representation
  }
  assert.deepEqual(await seedFunMusic1127(f.tx, true), []);
  assert.equal(f.writes(), 4);
});

test('rehearsal executes simulated writes and rolls them back', async () => {
  const f = fixture();
  const before = structuredClone(f.data);
  let isolation = '';
  const sql = { async begin(level: string, work: (tx: typeof f.tx) => Promise<unknown>) {
    isolation = level;
    try { return await work(f.tx); } catch (error) { Object.assign(f.data, before); throw error; }
  } };
  assert.deepEqual(seedStepCounts(await runRehearsable(sql, false, tx => seedFunMusic1127(tx, true))), PRODUCTION_SHAPED_DRY_RUN);
  assert.equal(isolation, 'isolation level serializable');
  assert.equal(f.writes(), 4);
  assert.deepEqual(f.data, before);
});

test('newer usage evidence, unavailable rows, unrelated channel/plan rows and curated descriptions survive', async () => {
  const f = fixture();
  await seedFunMusic1127(f.tx, true);
  const [preview, v1] = f.data.usage_prices;
  Object.assign(preview, { price: '0.009', last_verified: '2026-11-28', constraints_json: { region: 'cn-beijing', note: 'Newer evidence' }, is_available: false });
  v1.is_available = false;
  f.data.models[0].description = `Curated description\n${f.data.models[0].description}`;
  const newer = structuredClone(preview);
  const other = { ...v1, id: 777, provider_id: 99, price: 99 };
  const plan = { ...v1, id: 778, plan_id: 123, price: 88 };
  f.data.usage_prices.push(other, plan);
  await seedFunMusic1127(f.tx, true);
  assert.deepEqual(preview, newer);
  assert.equal(v1.is_available, false);
  assert.equal(other.price, 99);
  assert.equal(plan.price, 88);
  assert.match(String(f.data.models[0].description), /^Curated description/);
  assert.deepEqual(await seedFunMusic1127(f.tx, true), []);
});

test('missing/ambiguous providers, alias identities, taxonomy, ownership, units and duplicate usage fail before any writes', async () => {
  const mutations: ((f: ReturnType<typeof fixture>) => void)[] = [
    f => { f.data.providers = []; },
    f => { f.data.providers.push({ ...qwen, id: 2 }); },
    f => { f.data.providers[0].type = 'aggregator'; },
    f => { f.data.models[1].slug = 'qwen-fun-music-v1'; },
    f => { f.data.models.push({ ...f.data.models[1], id: 999 }); },
    f => { f.data.models[1].type = 'llm'; },
    f => { f.data.models[1].model_category = 'speech'; },
    f => { f.data.models[1].provider_ids = [22]; },
    f => { f.data.models[1].provider_ids = '1'; },
    f => { f.data.models[1].pricing_unit = 'per_1m_tokens'; },
    f => { f.data.usage_prices[1].unit = 'per_1m_tokens'; },
    f => { f.data.usage_prices[1].price_kind = 'video_second'; },
    f => { f.data.usage_prices[1].currency = 'USD'; },
    f => { f.data.usage_prices[1].constraints_json = { region: 'ap-southeast-1' }; },
    f => { f.data.usage_prices.push({ ...f.data.usage_prices[1], id: 888 }); },
  ];
  for (const mutate of mutations) {
    const f = fixture();
    await seedFunMusic1127(f.tx, true);
    f.data.models[0].name = 'stale'; // first model has a pending update when second fails
    mutate(f);
    const before = structuredClone(f.data);
    const writes = f.writes();
    await assert.rejects(seedFunMusic1127(f.tx, true), /nothing written/);
    assert.equal(f.writes(), writes);
    assert.deepEqual(f.data, before);
  }
});
