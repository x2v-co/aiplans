import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import proxy, { requestUsedHttp } from './proxy';

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
