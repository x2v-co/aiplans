/**
 * Response headers that keep generated assets out of Google's index.
 *
 * Every page has an `opengraph-image` route (the PNG Next.js renders for
 * og:image). Google crawls and indexes those URLs as standalone results, which
 * adds thousands of thin image URLs to the crawl budget. Social previews only
 * read the og:image URL and ignore X-Robots-Tag, so `noindex` is safe for them.
 * next.config.ts applies these via `headers()`, which also covers the dynamic
 * `?<hash>` variants because matching uses the path only.
 */
export const OG_IMAGE_ROBOTS = 'noindex';

export function seoAssetHeaders() {
  const header = [{ key: 'X-Robots-Tag', value: OG_IMAGE_ROBOTS }];
  return [
    { source: '/opengraph-image', headers: header },
    { source: '/:path*/opengraph-image', headers: header },
    { source: '/twitter-image', headers: header },
    { source: '/:path*/twitter-image', headers: header },
  ];
}
