import CatalogPage from './catalog-page';

// Catalog pages are ISR (aiplans GSC 2026-11-04): rendered on first request,
// then served from the Next.js cache and regenerated in the background at most
// every 5 minutes (Cache-Control: s-maxage=300, stale-while-revalidate). Before
// this every crawler hit re-rendered the page and 16 concurrent requests queued
// for 8–28 s on the 1.5-CPU app container. Scheduled prices therefore switch
// within one revalidate window instead of on the exact request.
export const revalidate = 300;
// Empty list: nothing is prerendered at build (CI builds without a database);
// every locale/slug is rendered on demand and then cached.
export function generateStaticParams() {
  return [];
}

// Filtered variants (?models=) are rewritten by src/proxy.ts to
// /[locale]/filtered/compare/models, which renders the same view per request.
type Props = { params: Promise<{ locale: string }> };
const NO_QUERY = Promise.resolve({});

export default function Page({ params }: Props) {
  return CatalogPage({ params, searchParams: NO_QUERY });
}
