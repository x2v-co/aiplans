// Per-request render of /[locale]/providers/[slug] for query-string variants
// (period). Reached only through the rewrite in src/proxy.ts; a direct
// request to /[locale]/filtered/... is redirected back to the public URL.
export const dynamic = 'force-dynamic';
export { default, generateMetadata } from '../../../providers/[slug]/catalog-page';
