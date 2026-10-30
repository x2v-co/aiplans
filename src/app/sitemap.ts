import { buildSitemap } from '@/lib/build-sitemap';

export const dynamic = 'force-dynamic';

export default async function sitemap() {
  return buildSitemap();
}
