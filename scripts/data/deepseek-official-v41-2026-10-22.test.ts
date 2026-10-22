import assert from 'node:assert/strict';
import test from 'node:test';
import { fakeSeedTx } from './fake-seed-tx';
import {
  DEEPSEEK_OFFICIAL_NOTE,
  DEEPSEEK_OFFICIAL_PEAK,
  DEEPSEEK_V41_SLUG,
  deepseekOfficialSeedOptions,
  seedDeepSeekOfficialV41,
} from './deepseek-official-v41-2026-10-22';

const provider = { id: 36, slug: 'deepseek' };
const models = [
  { id: 3129, slug: 'deepseek-v4.1-flash' },
  { id: 2917, slug: 'deepseek-v4-flash' },
];
// Production state on 2026-10-22: the canonical row is the retired CNY stopgap,
// the live USD official row sits on the legacy 0731 slug.
const prices = [
  { id: 15708, model_id: 3129, provider_id: 36, currency: 'CNY', input_price_per_1m: 2, output_price_per_1m: 8, cached_input_price_per_1m: 0.04, is_available: false, notes: 'retired: absent from successful full-catalog DeepSeek-API scrape' },
  { id: 15009, model_id: 2917, provider_id: 36, currency: 'USD', input_price_per_1m: 0.3, output_price_per_1m: 1.2, cached_input_price_per_1m: 0.006, is_available: true, notes: 'Peak list price; off-peak = 50%.' },
];
const variants = [
  { id: 183956, model_id: 3129, provider_id: 36, variant_key: 'peak', variant_name: 'Peak', currency: 'CNY', input_price_per_1m: 2, output_price_per_1m: 8, cached_input_price_per_1m: 0.04, is_available: false, is_headline: false },
  { id: 183957, model_id: 3129, provider_id: 36, variant_key: 'off-peak', variant_name: 'Off-peak', currency: 'CNY', input_price_per_1m: 1, output_price_per_1m: 4, cached_input_price_per_1m: 0.02, is_available: false, is_headline: false },
  { id: 166266, model_id: 2917, provider_id: 36, variant_key: 'peak', variant_name: 'Peak', currency: 'USD', input_price_per_1m: 0.3, output_price_per_1m: 1.2, cached_input_price_per_1m: 0.006, is_available: true, is_headline: true },
  { id: 166267, model_id: 2917, provider_id: 36, variant_key: 'off-peak', variant_name: 'Off-peak', currency: 'USD', input_price_per_1m: 0.15, output_price_per_1m: 0.6, cached_input_price_per_1m: 0.003, is_available: true, is_headline: false },
];

function fixture(extra: Record<string, unknown> = {}) {
  return fakeSeedTx({ providers: [provider], models, api_channel_prices: prices, api_channel_price_variants: variants, ...extra });
}

test('dry-run changes nothing; apply moves the official USD row to the canonical model and retires it on the legacy slug', async () => {
  const f = fixture();
  const before = structuredClone(f.data);
  const preview = await seedDeepSeekOfficialV41(f.tx, false);
  assert.ok(preview.length > 0);
  assert.equal(f.writes(), 0);
  assert.deepEqual(f.data, before);

  await seedDeepSeekOfficialV41(f.tx, true);
  const canonical = f.data.api_channel_prices.find(row => row.model_id === 3129)!;
  assert.deepEqual(
    [canonical.currency, canonical.input_price_per_1m, canonical.output_price_per_1m, canonical.cached_input_price_per_1m, canonical.is_available],
    ['USD', DEEPSEEK_OFFICIAL_PEAK.input, DEEPSEEK_OFFICIAL_PEAK.output, DEEPSEEK_OFFICIAL_PEAK.cache, true],
  );
  assert.equal(canonical.notes, DEEPSEEK_OFFICIAL_NOTE);
  const legacy = f.data.api_channel_prices.find(row => row.model_id === 2917)!;
  assert.equal(legacy.is_available, false);
  assert.match(String(legacy.notes), /Superseded 2026-10-22/);
  const canonicalVariants = f.data.api_channel_price_variants.filter(row => row.model_id === 3129);
  assert.deepEqual(canonicalVariants.map(row => [row.variant_key, row.currency, row.input_price_per_1m, row.output_price_per_1m, row.is_available, row.is_headline]), [
    ['peak', 'USD', 0.3, 1.2, true, true],
    ['off-peak', 'USD', 0.15, 0.6, true, false],
  ]);
  assert.ok(f.data.api_channel_price_variants.filter(row => row.model_id === 2917).every(row => row.is_available === false));
  assert.deepEqual(f.data.models.map(row => row.slug), [DEEPSEEK_V41_SLUG, 'deepseek-v4-flash']);
});

test('second apply is a no-op', async () => {
  const f = fixture();
  await seedDeepSeekOfficialV41(f.tx, true);
  const writes = f.writes();
  assert.deepEqual(await seedDeepSeekOfficialV41(f.tx, true), []);
  assert.equal(f.writes(), writes);
});

test('an already-USD canonical row is left alone and does not duplicate the legacy row', async () => {
  const f = fixture({
    api_channel_prices: prices.map(row => row.id === 15708
      ? { ...row, currency: 'USD', input_price_per_1m: 0.3, output_price_per_1m: 1.2, cached_input_price_per_1m: 0.006, is_available: true, notes: DEEPSEEK_OFFICIAL_NOTE }
      : row),
    api_channel_price_variants: variants.map(row => row.model_id === 3129
      ? { ...row, currency: 'USD', input_price_per_1m: row.variant_key === 'peak' ? 0.3 : 0.15, output_price_per_1m: row.variant_key === 'peak' ? 1.2 : 0.6, cached_input_price_per_1m: row.variant_key === 'peak' ? 0.006 : 0.003, is_available: true, is_headline: row.variant_key === 'peak' }
      : row),
  });
  const steps = await seedDeepSeekOfficialV41(f.tx, true);
  assert.equal(f.data.api_channel_prices.filter(row => row.provider_id === 36 && row.model_id === 3129).length, 1);
  // The legacy row still gets retired, but no new official row is created.
  assert.equal(f.data.api_channel_prices.find(row => row.model_id === 2917)!.is_available, false);
  assert.ok(steps.every(step => step.table !== 'api_channel_prices' || !('input_price_per_1m' in step.changes)));
});

test('ambiguous identity fails closed before writing', async () => {
  const f = fixture({ api_channel_prices: [...prices, { ...prices[1], id: 99999 }] });
  await assert.rejects(() => seedDeepSeekOfficialV41(f.tx, true), /Duplicate DeepSeek channel rows/);
  assert.equal(f.writes(), 0);
});

test('flags fail closed', () => {
  assert.deepEqual(deepseekOfficialSeedOptions([]), { apply: false });
  assert.deepEqual(deepseekOfficialSeedOptions(['--apply']), { apply: true });
  for (const args of [['--apply', '--dry-run'], ['--apply=true'], ['--unknown']]) assert.throws(() => deepseekOfficialSeedOptions(args));
});