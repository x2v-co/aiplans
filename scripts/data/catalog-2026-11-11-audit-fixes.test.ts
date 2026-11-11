import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GEMINI_TIERS, LIFECYCLE, OPENAI_LONG_CONTEXT, PRODUCTION_SHAPED_DRY_RUN, QWEN_STILL_SOLD, QWEN_TIERS,
  catalog20261111AuditFixesSeedOptions, seedCatalog20261111AuditFixes, seedStepCounts,
} from './catalog-2026-11-11-audit-fixes';
import { fakeSeedTx, type FakeRow } from './fake-seed-tx';

const openai = { id: 1, slug: 'openai', name: 'OpenAI', type: 'official' };
const google = { id: 2, slug: 'google', name: 'Google', type: 'producer' };
const qwen = { id: 3, slug: 'qwen', name: 'Qwen', type: 'official' };
const retired = 'retired 2026-08-20T03:21:00.000Z: absent from successful full-catalog Qwen scrape';

function model(id: number, slug: string, providerId = 2): FakeRow {
  return { id, slug, name: slug, type: 'llm', provider_ids: [providerId], description: `${slug} existing`, shutdown_date: null, deprecated_at: null, replacement_model: null, deprecation_source_url: null };
}
function channel(id: number, modelId: number, providerId: number, input: number, output: number, extra: FakeRow = {}): FakeRow {
  return {
    id, model_id: modelId, provider_id: providerId, input_price_per_1m: input, output_price_per_1m: output,
    currency: providerId === 3 ? 'CNY' : 'USD', price_unit: 'per_1m_tokens', is_available: true, notes: 'old', ...extra,
  };
}

function shaped() {
  const models: FakeRow[] = [
    model(10, 'gpt-image-2', 1),
    model(11, 'mistral-medium-3.5', 1),
    model(12, 'gemini-3.1-flash-lite'),
    model(13, 'deepseek-v4-flash', 1),
    model(14, 'gemini-3.5-flash'),
    model(15, 'gemini-3.7-flash'),
    model(16, 'mistral-medium-3', 1),
    model(17, 'mistral-medium-3.1', 1),
    model(18, 'devstral-2512', 1),
    model(19, 'gemini-3.1-pro'),
    model(20, 'gemini-2.5-pro'),
    model(21, 'gpt-6-astra', 1),
    model(22, 'gpt-6.1-sol', 1),
    model(23, 'gpt-6-luna', 1),
  ];
  const channels: FakeRow[] = [
    channel(101, 19, 2, 2, 12, { cached_input_price_per_1m: 0.2 }),
    channel(102, 20, 2, 1.25, 10),
    channel(103, 21, 1, 10, 50, { cached_input_price_per_1m: 1 }),
    channel(104, 22, 1, 2, 10, { cached_input_price_per_1m: 0.1 }),
    channel(105, 23, 1, 0.1, 0.5, { cached_input_price_per_1m: 0.01 }),
  ];
  let nextModel = 30;
  let nextChannel = 200;
  for (const spec of QWEN_TIERS) {
    const id = nextModel++;
    models.push(model(id, spec.slug, 3));
    const headline = spec.bands.find(band => band.headline)!;
    channels.push(channel(nextChannel++, id, 3, headline.input, headline.output, spec.slug === 'qwen-plus'
      ? { is_available: false, notes: `qwen-plus ¥0.8/¥2 | ${retired}` }
      : {}));
  }
  for (const spec of QWEN_STILL_SOLD) {
    const id = nextModel++;
    models.push(model(id, spec.slug, 3));
    channels.push(channel(nextChannel++, id, 3, spec.input, spec.output, { is_available: false, notes: retired }));
  }
  return fakeSeedTx({ providers: [openai, google, qwen], models, api_channel_prices: channels, api_channel_price_variants: [] });
}

test('audit-fixes seed options reject unknown flags', () => {
  assert.equal(catalog20261111AuditFixesSeedOptions([]).apply, false);
  assert.equal(catalog20261111AuditFixesSeedOptions(['--apply']).apply, true);
  assert.throws(() => catalog20261111AuditFixesSeedOptions(['--apply', '--dry-run']), /Usage/);
});

test('production-shaped dry-run matches the audit-named rows and does not create missing aliases', async () => {
  const fx = shaped();
  const first = await seedCatalog20261111AuditFixes(fx.tx, true);
  assert.deepEqual(seedStepCounts(first), PRODUCTION_SHAPED_DRY_RUN);
  assert.ok(first.some(step => step.action === 'skip' && step.target === 'gpt-image-2-snapshot'));
  assert.ok(first.some(step => step.action === 'skip' && step.target === 'deepseek-v4-flash-vision'));
  assert.equal(first.filter(step => step.action === 'insert' && step.table === 'models').length, 0);

  const image = fx.data.models.find(row => row.slug === 'gpt-image-2')!;
  assert.equal(image.shutdown_date, '2027-02-10');
  assert.equal(image.deprecated_at, '2026-11-10');
  assert.equal(image.replacement_model, 'gpt-image-2.6-sunburst or gpt-image-2.6-flare');
  const lite = fx.data.models.find(row => row.slug === 'gemini-3.1-flash-lite')!;
  assert.equal(lite.shutdown_date, '2027-05-07');
  assert.equal(lite.deprecated_at, null);
  assert.match(String(lite.description), /earliest possible/);
  const flash = fx.data.models.find(row => row.slug === 'gemini-3.5-flash')!;
  assert.equal(flash.replacement_model, 'gemini-3.6-flash');
  assert.equal(flash.shutdown_date, null);
  assert.equal(fx.data.models.find(row => row.slug === 'gemini-3.7-flash')!.replacement_model, 'gemini-3.8-flash');
  const deepseek = fx.data.models.find(row => row.slug === 'deepseek-v4-flash')!;
  assert.equal(deepseek.deprecated_at, '2026-09-10');
  assert.equal(deepseek.shutdown_date, null);
  assert.equal(deepseek.replacement_model, 'deepseek-v4.1-flash');
  assert.equal(fx.data.models.find(row => row.slug === 'mistral-medium-3')!.shutdown_date, '2026-08-31');
  assert.equal(fx.data.models.find(row => row.slug === 'mistral-medium-3.1')!.shutdown_date, '2026-08-31');
  assert.equal(fx.data.models.find(row => row.slug === 'devstral-2512')!.shutdown_date, '2026-07-31');
  assert.match(String(fx.data.models.find(row => row.slug === 'mistral-medium-3')!.description), /\$0\.40 \/ \$2\.00/);
  assert.equal(fx.data.models.find(row => row.slug === 'mistral-medium-3.5')!.replacement_model, 'mistral-large-4');
  assert.match(String(fx.data.models.find(row => row.slug === 'mistral-medium-3.5')!.description), /Mistral Large 4/);

  const qwenMax = fx.data.models.find(row => row.slug === 'qwen-max')!;
  const maxChannel = fx.data.api_channel_prices.find(row => row.model_id === qwenMax.id)!;
  assert.equal(maxChannel.is_available, true);
  assert.equal(maxChannel.input_price_per_1m, 2.4);
  assert.doesNotMatch(String(maxChannel.notes), /absent from successful full-catalog/);

  const astra = fx.data.models.find(row => row.slug === 'gpt-6-astra')!;
  const long = fx.data.api_channel_price_variants.find(row => row.model_id === astra.id && row.variant_key === 'long-context')!;
  assert.equal(long.input_price_per_1m, 20);
  assert.equal(long.output_price_per_1m, 75);
  assert.equal(long.cached_input_price_per_1m, 2);
  assert.equal(long.variant_kind, 'tier');
  assert.equal(long.is_headline, false);
  const pro = fx.data.models.find(row => row.slug === 'gemini-3.1-pro')!;
  const over = fx.data.api_channel_price_variants.find(row => row.model_id === pro.id && row.variant_key === 'context-gt-200k')!;
  assert.deepEqual([over.input_price_per_1m, over.output_price_per_1m, over.cached_input_price_per_1m], [4, 18, 0.4]);
  const plus = fx.data.models.find(row => row.slug === 'qwen-plus')!;
  const plusHead = fx.data.api_channel_price_variants.find(row => row.model_id === plus.id && row.is_headline === true)!;
  assert.equal((plusHead.constraints_json as { thinking_output_price_per_1m: number }).thinking_output_price_per_1m, 8);
  const coder = fx.data.models.find(row => row.slug === 'qwen3-coder-flash')!;
  assert.equal(fx.data.api_channel_price_variants.filter(row => row.model_id === coder.id).length, 4);

  const again = await seedCatalog20261111AuditFixes(fx.tx, false);
  assert.deepEqual(seedStepCounts(again), {
    providers: { insert: 0, update: 0 },
    models: { insert: 0, update: 0 },
    api_channel_prices: { insert: 0, update: 0 },
    api_channel_price_variants: { insert: 0, update: 0 },
  });
  assert.equal(LIFECYCLE.length, 11);
  assert.equal(OPENAI_LONG_CONTEXT.length, 3);
  assert.equal(GEMINI_TIERS.length, 2);
});
