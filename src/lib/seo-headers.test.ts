import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { seoAssetHeaders } from './seo-headers';

/** Minimal path-to-regexp for the patterns used here (`:path*` = zero or more segments). */
function matches(source: string, pathname: string): boolean {
  const re = new RegExp(`^${source.replace('/:path*', '(?:/[^/]+)*')}$`);
  return re.test(pathname);
}

test('opengraph-image routes get X-Robots-Tag noindex at every depth', () => {
  const rules = seoAssetHeaders();
  for (const path of ['/en/opengraph-image', '/zh/models/openai-gpt-6-1-sol/opengraph-image',
    '/en/compare/plans/kimi-k3/opengraph-image', '/opengraph-image']) {
    const rule = rules.find(r => matches(r.source, path));
    assert.ok(rule, path);
    assert.deepEqual(rule.headers, [{ key: 'X-Robots-Tag', value: 'noindex' }]);
  }
  for (const path of ['/en/models/openai-gpt-6-1-sol', '/en/models/opengraph-image-guide/foo']) {
    assert.equal(rules.some(r => matches(r.source, path)), false, path);
  }
});

test('next.config wires the SEO asset headers', () => {
  const config = readFileSync('next.config.ts', 'utf8');
  assert.match(config, /seoAssetHeaders\(\)/);
});
