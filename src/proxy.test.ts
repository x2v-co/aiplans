import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import proxy, { config, requestUsedHttp } from './proxy';
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';

test('permanently redirects Cloudflare HTTP requests to the same HTTPS URL', async () => {
  const request = new NextRequest('http://aiplans.dev/zh/models/claude-opus-5?source=test', {
    headers: { 'cf-visitor': '{"scheme":"http"}' },
  });

  const response = await proxy(request);

  assert.equal(requestUsedHttp(request), true);
  assert.equal(response.status, 308);
  assert.equal(response.headers.get('location'), 'https://www.aiplans.dev/zh/models/claude-opus-5?source=test');
  assert.match(response.headers.get('location') ?? '', /^https:\/\//);
});

test('keeps Cloudflare HTTPS requests on the normal routing path', async () => {
  const request = new NextRequest('https://aiplans.dev/en', {
    headers: { 'cf-visitor': '{"scheme":"https"}', 'x-forwarded-proto': 'https' },
  });

  const response = await proxy(request);

  assert.equal(requestUsedHttp(request), false);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('location'), null);
});

test('301s an old model slug to the live catalog slug and keeps the query', async () => {
  const request = new NextRequest('https://aiplans.dev/en/models/gpt-6.1-sol?utm=gsc', {
    headers: { 'x-forwarded-proto': 'https' },
  });
  const response = await proxy(request);
  assert.equal(response.status, 301);
  assert.match(response.headers.get('location') ?? '', /\/en\/models\/openai-gpt-6-1-sol\?utm=gsc$/);
});

test('301s a locale-less dotted slug in one hop', async () => {
  const request = new NextRequest('https://aiplans.dev/compare/plans/kimi-k2.5', {
    headers: { 'x-forwarded-proto': 'https' },
  });
  const response = await proxy(request);
  assert.equal(response.status, 301);
  assert.match(response.headers.get('location') ?? '', /\/en\/compare\/plans\/kimi-k3$/);
});

test('301s a glued compare slug to the first model', async () => {
  const request = new NextRequest('https://aiplans.dev/zh/compare/plans/glm-5glm-5.1', {
    headers: { 'x-forwarded-proto': 'https' },
  });
  const response = await proxy(request);
  assert.equal(response.status, 301);
  assert.match(response.headers.get('location') ?? '', /\/zh\/compare\/plans\/glm-5\.3$/);
});

test('uses X-Forwarded-Proto when Cloudflare metadata is unavailable', async () => {
  const request = new NextRequest('http://aiplans.dev/en/api-pricing', {
    headers: { 'x-forwarded-proto': 'http, https' },
  });

  assert.equal(requestUsedHttp(request), true);
  assert.equal((await proxy(request)).headers.get('location'), 'https://www.aiplans.dev/en/api-pricing');
});

test('root redirects permanently (308) to the default locale for crawlers', async () => {
  const response = await proxy(new NextRequest('https://aiplans.dev/', { headers: { 'x-forwarded-proto': 'https' } }));
  assert.equal(response.status, 308);
  assert.match(response.headers.get('location') ?? '', /\/en$/);
});

test('root keeps a temporary 307 for a saved non-default locale', async () => {
  const response = await proxy(new NextRequest('https://aiplans.dev/', {
    headers: { 'x-forwarded-proto': 'https', cookie: 'NEXT_LOCALE=zh' },
  }));
  assert.equal(response.status, 307);
  assert.match(response.headers.get('location') ?? '', /\/zh$/);
});

test('root ignores an unknown locale cookie', async () => {
  const response = await proxy(new NextRequest('https://aiplans.dev/', {
    headers: { 'x-forwarded-proto': 'https', cookie: 'NEXT_LOCALE=fr' },
  }));
  assert.equal(response.status, 308);
  assert.match(response.headers.get('location') ?? '', /\/en$/);
});

test('unknown prefix paths get the normal locale hop, never bypass routing as infrastructure', async () => {
  for (const path of ['/api-foo', '/go2', '/v123']) {
    const response = await proxy(new NextRequest(`https://aiplans.dev${path}`, {
      headers: { 'x-forwarded-proto': 'https' },
    }));
    assert.equal(response.status, 307, path);
    assert.equal(new URL(response.headers.get('location')!).pathname, `/en${path}`);
  }
});

test('valid locale pages, dotted slugs and service segments stay on their own routes', async () => {
  for (const path of ['/zh/guides', '/en/about', '/en/models/non-legacy-model', '/en/models/minimax-m3.1-flash', '/zh/models/minimax-m3.1-flash', '/api/health', '/v1/catalog/models', '/go/source/campaign/product']) {
    const response = await proxy(new NextRequest(`https://aiplans.dev${path}`, {
      headers: { 'x-forwarded-proto': 'https' },
    }));
    assert.equal(response.headers.get('location'), null, path);
    assert.equal(response.headers.get('x-middleware-next'), '1', path);
  }
});


test('Next matcher excludes complete service segments while keeping similarly named pages', () => {
  for (const url of ['/api-foo', '/go2', '/zh/xxx-not-exist', '/en', '/guides']) {
    assert.equal(unstable_doesMiddlewareMatch({ config, url }), true, url);
  }
  for (const url of ['/api/health', '/v1/catalog/models', '/go/a/b/c', '/_next/static/chunk.js', '/favicon.ico']) {
    assert.equal(unstable_doesMiddlewareMatch({ config, url }), false, url);
  }
});

test('locale-less model pages redirect even when their slug contains dots', async () => {
  for (const path of ['/models/minimax-m3.1-flash', '/models/gpt-5']) {
    assert.equal(unstable_doesMiddlewareMatch({ config, url: path }), true, path);
    const response = await proxy(new NextRequest(`https://aiplans.dev${path}?source=test`));
    assert.equal(response.status, 307, path);
    assert.equal(response.headers.get('location'), `https://aiplans.dev/en${path}?source=test`, path);
  }
});

test('static assets and infrastructure never receive a locale prefix', async () => {
  for (const path of [
    '/favicon.ico', '/sitemap.xml', '/robots.txt', '/manifest.webmanifest',
    '/providers/moonshot.png', '/logo.svg', '/_next/static/chunk.js', '/_next/image',
  ]) {
    // Exercise the proxy as well as the matcher: some assets are excluded at
    // the matcher, while others reach the proxy and must pass through.
    const response = await proxy(new NextRequest(`https://aiplans.dev${path}`));
    assert.equal(response.headers.get('location'), null, path);
    assert.equal(response.headers.get('x-middleware-next'), '1', path);
  }
});
