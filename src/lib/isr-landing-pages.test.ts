import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The homepage and the video/music landing pages were rendered per request
// (Cache-Control: private, no-store) because they export neither revalidate
// nor generateStaticParams under the dynamic [locale] segment. They are ISR now,
// like the catalog pages, so they must not read anything request-specific.
const PAGES = ['page.tsx', 'video-models/page.tsx', 'music-models/page.tsx'];
const read = (path: string) => readFileSync(new URL(`../app/[locale]/${path}`, import.meta.url), 'utf8');

test('landing pages are ISR with a 5-minute revalidate', () => {
  for (const path of PAGES) {
    const source = read(path);
    assert.match(source, /export const revalidate = 300;/, path);
    assert.match(source, /export function generateStaticParams\(\)/, path);
  }
});

test('ISR landing pages read no per-request input', () => {
  for (const path of PAGES) {
    const source = read(path);
    assert.doesNotMatch(source, /\bsearchParams\b/, path);
    assert.doesNotMatch(source, /\b(cookies|headers|connection|draftMode)\(\)/, path);
    assert.doesNotMatch(source, /unstable_noStore|force-dynamic/, path);
  }
  for (const path of ['home-view.tsx']) {
    assert.doesNotMatch(read(path), /useSearchParams|\bcookies\(/, path);
  }
  const vertical = readFileSync(new URL('../components/vertical-landing-page.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(vertical, /useSearchParams|\bcookies\(|\bheaders\(\)/);
});
