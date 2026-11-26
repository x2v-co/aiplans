import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { catalogForKind } from '../../src/lib/ai-vertical-catalog';
import {
  BAILIAN_DECISION_API, BAILIAN_DECISION_GA as GA, BAILIAN_DECISION_PREVIEW as PREVIEW,
  BAILIAN_DECISION_INFO, BAILIAN_PRICING, BAILIAN_RELEASES, DECISION_MODELS_2026_11_26,
} from '../../src/lib/decision-models-2026-11-26';
import {
  PRODUCTION_SHAPED_DRY_RUN, catalog20261126BailianDecisionSeedOptions,
  seedCatalog20261126BailianDecision, seedStepCounts,
} from './catalog-2026-11-26-bailian-decision';
import { fakeSeedTx } from './fake-seed-tx';

const qwen = { id: 4, slug: 'qwen', name: '通义千问', type: 'official' };
const fixture = () => fakeSeedTx({ providers: [qwen], models: [] });
const read = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8');

test('manual CLI defaults to rehearsal dry-run and is excluded from deploy', () => {
  assert.equal(catalog20261126BailianDecisionSeedOptions([]).apply, false);
  assert.equal(catalog20261126BailianDecisionSeedOptions(['--dry-run']).apply, false);
  assert.equal(catalog20261126BailianDecisionSeedOptions(['--apply']).apply, true);
  for (const args of [['--apply', '--dry-run'], ['--force'], ['--apply=true']]) {
    assert.throws(() => catalog20261126BailianDecisionSeedOptions(args), /Usage/);
  }
  const pkg = JSON.parse(read('../../package.json'));
  assert.equal(pkg.scripts['seed:catalog-2026-11-26-bailian-decision'], 'tsx scripts/seed-catalog-2026-11-26-bailian-decision.ts');
  assert.equal(pkg.scripts['seed:catalog-2026-11-26-bailian-decision:apply'], 'tsx scripts/seed-catalog-2026-11-26-bailian-decision.ts --apply');
  assert.match(pkg.scripts['test:db'], /catalog-2026-11-26-bailian-decision-postgres\.test\.ts/);
  assert.doesNotMatch(read('../../deploy/production/seed-catalog.sh'), /2026-11-26-bailian-decision/);
  assert.match(read('../seed-catalog-2026-11-26-bailian-decision.ts'), /runRehearsable\(sql, apply, tx => seedCatalog20261126BailianDecision\(tx as unknown as typeof sql, true\)\)/);
});

test('GA and preview are separate decision identities with official dates, modalities and context', () => {
  const items = catalogForKind('decision-model').filter(item => [GA.slug, PREVIEW.slug].includes(item.slug as typeof GA.slug));
  assert.deepEqual(items, DECISION_MODELS_2026_11_26);
  assert.equal(items.length, 2);
  const [ga, preview] = items;
  assert.equal(ga.status, 'available');
  assert.equal(preview.status, 'preview');
  assert.equal(ga.releasedAt, '2026-11-25');
  assert.equal(preview.releasedAt, '2026-09-24');
  assert.equal(ga.contextWindow, 268_288);
  assert.equal(preview.contextWindow, 65_536);
  assert.deepEqual(ga.inputModalities, ['text', 'image']);
  assert.deepEqual(preview.inputModalities, ['text']);
  assert.equal(ga.inputPricePer1M, 0.3);
  assert.equal(preview.inputPricePer1M, 0);
  assert.match(ga.pricing, /0\.306/);
  assert.match(ga.notes!, /100 万 Token/);
  assert.match(ga.notes!, /自开通百炼、模型发布或申请通过之日起 90 天内（以较晚者为准）/);
  assert.match(ga.notes!, /新加坡无免费额度/);
  assert.match(preview.pricing, /限时免费 \(limited-time free\)/);
  assert.match(preview.pricing, /no end date/);
  assert.equal(preview.url, BAILIAN_DECISION_API);
  assert.deepEqual(preview.sourceUrls!.map(source => source.url), [BAILIAN_PRICING, BAILIAN_DECISION_API, BAILIAN_RELEASES]);
  assert.ok(ga.sourceUrls!.some(source => source.url === BAILIAN_DECISION_INFO));
  for (const item of items) {
    assert.equal(item.providerSlug, 'qwen');
    assert.equal(item.modelCategory, 'decision');
    assert.equal(item.currency, 'CNY');
    assert.equal(item.outputPricePer1M, 0);
    assert.equal(item.pricePer1MTasks, null);
    assert.equal(item.lastVerified, '2026-11-26');
    assert.equal(item.verifiedAt, '2026-11-26');
    assert.equal(item.deferredDbSeedScript, 'seed:catalog-2026-11-26-bailian-decision:apply');
    assert.match(item.notes!, /no output unit price; output 0 is the catalog input-only convention/);
    assert.match(item.notes!, /does not generate text/);
    assert.match(item.notes!, /input_tokens only/);
    assert.ok(!catalogForKind('agent').some(other => other.slug === item.slug));
    for (const source of item.sourceUrls!) assert.equal(new URL(source.url).hostname, 'help.aliyun.com');
  }
});

test('offline fakeSeedTx planning matches production-shaped expectation; inserts re-run empty', async () => {
  const f = fixture();
  const before = structuredClone(f.data);
  assert.deepEqual(seedStepCounts(await seedCatalog20261126BailianDecision(f.tx)), PRODUCTION_SHAPED_DRY_RUN);
  assert.equal(f.writes(), 0);
  assert.deepEqual(f.data, before);
  assert.deepEqual(seedStepCounts(await seedCatalog20261126BailianDecision(f.tx, true)), PRODUCTION_SHAPED_DRY_RUN);
  assert.equal(f.writes(), 8);
  assert.deepEqual(await seedCatalog20261126BailianDecision(f.tx, true), []);
  assert.equal(f.writes(), 8);
  assert.equal(f.data.providers.length, 1);
  assert.equal(f.data.models.length, 2);
  assert.equal(f.data.api_channel_prices.length, 2, 'one official channel per model/provider');
  assert.equal(f.data.api_channel_price_variants.length, 4);
  for (const spec of [GA, PREVIEW]) {
    const model = f.data.models.find(row => row.slug === spec.slug)!;
    assert.equal(model.model_category, 'decision');
    assert.equal(model.context_window, spec.context);
    assert.equal(model.max_output_tokens, 0);
    assert.deepEqual(model.input_modalities, [...spec.inputModalities]);
    assert.equal(new Date(String(model.released_at)).toISOString().slice(0, 10), spec.releasedAt);
    const channel = f.data.api_channel_prices.find(row => row.model_id === model.id)!;
    assert.equal(channel.provider_id, qwen.id);
    assert.equal(channel.input_price_per_1m, spec.beijingInput);
    assert.equal(channel.output_price_per_1m, 0);
    assert.match(String(channel.notes), new RegExp(`official API id ${spec.apiId};`));
    const regions = f.data.api_channel_price_variants.filter(row => row.model_id === model.id);
    for (const region of regions) {
      const beijing = region.variant_key === 'cn-beijing';
      assert.equal(region.input_price_per_1m, beijing ? spec.beijingInput : spec.singaporeInput);
      assert.equal(region.output_price_per_1m, 0);
      assert.equal(region.is_headline, beijing);
      assert.equal(region.currency, 'CNY');
      assert.equal(region.source_url, BAILIAN_PRICING);
      const constraints = region.constraints_json as Record<string, unknown>;
      assert.equal(constraints.region, region.variant_key);
      if (spec.status === 'preview') {
        assert.equal(constraints.limited_time_free, true);
        assert.match(String(region.notes), /限时免费/);
        assert.match(String(region.notes), /no end date/);
        assert.equal(region.promo_ends_at, undefined);
        assert.equal(constraints.promo_ends_at, undefined);
      } else {
        assert.equal(constraints.free_quota_tokens, beijing ? 1_000_000 : 0);
        assert.equal(constraints.free_quota_validity_days, beijing ? 90 : undefined);
        if (beijing) assert.match(String(constraints.free_quota_validity_basis), /以较晚者为准/);
      }
    }
  }
});

test('aliases update in place without merging GA/preview or fine-tune ids; unrelated rows stay intact', async () => {
  const other = { id: 21, slug: 'decision-model-preview-2026-09-24', name: 'Fine-tune base', provider_ids: [4] };
  const f = fakeSeedTx({ providers: [{ ...qwen, type: 'producer' }], models: [
    { id: 20, slug: 'decision-model', name: 'Old GA', provider_ids: [8] }, other,
  ] });
  await seedCatalog20261126BailianDecision(f.tx, true);
  assert.equal(f.data.models.find(row => row.slug === GA.slug)!.id, 20);
  assert.deepEqual(f.data.models.find(row => row.id === 20)!.provider_ids, [8, 4]);
  assert.notEqual(f.data.models.find(row => row.slug === PREVIEW.slug)!.id, 20);
  assert.deepEqual(f.data.models.find(row => row.id === 21), other);
  assert.deepEqual(await seedCatalog20261126BailianDecision(f.tx, true), []);
});

test('missing/ambiguous provider, alias collisions, duplicate channels/variants and competing headlines abort before writes', async () => {
  const ga = { id: 20, slug: GA.slug, provider_ids: [4] };
  const cases = [
    { providers: [], models: [] },
    { providers: [qwen, { ...qwen, id: 5 }], models: [] },
    { providers: [{ ...qwen, type: 'aggregator' }], models: [] },
    { providers: [qwen], models: [ga, { ...ga, id: 21, slug: 'decision-model' }] },
    { providers: [qwen], models: [
      { id: 21, slug: PREVIEW.slug }, { id: 22, slug: 'decision-model-preview' },
    ] },
    { providers: [qwen], models: [ga], api_channel_prices: [
      { id: 30, model_id: 20, provider_id: 4 }, { id: 31, model_id: 20, provider_id: 4 },
    ] },
    { providers: [qwen], models: [ga], api_channel_price_variants: [
      { id: 30, model_id: 20, provider_id: 4, variant_key: 'cn-beijing' },
      { id: 31, model_id: 20, provider_id: 4, variant_key: 'cn-beijing' },
    ] },
    { providers: [qwen], models: [ga], api_channel_price_variants: [
      { id: 30, model_id: 20, provider_id: 4, variant_key: 'other', is_headline: true },
    ] },
  ];
  for (const initial of cases) {
    const f = fakeSeedTx(initial);
    await assert.rejects(() => seedCatalog20261126BailianDecision(f.tx, true), /nothing written/);
    assert.equal(f.writes(), 0);
  }
});

test('newer prices and manually locked availability survive reruns', async () => {
  const f = fixture();
  await seedCatalog20261126BailianDecision(f.tx, true);
  const gaId = f.data.models.find(row => row.slug === GA.slug)!.id;
  const channel = f.data.api_channel_prices.find(row => row.model_id === gaId)!;
  const [beijing, singapore] = f.data.api_channel_price_variants.filter(row => row.model_id === gaId);
  for (const row of [channel, beijing]) Object.assign(row, { is_available: false, availability_locked: true });
  Object.assign(singapore, { input_price_per_1m: 9, last_verified: new Date('2026-11-27T00:00:00Z') });
  Object.assign(f.data.api_channel_prices.find(row => row.model_id !== gaId)!, { input_price_per_1m: 7, last_verified: new Date('2026-11-27T00:00:00Z') });
  const before = structuredClone(f.data);
  const writes = f.writes();
  assert.deepEqual(await seedCatalog20261126BailianDecision(f.tx, true), []);
  assert.deepEqual(f.data, before);
  assert.equal(f.writes(), writes);
});
