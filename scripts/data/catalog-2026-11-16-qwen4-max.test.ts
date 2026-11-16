import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  assertQwen4MaxLoopbackTestUrl, catalog20261116Qwen4MaxSeedOptions,
  FINAL_ALIASES, MODEL_NOTES, PRODUCTION_SHAPED_DRY_RUN, REGIONAL_PRICES,
  seedCatalog20261116Qwen4Max, seedStepCounts, SLUG, SOURCES, VERIFIED_AT,
} from './catalog-2026-11-16-qwen4-max';
import { canonicalSeedValue } from './gemini-4-argon';
import { fakeSeedTx, type FakeRow } from './fake-seed-tx';

const providers: FakeRow[] = [
  { id: 46, slug: 'qwen', name: 'Qwen', type: 'producer', currency: 'CNY' },
  { id: 59, slug: 'openrouter', name: 'OpenRouter', type: 'aggregator' },
  { id: 200, slug: 'vercel-ai-gateway', name: 'Vercel AI Gateway', type: 'aggregator' },
];
const canonical: FakeRow = { id: 100, slug: SLUG, name: 'Qwen4-Max', type: 'llm', model_category: 'text', provider_ids: [46] };
const preview: FakeRow = {
  id: 101, slug: 'qwen4-max-preview', name: 'Qwen4-Max-Preview', type: 'llm',
  provider_ids: [46], shutdown_date: '2026-11-26', pricing_unit: 'subscription_only',
};
const previewAlias: FakeRow = { ...preview, id: 102, slug: 'qwen4.0-max-preview' };
function shaped(existing = false) {
  const f = fakeSeedTx({
    providers,
    models: [...(existing ? [canonical] : []), preview, previewAlias, { id: 103, slug: 'unrelated', name: 'Untouched' }],
    plans: [{ id: 300, slug: 'qwen-token-plan-personal', provider_id: 46, price: 39, model_selector: { extra: ['qwen4-max-preview'] } }],
    model_plan_mapping: [{ id: 400, plan_id: 300, model_id: 101, source: 'manual' }],
    api_channel_prices: [{ id: 500, model_id: 101, provider_id: 46, is_available: false, availability_locked: true, notes: 'Preview only' }],
    api_channel_price_variants: [{ id: 501, model_id: 103, provider_id: 46, variant_key: 'unrelated', is_headline: true }],
    usage_prices: [{ id: 600, model_id: 103, price: 9 }],
  });
  // postgres.js encodes jsonb explicitly; keep the shared legacy fake untouched.
  Object.assign(f.tx, { json: (value: unknown) => structuredClone(value) });
  return f;
}
const finalChannels = (f: ReturnType<typeof shaped>) => {
  const model = f.data.models.find(row => row.slug === SLUG)!;
  return f.data.api_channel_prices.filter(row => row.model_id === model.id);
};
const finalVariants = (f: ReturnType<typeof shaped>) => {
  const model = f.data.models.find(row => row.slug === SLUG)!;
  return f.data.api_channel_price_variants.filter(row => row.model_id === model.id);
};

test('manual rehearsal hooks are standalone, explicit apply only, DB test is registered', () => {
  assert.deepEqual(catalog20261116Qwen4MaxSeedOptions([]), { apply: false });
  assert.deepEqual(catalog20261116Qwen4MaxSeedOptions(['--dry-run']), { apply: false });
  assert.deepEqual(catalog20261116Qwen4MaxSeedOptions(['--apply']), { apply: true });
  for (const args of [['--force'], ['--apply', '--dry-run'], ['--slug', SLUG], ['--sync-availability']]) {
    assert.throws(() => catalog20261116Qwen4MaxSeedOptions(args), /Usage/);
  }
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
  const cliPath = 'scripts/seed-catalog-2026-11-16-qwen4-max.ts';
  assert.equal(pkg.scripts['seed:catalog-2026-11-16-qwen4-max'], `tsx ${cliPath}`);
  assert.equal(pkg.scripts['seed:catalog-2026-11-16-qwen4-max:apply'], `tsx ${cliPath} --apply`);
  assert.ok(pkg.scripts['test:db'].includes('scripts/db/catalog-2026-11-16-qwen4-max-postgres.test.ts'));
  const cli = readFileSync(new URL('../seed-catalog-2026-11-16-qwen4-max.ts', import.meta.url), 'utf8');
  assert.match(cli, /runRehearsable\(sql, apply, tx => seedCatalog20261116Qwen4Max\(tx as unknown as typeof sql, true\)\)/);
  for (const file of ['../../deploy/production/rollout.sh', '../../deploy/production/seed-catalog.sh', '../../.github/workflows/deploy-production.yml', '../../.github/workflows/seed-catalog.yml']) {
    assert.doesNotMatch(readFileSync(new URL(file, import.meta.url), 'utf8'), /2026-11-16-qwen4-max/);
  }
});

test('offline production shape is exact and planning makes no writes', async () => {
  const f = shaped();
  const before = structuredClone(f.data);
  const steps = await seedCatalog20261116Qwen4Max(f.tx);
  assert.deepEqual(seedStepCounts(steps), PRODUCTION_SHAPED_DRY_RUN);
  assert.equal(steps.length, 6);
  assert.equal(f.writes(), 0);
  assert.deepEqual(f.data, before);
  assert.equal(VERIFIED_AT.toISOString(), '2026-11-16T06:50:00.000Z');
});

test('apply creates final PAYG with exact prices, modalities, geographic scope, TTL and uncertainty', async () => {
  const f = shaped();
  const before = structuredClone(f.data);
  assert.deepEqual(seedStepCounts(await seedCatalog20261116Qwen4Max(f.tx, true)), PRODUCTION_SHAPED_DRY_RUN);
  const model = f.data.models.find(row => row.slug === SLUG)!;
  assert.ok(model.id > 0);
  assert.equal(model.type, 'llm');
  assert.equal(model.model_category, 'text');
  assert.deepEqual(model.provider_ids, [46, 59, 200]);
  assert.equal(model.context_window, 1_000_000);
  for (const key of ['max_output_tokens', 'parameters', 'active parameters', 'license', 'license_url']) assert.equal(model[key], null);
  assert.equal(model.open_source, false);
  assert.equal(model.shutdown_date ?? null, null);
  assert.deepEqual(model.input_type, ['text', 'image', 'video']);
  assert.deepEqual(model.input_modalities, model.input_type);
  assert.deepEqual(model.output_modalities, ['text']);
  assert.deepEqual(model.output_type, ['text']);
  assert.deepEqual(model.capabilities, ['reasoning', 'tool-calling', 'structured-outputs']);
  assert.equal(model.offical_link, SOURCES.model);
  assert.match(MODEL_NOTES, /131,072.*262,144.*393K.*393,216.*384,000/);
  assert.match(MODEL_NOTES, /no published weights were verified/);
  assert.match(MODEL_NOTES, /mappings are deferred.*preview-only selectors/);

  const channels = finalChannels(f);
  assert.equal(channels.length, 3);
  const expected = new Map([[46, [10, 30, 0.5, 'CNY']], [59, [1.5, 4.5, 0.075, 'USD']], [200, [1.5, 4.5, null, 'USD']]]);
  for (const row of channels) {
    assert.deepEqual([row.input_price_per_1m, row.output_price_per_1m, row.cached_input_price_per_1m, row.currency], expected.get(Number(row.provider_id)));
    assert.equal(row.price_unit, 'per_1m_tokens');
    assert.equal(row.is_available, true);
    for (const key of ['promo_ends_at', 'regular_input_price_per_1m', 'regular_output_price_per_1m', 'regular_cached_input_price_per_1m']) assert.equal(row[key], null);
    assert.equal(row.last_verified, VERIFIED_AT);
  }
  assert.match(String(channels.find(row => row.provider_id === 59)!.notes), /qwen\/qwen4-max.*5m: 1.875.*supports_implicit_caching=false/);
  assert.match(String(channels.find(row => row.provider_id === 200)!.notes), /alibaba\/qwen4-max.*Cache rate not quoted/);
  const variants = finalVariants(f);
  assert.equal(variants.length, 2);
  assert.equal(variants.filter(row => row.is_headline).length, 1);
  for (const spec of REGIONAL_PRICES) {
    const row = variants.find(row => row.variant_key === spec.key)!;
    assert.deepEqual([row.input_price_per_1m, row.output_price_per_1m, row.cached_input_price_per_1m, row.cache_create_price_per_1m, row.currency], [spec.input, spec.output, spec.cache, spec.write5m, spec.currency]);
    assert.equal(row.variant_name, spec.name);
    assert.equal(row.variant_kind, 'tier');
    assert.equal(row.is_headline, spec.headline);
    const constraints = row.constraints_json as Record<string, unknown>;
    assert.equal(constraints.model_id, SLUG);
    assert.equal(constraints.deployment_region, spec.region);
    assert.equal(constraints.geographic_scope, spec.scope);
    assert.equal(constraints.currency, spec.currency);
    assert.equal(constraints.cache_create_ttl_seconds, 300);
    assert.deepEqual(constraints.cache_write_prices_per_1m, { '5m': spec.write5m, '1h': spec.write1h });
    assert.equal(row.source_url, spec.source);
  }
  for (const table of ['providers', 'plans', 'model_plan_mapping', 'usage_prices']) assert.deepEqual(f.data[table], before[table]);
  for (const table of ['models', 'api_channel_prices', 'api_channel_price_variants']) {
    for (const old of before[table]) assert.deepEqual(f.data[table].find(row => row.id === old.id), old);
  }
});

test('apply is idempotent with Postgres numeric text, JSON key ordering and ISO timestamps', async () => {
  const f = shaped();
  await seedCatalog20261116Qwen4Max(f.tx, true);
  const count = f.writes();
  for (const row of [...finalChannels(f), ...finalVariants(f)]) {
    row.last_verified = VERIFIED_AT.toISOString();
    for (const key of ['input_price_per_1m', 'output_price_per_1m', 'cached_input_price_per_1m', 'cache_create_price_per_1m']) {
      if (row[key] != null) row[key] = String(row[key]);
    }
    if (row.constraints_json) row.constraints_json = canonicalSeedValue(row.constraints_json);
  }
  assert.deepEqual(await seedCatalog20261116Qwen4Max(f.tx), []);
  assert.deepEqual(await seedCatalog20261116Qwen4Max(f.tx, true), []);
  assert.equal(f.writes(), count);
});

test('a compatible canonical row is updated in place and unmentioned fields are retained', async () => {
  const f = shaped(true);
  const row = f.data.models.find(row => row.slug === SLUG)!;
  Object.assign(row, { description: 'Existing curated context.', features: ['preserve'], capabilities: ['existing'], released_at: '2026-11-16T00:00:00Z' });
  const steps = await seedCatalog20261116Qwen4Max(f.tx, true);
  assert.equal(steps.find(step => step.table === 'models')!.action, 'update');
  assert.equal(f.data.models.filter(row => row.slug === SLUG).length, 1);
  assert.equal(row.id, 100);
  assert.match(String(row.description), /^Existing curated context\./);
  assert.deepEqual(row.features, ['preserve']);
  assert.deepEqual(row.capabilities, ['existing', 'reasoning', 'tool-calling', 'structured-outputs']);
  assert.equal(row.released_at, '2026-11-16T00:00:00Z');
  assert.deepEqual(await seedCatalog20261116Qwen4Max(f.tx), []);
});

test('newer gateway and OpenRouter records are retained in full', async () => {
  const f = shaped();
  await seedCatalog20261116Qwen4Max(f.tx, true);
  const rows = finalChannels(f).filter(row => row.provider_id !== 46);
  for (const row of rows) Object.assign(row, { input_price_per_1m: 9, notes: 'New verified route', last_verified: new Date('2026-11-17T00:00:00Z'), is_available: false, availability_locked: true, regular_input_price_per_1m: 11 });
  const before = structuredClone(rows);
  const steps = await seedCatalog20261116Qwen4Max(f.tx, true);
  assert.equal(steps.filter(step => step.action === 'skip').length, 2);
  assert.deepEqual(rows, before);
});

test('any newer Qwen channel or variant retains its whole group without headline drift', async () => {
  for (const member of ['channel', 'beijing-cny', 'singapore-international-usd']) {
    const f = shaped();
    await seedCatalog20261116Qwen4Max(f.tx, true);
    const group = [finalChannels(f).find(row => row.provider_id === 46)!, ...finalVariants(f)];
    const newerRow = member === 'channel' ? group[0] : group.find(row => row.variant_key === member)!;
    Object.assign(newerRow, { input_price_per_1m: 99, notes: 'Newer regional evidence', last_verified: '2026-11-16T06:51:00Z' });
    const before = structuredClone(group);
    const steps = await seedCatalog20261116Qwen4Max(f.tx, true);
    assert.equal(steps.filter(step => step.action === 'skip').length, 3);
    assert.deepEqual(group, before);
  }
});

test('availability locks survive older price refreshes on all channels and variants', async () => {
  const f = shaped();
  await seedCatalog20261116Qwen4Max(f.tx, true);
  const rows = [...finalChannels(f), ...finalVariants(f)];
  for (const row of rows) Object.assign(row, { is_available: false, availability_locked: true, last_verified: '2026-11-15T00:00:00Z', input_price_per_1m: 99 });
  await seedCatalog20261116Qwen4Max(f.tx, true);
  for (const row of rows) {
    assert.equal(row.is_available, false);
    assert.equal(row.availability_locked, true);
    assert.notEqual(row.input_price_per_1m, 99);
  }
  assert.deepEqual(await seedCatalog20261116Qwen4Max(f.tx), []);
});

test('new regional variants cannot bypass a locked unavailable official channel', async () => {
  const f = shaped(true);
  f.data.api_channel_prices.push({ id: 700, model_id: 100, provider_id: 46, is_available: false, availability_locked: true });
  await seedCatalog20261116Qwen4Max(f.tx, true);
  assert.equal(finalChannels(f).find(row => row.provider_id === 46)!.is_available, false);
  assert.ok(finalVariants(f).every(row => row.is_available === false));
  assert.deepEqual(await seedCatalog20261116Qwen4Max(f.tx), []);
});

test('provider, owner and incompatible canonical guards abort before all writes', async () => {
  const cases: Array<(f: ReturnType<typeof shaped>) => void> = [
    ...[46, 59, 200].map(id => (f: ReturnType<typeof shaped>) => { f.data.providers = f.data.providers.filter(p => p.id !== id); }),
    ...[46, 59, 200].map(id => (f: ReturnType<typeof shaped>) => { f.data.providers.find(p => p.id === id)!.type = 'reseller'; }),
    f => { f.data.providers.push({ ...providers[0], id: 47 }); },
    f => { f.data.providers.push({ ...providers[2], id: 201, slug: 'vercel' }); },
    ...[
      { provider_ids: [59] }, { provider_ids: [46, 999] }, { provider_ids: null },
      { type: 'subscription' }, { model_category: 'image' }, { name: 'Qwen4-Max-Preview' },
      { pricing_unit: 'subscription_only' }, { shutdown_date: '2026-11-26' },
      { deprecated_at: '2026-11-13' }, { replacement_model: 'something-else' },
    ].map(patch => (f: ReturnType<typeof shaped>) => { Object.assign(f.data.models.find(row => row.slug === SLUG)!, patch); }),
  ];
  for (const mutate of cases) {
    const f = shaped(true);
    mutate(f);
    const before = structuredClone(f.data);
    await assert.rejects(() => seedCatalog20261116Qwen4Max(f.tx, true), /nothing written/);
    assert.equal(f.writes(), 0);
    assert.deepEqual(f.data, before);
  }
});

test('every obvious final alias blocks duplicate creation, both alone and alongside canonical', async () => {
  for (const slug of FINAL_ALIASES.filter(slug => slug !== SLUG)) {
    for (const existing of [false, true]) {
      const f = shaped(existing);
      f.data.models.push({ ...canonical, id: 800, slug });
      await assert.rejects(() => seedCatalog20261116Qwen4Max(f.tx, true), /Non-canonical final alias|Ambiguous/);
      assert.equal(f.writes(), 0);
    }
  }
});

test('duplicate canonical/channel/variant, foreign headline and incompatible region guards precede writes', async () => {
  const cases: Array<(f: ReturnType<typeof shaped>) => void> = [
    f => { f.data.models.push({ ...canonical, id: 801 }); },
    ...[46, 59, 200].map(id => (f: ReturnType<typeof shaped>) => {
      f.data.api_channel_prices.push({ id: 802, model_id: 100, provider_id: id }, { id: 803, model_id: 100, provider_id: id });
    }),
    f => { f.data.api_channel_price_variants.push({ id: 804, model_id: 100, provider_id: 46, variant_key: 'unknown', is_headline: true }); },
    f => { f.data.api_channel_price_variants.push(...[805, 806].map(id => ({ id, model_id: 100, provider_id: 46, variant_key: 'beijing-cny', currency: 'CNY', variant_kind: 'tier' }))); },
    f => { f.data.api_channel_price_variants.push({ id: 807, model_id: 100, provider_id: 46, variant_key: 'beijing-cny', currency: 'USD', variant_kind: 'tier' }); },
    f => { f.data.api_channel_price_variants.push({ id: 808, model_id: 100, provider_id: 46, variant_key: 'singapore-international-usd', currency: 'USD', variant_kind: 'context_band' }); },
  ];
  for (const mutate of cases) {
    const f = shaped(true);
    mutate(f);
    const before = structuredClone(f.data);
    await assert.rejects(() => seedCatalog20261116Qwen4Max(f.tx, true), /nothing written/);
    assert.equal(f.writes(), 0);
    assert.deepEqual(f.data, before);
  }
});

test('regional refresh preserves unrelated variants and extra constraints', async () => {
  const f = shaped();
  await seedCatalog20261116Qwen4Max(f.tx, true);
  const model = f.data.models.find(row => row.slug === SLUG)!;
  const cn = finalVariants(f).find(row => row.variant_key === 'beijing-cny')!;
  cn.constraints_json = { ...(cn.constraints_json as object), curated: 'retained' };
  const extra = { id: 900, model_id: model.id, provider_id: 46, variant_key: 'other', is_headline: false, notes: 'untouched' };
  f.data.api_channel_price_variants.push(extra);
  assert.deepEqual(await seedCatalog20261116Qwen4Max(f.tx, true), []);
  assert.equal((cn.constraints_json as Record<string, unknown>).curated, 'retained');
  assert.deepEqual(f.data.api_channel_price_variants.find(row => row.id === 900), extra);
});

test('integration URL guards accept only explicit loopback Postgres without connection overrides', () => {
  for (const host of ['localhost', '127.0.0.1', '[::1]']) {
    assert.doesNotThrow(() => assertQwen4MaxLoopbackTestUrl(`postgresql://test:test@${host}:5432/test`));
  }
  for (const url of [
    'postgres://test@db.example/test', 'postgres://test@127.0.0.2/test',
    'postgres://test@localhost.example/test', 'https://localhost/test',
    'postgres://test@localhost/test?host=remote', 'postgres://test@localhost/test?host=/tmp',
    'postgres://test@localhost/test?options=-hremote', 'postgres://test@localhost/test#remote',
    'postgres://test@localhost@remote/test', 'not a url',
  ]) assert.throws(() => assertQwen4MaxLoopbackTestUrl(url));
});
