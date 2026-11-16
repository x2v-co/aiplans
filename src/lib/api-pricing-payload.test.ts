import assert from 'node:assert/strict';
import test from 'node:test';
import { buildApiPricingPayload, expandApiPricingPayload, showChinaBadge } from './api-pricing-payload';
import { getLowestPriceUSD } from './channel-price-utils';
import type { ChannelPrice, ChannelPriceVariant, GroupedProduct } from './grouped-products';

const openrouter = {
  id: 7, name: 'OpenRouter', slug: 'openrouter', type: 'aggregator', region: 'global', access_from_china: null,
  logo: null, logo_url: 'https://example.com/or.png', website: 'https://openrouter.ai', pricing_url: null, invite_url: null,
  supported_regions: null, regions_source_url: null, regions_verified_at: null, notes: 'internal provider note',
} as ChannelPrice['providers'];
const deepseek = {
  ...openrouter, id: 3, name: 'DeepSeek', slug: 'deepseek', type: 'official', region: 'china',
  supported_regions: ['CN', 'US'], regions_source_url: 'https://example.com/supported-countries',
  regions_verified_at: '2026-11-01',
} as ChannelPrice['providers'];

const variant = (id: number, extra: Partial<ChannelPriceVariant> = {}): ChannelPriceVariant => ({
  id, variant_key: `k${id}`, variant_name: `Endpoint ${id}`, variant_kind: 'upstream_provider',
  input_price_per_1m: 0.2, output_price_per_1m: 0.8, cached_input_price_per_1m: null, currency: 'USD',
  price_unit: 'per_1m_tokens', is_headline: false, headline_reason: 'cheapest',
  constraints_json: { uptime_last_1d: 99.1, quantization: 'fp8', context_length: 128000 }, ...extra,
});

const channel = (id: number, providers: ChannelPrice['providers'], extra: Partial<ChannelPrice> = {}): ChannelPrice => ({
  id, model_id: 1, provider_id: providers.id, input_price_per_1m: 0.3, output_price_per_1m: 1.2,
  cached_input_price_per_1m: null, currency: 'USD', price_unit: 'per_1m_tokens', notes: 'scraped from pricing page',
  rate_limit: '60 rpm', is_available: true, member_shutdown_date: null, model_slug: 'deepseek-v4', providers,
  promo_ends_at: null, regular_input_price_per_1m: null, ...extra,
});

const card: GroupedProduct = {
  id: 1, name: 'DeepSeek V4', slug: 'deepseek-v4', provider_ids: [3], context_window: 128000,
  benchmark_arena_elo: 12, released_at: '2026-10-01', created_at: '2026-10-02', modelCategory: 'text',
  benchmarks: [{ benchmark_slug: 'arena-agent' } as GroupedProduct['benchmarks'][number]],
  providers: deepseek as GroupedProduct['providers'], shutdown_date: null, replacement_model: null,
  baseName: 'deepseek-v4', hasChinaVersion: true, hasGlobalVersion: true, versionCounts: 3,
  variantTags: [], memberSlugs: ['deepseek-v4'],
  versions: [
    channel(10, deepseek, {
      price_variants: [
        variant(1, { variant_kind: 'time_window', constraints_json: { time_window: 'peak', peak_schedule: 'verified', raw: 'x' } }),
        variant(2, { variant_kind: 'time_window', constraints_json: { time_window: 'off-peak', peak_schedule: 'verified' } }),
      ],
    }),
    channel(11, openrouter, { price_variants: [variant(3), variant(4, { is_headline: true })], data_for_discount: true }),
    channel(12, openrouter, {
      model_slug: 'deepseek-v4-batch', variant: ['batch'], price_variants: [variant(5)],
      notes: '[needs-verification] price unconfirmed', member_shutdown_date: '2027-01-01',
    }),
  ],
};

test('stores each provider once and keeps only rendered fields', () => {
  const payload = buildApiPricingPayload([card]);
  assert.deepEqual(payload.providers.map(p => p.id), [3, 7]);
  const json = JSON.stringify(payload);
  for (const dropped of ['internal provider note', 'supported-countries', 'uptime_last_1d', 'headline_reason',
    'variant_key', 'rate_limit', 'scraped from pricing page', 'arena-agent']) {
    assert.ok(!json.includes(dropped), dropped);
  }
  const [product] = payload.products;
  assert.equal(product.versions[2].price_variants, undefined, 'a single variant is never rendered');
  assert.deepEqual(product.versions[0].price_variants?.[0].constraints_json, { time_window: 'peak', peak_schedule: 'verified' });
});

test('expansion restores the shape the view reads', () => {
  const [product] = expandApiPricingPayload(buildApiPricingPayload([card]));
  assert.equal(product.baseName, 'deepseek-v4');
  assert.deepEqual(product.memberSlugs, ['deepseek-v4']);
  assert.equal(product.benchmark_arena_elo, 12);
  assert.equal(product.providers?.slug, 'deepseek');
  assert.equal(product.versions[1].providers, product.versions[2].providers, 'shared provider object');
  assert.equal(product.versions[1].providers.logo_url, 'https://example.com/or.png');
  assert.equal(product.versions[0].model_slug, 'deepseek-v4');
  assert.equal(product.versions[2].model_slug, 'deepseek-v4-batch');
  assert.deepEqual(product.versions[2].variant, ['batch']);
  assert.equal(product.versions[2].notes, '[needs-verification] price unconfirmed');
  assert.equal(product.versions[2].member_shutdown_date, '2027-01-01');
  assert.equal(product.versions[1].data_for_discount, true);
  assert.equal(product.versions[1].price_variants?.length, 2);
  assert.equal(product.versions[1].price_variants?.[1].is_headline, true);
  assert.equal(getLowestPriceUSD(product), getLowestPriceUSD(card));
});

test('China badge keeps the sourced-evidence rule and stays zh-only', () => {
  const [product] = expandApiPricingPayload(buildApiPricingPayload([card]));
  assert.equal(showChinaBadge(product.versions[0].providers, 'zh'), true);
  assert.equal(showChinaBadge(product.versions[0].providers, 'en'), false);
  assert.equal(showChinaBadge(product.versions[1].providers, 'zh'), false);
});
