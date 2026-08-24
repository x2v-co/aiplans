import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

/**
 * robots.txt via the Next.js Metadata Route. There must be no static
 * `public/robots.txt` — it would shadow this route the same way a stale
 * public/sitemap.xml used to shadow the dynamic sitemap (that bug served
 * 85 stale URLs from 2026-03 to 2026-08).
 *
 * Allow crawling the pages, disallow only the non-HTML routes, and point
 * crawlers at the DB-driven sitemap.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Never disallow /_next/ — blocking JS/CSS assets stops Google
        // rendering the page. /api/ is JSON-only (no HTML to index), /go/
        // is an outbound-redirect hop, and the error pages have no content.
        disallow: ['/api/', '/go/', '/404', '/500'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
