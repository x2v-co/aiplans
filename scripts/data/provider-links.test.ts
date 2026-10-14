import assert from 'node:assert/strict';
import test from 'node:test';
import { PROVIDER_LINK_FIELDS, PROVIDER_LINK_SEEDS, missingProviderLinks } from './provider-links';

const OFFICIAL_DOMAINS: Record<string, string[]> = {
  elevenlabs: ['elevenlabs.io'], openai: ['openai.com'], anthropic: ['anthropic.com', 'claude.com'],
  google: ['google.dev', 'google.com'], 'google-gemini': ['google.dev', 'google.com'],
  xai: ['x.ai'], grok: ['x.ai'], deepseek: ['deepseek.com'], mistral: ['mistral.ai'],
  moonshot: ['moonshot.cn'], 'moonshot-china': ['moonshot.cn'], 'moonshot-global': ['moonshot.ai'],
  zhipu: ['bigmodel.cn'], 'zhipu-china': ['bigmodel.cn'], 'zhipu-global': ['z.ai'],
  minimax: ['minimax.io'], 'minimax-global': ['minimax.io'], 'minimax-china': ['minimaxi.com'],
  alibaba: ['aliyun.com'], qwen: ['aliyun.com'],
};

test('seed URLs are HTTPS on each provider’s official domains, with no referral parameters', () => {
  for (const [slug, links] of Object.entries(PROVIDER_LINK_SEEDS)) {
    assert.ok(OFFICIAL_DOMAINS[slug], `official domains must be reviewed for ${slug}`);
    for (const [field, value] of Object.entries(links)) {
      const url = new URL(value);
      assert.equal(url.protocol, 'https:', `${slug}.${field}`);
      assert.ok(OFFICIAL_DOMAINS[slug].some(domain => url.hostname === domain || url.hostname.endsWith(`.${domain}`)), `${slug}: ${url.hostname}`);
      assert.equal(url.username, '');
      assert.equal(url.password, '');
      assert.equal(url.search, '');
    }
  }
  for (const slug of ['elevenlabs', 'openai', 'anthropic', 'google', 'xai', 'deepseek', 'mistral', 'moonshot', 'zhipu', 'minimax', 'qwen']) {
    assert.ok(PROVIDER_LINK_SEEDS[slug]);
  }
  assert.equal(PROVIDER_LINK_SEEDS.spacexsi, undefined, 'rebrand must keep xai as the database slug');
});

test('fills only NULL fields and preserves existing URLs and empty strings', () => {
  const current = { website: 'https://custom.example/', apiDocsUrl: null, pricingUrl: '', consoleUrl: null };
  assert.deepEqual(missingProviderLinks(current, PROVIDER_LINK_SEEDS.openai), {
    apiDocsUrl: PROVIDER_LINK_SEEDS.openai.apiDocsUrl, consoleUrl: PROVIDER_LINK_SEEDS.openai.consoleUrl,
  });
  assert.deepEqual(missingProviderLinks(current, {}), {});
  const filled = { ...current, ...missingProviderLinks(current, PROVIDER_LINK_SEEDS.openai) };
  assert.deepEqual(missingProviderLinks(filled, PROVIDER_LINK_SEEDS.openai), {}, 'second run is idempotent');
  assert.deepEqual(PROVIDER_LINK_FIELDS, ['website', 'apiDocsUrl', 'pricingUrl', 'consoleUrl']);
});
