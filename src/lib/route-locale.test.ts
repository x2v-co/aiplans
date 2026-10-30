import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { isInfrastructurePath, isSupportedLocale } from './route-locale';

test('locale and infrastructure checks reject arbitrary prefixes', () => {
  for (const locale of ['en', 'zh']) assert.equal(isSupportedLocale(locale), true);
  for (const locale of ['api-foo', 'go2', 'fr', 'xxx-not-exist']) assert.equal(isSupportedLocale(locale), false);
  for (const path of ['/api', '/api/health', '/v1/catalog/models', '/go/source/campaign/product', '/_next/image']) {
    assert.equal(isInfrastructurePath(path), true, path);
  }
  for (const path of ['/api-foo', '/go2', '/v123', '/en/api-pricing', '/zh/guides']) {
    assert.equal(isInfrastructurePath(path), false, path);
  }
});

test('locale layout, homepage and info metadata validate before rendering/fetching content', () => {
  for (const file of ['src/app/[locale]/layout.tsx', 'src/app/[locale]/page.tsx']) {
    const source = readFileSync(file, 'utf8');
    assert.equal(source.match(/if \(!isSupportedLocale\(locale\)\) notFound\(\);/g)?.length, 2, file);
    assert.doesNotMatch(source, /messagesMap\[locale\] \|\| enMessages/);
  }
  const info = readFileSync('src/app/[locale]/[info]/page.tsx', 'utf8');
  assert.equal(info.match(/if \(!isInfoSlug\(info\)\) notFound\(\);/g)?.length, 2);
});
