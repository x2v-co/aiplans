import assert from 'node:assert/strict';
import test, { before } from 'node:test';
import { AsyncLocalStorage } from 'node:async_hooks';

// Next normally installs this during server bootstrap. The standalone Node test
// runner must install the real implementation before loading Next's helpers.
let unstable_getResponseFromNextConfig: typeof import('next/experimental/testing/server').unstable_getResponseFromNextConfig;
let nextConfig: typeof import('../../next.config').default;
before(async () => {
  Object.assign(globalThis, { AsyncLocalStorage });
  ({ unstable_getResponseFromNextConfig } = await import('next/experimental/testing/server'));
  ({ default: nextConfig } = await import('../../next.config'));
});
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

test('locale-less provider plan URLs reach the provider page in one 301 hop', async () => {
  for (const slug of ['mistral', 'azure-openai', 'moonshot-global', 'grok']) {
    const response = await unstable_getResponseFromNextConfig({ url: `${origin}/plans/${slug}?period=yearly`, nextConfig });
    assert.equal(response.status, 301, slug);
    assert.equal(response.headers.get('location'), `${origin}/en/providers/${slug}?period=yearly`);
  }
  const cursor = await unstable_getResponseFromNextConfig({ url: `${origin}/plans/cursor`, nextConfig });
  assert.equal(cursor.status, 301);
  assert.equal(cursor.headers.get('location'), `${origin}/en/providers/xai`);
});

test('locale-less plan index and metadata routes are left to the proxy', async () => {
  for (const path of ['/plans', '/plans/opengraph-image', '/plans/openai/plus']) {
    const response = await unstable_getResponseFromNextConfig({ url: `${origin}${path}`, nextConfig });
    assert.equal(response.headers.get('location'), null, path);
  }
});
