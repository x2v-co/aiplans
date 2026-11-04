// Per-request render of /[locale]/plans for query-string variants
// (kind). Reached only through the rewrite in src/proxy.ts; a direct
// request to /[locale]/filtered/... is redirected back to the public URL.
export const dynamic = 'force-dynamic';
export { default, generateMetadata } from '../../plans/catalog-page';
