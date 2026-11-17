import CatalogPage, { generateMetadata as catalogMetadata } from './catalog-page';

// Retain ISR300: the prior performance fix recorded 16 concurrent crawler
// renders queuing for 8–28s on the 1.5-CPU server without this cache.
// Promotions are evaluated at render time. After 300s, ISR can serve stale
// HTML while revalidating; expiry appears after successful regeneration,
// not necessarily on the first request at the cutoff.
export const revalidate = 300;
// No database-backed catalog paths are prerendered at build time.
export function generateStaticParams() {
  return [];
}

// Filtered variants (?q=, ?sort=, ?order=, ?china=, ?region=, ?channel=, ?promo=) are rewritten by src/proxy.ts to
// /[locale]/filtered/api-pricing, which renders the same view per request.
type Props = { params: Promise<{ locale: string }> };
const NO_QUERY = Promise.resolve({});

export function generateMetadata({ params }: Props) {
  return catalogMetadata({ params, searchParams: NO_QUERY });
}

export default function Page({ params }: Props) {
  return CatalogPage({ params, searchParams: NO_QUERY });
}
