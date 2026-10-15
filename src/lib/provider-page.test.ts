import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMetadata } from './seo';
import { providerOrganization, providerModelPath, formatProviderApiPrice, type ProviderRecord } from './provider-page';
import en from '../../messages/en.json';
import zh from '../../messages/zh.json';

const provider: ProviderRecord = {
  id: 1, slug: 'elevenlabs', name: 'ElevenLabs', description: null,
  website: 'https://elevenlabs.io/', pricing_url: 'https://elevenlabs.io/pricing/api',
  api_docs_url: 'https://elevenlabs.io/docs', console_url: null, invite_url: null,
  logo: null, logo_url: '/providers/elevenlabs.png', region: 'global', type: 'official', access_from_china: null,
};

test('Organization uses official URLs and absolute logos, omitting missing links', () => {
  const schema = JSON.parse(providerOrganization(provider, 'en'));
  assert.equal(schema['@type'], 'Organization');
  assert.equal(schema.name, provider.name);
  assert.equal(schema.url, provider.website);
  assert.equal(schema.logo, 'https://aiplans.dev/providers/elevenlabs.png');
  assert.deepEqual(schema.sameAs, [provider.website, provider.api_docs_url, provider.pricing_url]);
  assert.ok(!JSON.stringify(schema).includes('try.elevenlabs.io'));
  const missing = JSON.parse(providerOrganization({ ...provider, website: null, pricing_url: null, api_docs_url: null, logo_url: null }, 'zh'));
  assert.equal(missing.url, 'https://aiplans.dev/zh/providers/elevenlabs');
  assert.equal(missing.logo, undefined);
  assert.equal(missing.sameAs, undefined);
});

test('provider metadata has localized canonical and hreflang at the new route', () => {
  const metadata = buildMetadata({
    locale: 'zh', path: '/providers/elevenlabs',
    title: { en: en.providerPage.metaTitle, zh: zh.providerPage.metaTitle },
    description: { en: en.providerPage.metaDescription, zh: zh.providerPage.metaDescription },
  });
  assert.equal(metadata.title, zh.providerPage.metaTitle);
  assert.equal(metadata.alternates?.canonical, 'https://aiplans.dev/zh/providers/elevenlabs');
  assert.equal(metadata.alternates?.languages?.en, 'https://aiplans.dev/en/providers/elevenlabs');
  assert.equal(metadata.alternates?.languages?.['zh-CN'], 'https://aiplans.dev/zh/providers/elevenlabs');
  assert.equal(metadata.alternates?.languages?.['x-default'], 'https://aiplans.dev/en/providers/elevenlabs');
  assert.deepEqual(Object.keys(en.providerPage).sort(), Object.keys(zh.providerPage).sort());
});

test('model links keep the existing multimodal detail routes', () => {
  assert.equal(providerModelPath('gpt-5', 'text'), '/models/gpt-5');
  assert.equal(providerModelPath('sora', 'video'), '/video-models/sora');
  assert.equal(providerModelPath('subq-snap', 'decision'), '/decision-models/subq-snap');
  assert.equal(providerModelPath('musicgen', 'music'), '/music-models/musicgen');
  assert.equal(providerModelPath('genie', 'world'), '/world-models/genie');
});

test('API prices preserve tiny paid rates, currency, billing units and unknown values', () => {
  assert.equal(formatProviderApiPrice(0.001, 'USD', 'per_1m_tokens', 'en'), '$0.001/1M tokens');
  assert.equal(formatProviderApiPrice(2.5, 'CNY', 'per_request', 'en'), 'CN¥2.50/request');
  assert.equal(formatProviderApiPrice(0, 'USD', null, 'en'), '$0.00/1M tokens');
  assert.equal(formatProviderApiPrice(null, 'USD', 'per_1m_tokens', 'en'), '—');
});
