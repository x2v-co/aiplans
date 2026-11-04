// Per-request render of /[locale]/api-pricing for query-string variants
// (q, sort, order, china, region, channel, promo). Reached only through the rewrite in src/proxy.ts; a direct
// request to /[locale]/filtered/... is redirected back to the public URL.
export const dynamic = 'force-dynamic';
export { default, generateMetadata } from '../../api-pricing/catalog-page';
