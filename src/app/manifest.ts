import type { MetadataRoute } from 'next';
import { SITE_NAME } from '@/lib/seo';

/**
 * Web app manifest via the Next.js Metadata Route (served at /manifest.webmanifest
 * and linked automatically from <head>). There is no static manifest file in
 * public/ — like sitemap.xml and robots.txt, a static file would shadow this
 * route.
 *
 * The single 300x300 /logo.png covers the icon slot; browsers rescale it for
 * install surfaces. Keep themeColor in sync with the viewport themeColor in
 * [locale]/layout.tsx (#2563eb).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description:
      'Compare AI model API token prices and subscription plans across every official, cloud and aggregator channel.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#2563eb',
    icons: [
      {
        src: '/logo.png',
        sizes: '300x300',
        type: 'image/png',
        purpose: 'any',
      },
    ],
    categories: ['productivity', 'developer', 'finance'],
  };
}
