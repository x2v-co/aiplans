import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { buildMetadata } from './seo';
import { STATIC_PATHS } from './sitemap-static-paths';
import { PRICING_GUIDE_SLUGS } from './pricing-guides';

test('guides index and every guide remain in both locale sitemaps', () => {
  const paths = new Set(STATIC_PATHS.map(entry => entry.path));
  assert.ok(paths.has('/guides'));
  for (const slug of PRICING_GUIDE_SLUGS) assert.ok(paths.has(`/guides/${slug}`));
  const sitemap = readFileSync('src/lib/build-sitemap.ts', 'utf8');
  assert.match(sitemap, /for \(const locale of LOCALES\)/);
  assert.match(sitemap, /for \(const \{ path, priority, changefreq, lastmod \} of STATIC_PATHS\)/);
});

test('zh/guides is indexable, self-canonical and has matching en/zh hreflang paths', () => {
  const source = readFileSync('src/app/[locale]/guides/page.tsx', 'utf8');
  assert.match(source, /path: '\/guides'/);
  assert.doesNotMatch(source, /noindex: true/);
  const metadata = buildMetadata({ locale: 'zh', path: '/guides',
    title: { en: 'Guides', zh: '指南' }, description: { en: 'Guides', zh: '指南' } });
  assert.equal(metadata.alternates?.canonical, 'https://aiplans.dev/zh/guides');
  assert.deepEqual(metadata.alternates?.languages, {
    en: 'https://aiplans.dev/en/guides', 'en-US': 'https://aiplans.dev/en/guides',
    'zh-CN': 'https://aiplans.dev/zh/guides', 'zh-Hans': 'https://aiplans.dev/zh/guides',
    'x-default': 'https://aiplans.dev/en/guides',
  });
  assert.equal(typeof metadata.robots === 'object' && metadata.robots?.index, true);
});

test('header shares guides entry with desktop and mobile; footer and detail pages link back', () => {
  for (const file of ['src/components/SiteHeader.tsx', 'src/components/Footer.tsx', 'src/app/[locale]/guides/[slug]/page.tsx']) {
    assert.ok(readFileSync(file, 'utf8').includes('/${locale}/guides'), file);
  }
  const header = readFileSync('src/components/SiteHeader.tsx', 'utf8');
  assert.match(header, /mobileTopLinks = \[homeLink, \.\.\.utilityLinks\]/);
  assert.match(header, /utilityLinks\.map/);
});
