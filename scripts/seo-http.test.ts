import assert from 'node:assert/strict';
import test from 'node:test';

// Exercise real HTTP status codes against an independently started production
// server. No subprocesses, browser driver, DB changes or build are launched here.
const base = process.env.SEO_TEST_BASE_URL;
const request = (path: string) => fetch(new URL(path, base), {
  redirect: 'manual', headers: { 'user-agent': 'Googlebot', 'x-forwarded-proto': 'https' },
});

test('unknown localized/unlocalized paths return real HTTP 404, never homepage HTML', { skip: !base }, async () => {
  for (const path of ['/api-foo', '/go2', '/zh/xxx-not-exist', '/en/xxx-not-exist', '/fr']) {
    let response = await request(path);
    if ([301, 307, 308].includes(response.status)) {
      const target = new URL(response.headers.get('location')!, base);
      response = await request(target.pathname + target.search);
    }
    assert.equal(response.status, 404, path);
    const html = await response.text();
    assert.match(html, /404/);
    assert.match(html, path.startsWith('/zh/')
      ? /<title>页面不存在 \| aiplans<\/title>/
      : /<title>Page not found \| aiplans<\/title>/);
    assert.match(html, /name="robots" content="[^"]*noindex/);
  }
});

test('legitimate pages, locale redirects and old-slug 301 still work', { skip: !base }, async () => {
  for (const path of ['/en', '/zh', '/zh/guides', '/en/about']) {
    assert.equal((await request(path)).status, 200, path);
  }
  assert.equal((await request('/')).status, 308);
  const locale = await request('/guides');
  assert.equal(locale.status, 307);
  assert.match(locale.headers.get('location') ?? '', /\/en\/guides$/);
  const legacy = await request('/models/gpt-6.1-sol?utm=gsc');
  assert.equal(legacy.status, 301);
  assert.match(legacy.headers.get('location') ?? '', /\/en\/models\/openai-gpt-6-1-sol\?utm=gsc$/);
});

test('zh/guides HTML advertises the correct canonical, hreflang and navigation', { skip: !base }, async () => {
  const response = await request('/zh/guides');
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /rel="canonical" href="https:\/\/aiplans.dev\/zh\/guides"/);
  for (const tag of ['en', 'en-US', 'zh-CN', 'zh-Hans', 'x-default']) {
    assert.ok(html.includes(`hrefLang="${tag}"`) || html.includes(`hreflang="${tag}"`), tag);
  }
  assert.doesNotMatch(html, /name="(?:robots|googlebot)" content="[^"]*noindex/);
  assert.match(html, /href="\/zh\/guides"/);
});
