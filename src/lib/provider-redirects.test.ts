import assert from 'node:assert/strict';
import test from 'node:test';
import { unstable_getResponseFromNextConfig } from 'next/experimental/testing/server';
import nextConfig from '../../next.config';
import { providerRedirects } from './provider-redirects';

const origin = 'https://aiplans.dev';

test('configured provider redirects return 301 and preserve locale, slug and query', async () => {
  for (const locale of ['en', 'zh']) {
    for (const slug of ['openai', 'xai', 'elevenlabs', 'moonshot-global']) {
      const response = await unstable_getResponseFromNextConfig({ url: `${origin}/${locale}/plans/${slug}?period=yearly`, nextConfig });
      assert.equal(response.status, 301);
      assert.equal(response.headers.get('location'), `${origin}/${locale}/providers/${slug}?period=yearly`);
    }
  }
});

test('Cursor redirects directly to the retained xai slug', async () => {
  const response = await unstable_getResponseFromNextConfig({ url: `${origin}/zh/plans/cursor`, nextConfig });
  assert.equal(response.status, 301);
  assert.equal(response.headers.get('location'), `${origin}/zh/providers/xai`);
});

test('leaves plan index, nested plan pages, metadata, comparisons and other locales alone', async () => {
  for (const path of ['/en/plans', '/zh/plans/openai/plus', '/en/plans/opengraph-image', '/en/plans/opengraph-image.png', '/en/compare/plans/gpt-5', '/fr/plans/openai']) {
    const response = await unstable_getResponseFromNextConfig({ url: `${origin}${path}`, nextConfig });
    assert.equal(response.headers.get('location'), null, path);
  }
});

test('excludes static plan children from the provider rule', async () => {
  const config = { redirects: async () => providerRedirects(['featured', 'special.offers']) };
  for (const path of ['/en/plans/featured', '/zh/plans/special.offers']) {
    const response = await unstable_getResponseFromNextConfig({ url: `${origin}${path}`, nextConfig: config });
    assert.equal(response.headers.get('location'), null, path);
  }
  const response = await unstable_getResponseFromNextConfig({ url: `${origin}/en/plans/featured-ai`, nextConfig: config });
  assert.equal(response.status, 301);
});
