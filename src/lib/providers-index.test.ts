import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { buildMetadata } from './seo';
import { buildProvidersIndexCopy } from './providers-index';

test('providers index copy localizes title, model counts and breadcrumb', () => {
  const zh = buildProvidersIndexCopy('zh', 12);
  const en = buildProvidersIndexCopy('en', 12);
  assert.match(zh.title, /12 家/);
  assert.match(en.title, /12 providers/);
  assert.equal(zh.modelCount(1), '1 个模型');
  assert.equal(en.modelCount(1), '1 model');
  assert.equal(en.modelCount(2), '2 models');
  assert.equal(zh.breadcrumb, '供应商');
  assert.equal(en.breadcrumb, 'Providers');
});

test('providers index metadata has localized canonical and hreflang', () => {
  const copy = buildProvidersIndexCopy('zh', 8);
  const metadata = buildMetadata({
    locale: 'zh',
    path: '/providers',
    title: { en: buildProvidersIndexCopy('en', 8).title, zh: copy.title },
    description: { en: buildProvidersIndexCopy('en', 8).description, zh: copy.description },
  });
  assert.equal(metadata.title, copy.title);
  assert.equal(metadata.alternates?.canonical, 'https://aiplans.dev/zh/providers');
  assert.equal(metadata.alternates?.languages?.en, 'https://aiplans.dev/en/providers');
  assert.equal(metadata.alternates?.languages?.['zh-CN'], 'https://aiplans.dev/zh/providers');
  assert.equal(metadata.alternates?.languages?.['x-default'], 'https://aiplans.dev/en/providers');
});

test('providers list route, sitemap and search index discover /providers', () => {
  // Fixed sitemap paths live in sitemap-static-paths.ts (with their lastmod source).
  const sitemap = readFileSync(new URL('./sitemap-static-paths.ts', import.meta.url), 'utf8');
  const search = readFileSync(new URL('../app/api/search-index/route.ts', import.meta.url), 'utf8');
  const page = readFileSync(new URL('../app/[locale]/providers/page.tsx', import.meta.url), 'utf8');
  const detail = readFileSync(new URL('../app/[locale]/providers/[slug]/page.tsx', import.meta.url), 'utf8');
  assert.ok(sitemap.includes("path: '/providers'"));
  assert.ok(search.includes("slug: 'providers'"));
  assert.match(page, /generateMetadata/);
  assert.match(page, /getProvidersForIndex/);
  assert.match(page, /ProviderLogo/);
  assert.match(detail, /\/providers`/);
  assert.match(detail, /backToProviders/);
});
