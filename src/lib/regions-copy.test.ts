import assert from 'node:assert/strict';
import test from 'node:test';
import { buildModelCopy } from './model-copy';
import { buildProviderCopy } from './provider-copy';

const channel = { input_price_per_1m: 1, output_price_per_1m: 2, currency: 'USD',
  providers: { name: 'Vendor', region: 'china', access_from_china: true } };
const provider = { name: 'Vendor', region: 'china', access_from_china: true, modelCount: 1, plans: [] };
const source = { supported_regions: ['CN'], regions_source_url: 'https://example.com/countries' };

test('provider and model summaries/FAQ omit China claims for unknown support in both locales', () => {
  for (const locale of ['zh', 'en'] as const) {
    const modelCopy = buildModelCopy({ name: 'Model', channels: [channel], plans: [] }, locale);
    assert.doesNotMatch(JSON.stringify(modelCopy), /中国大陆|mainland China|VPN/);
    assert.doesNotMatch(JSON.stringify(buildProviderCopy(provider, locale)), /中国大陆|mainland China|VPN/);
  }
});

test('official CN support permits restrained zh copy and keeps English free of China claims', () => {
  const sourced = { ...channel, providers: { ...channel.providers, ...source } };
  assert.match(JSON.stringify(buildModelCopy({ name: 'Model', channels: [sourced], plans: [] }, 'zh')), /官方支持地区包含中国大陆/);
  assert.match(JSON.stringify(buildProviderCopy({ ...provider, ...source }, 'zh')), /官方支持地区包含中国大陆/);
  assert.doesNotMatch(JSON.stringify(buildModelCopy({ name: 'Model', channels: [sourced], plans: [] }, 'en')), /China/);
  assert.doesNotMatch(JSON.stringify(buildProviderCopy({ ...provider, ...source }, 'en')), /China/);
});
