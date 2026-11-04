// Per-request render of /[locale]/compare/models for query-string variants
// (models). Reached only through the rewrite in src/proxy.ts; a direct
// request to /[locale]/filtered/... is redirected back to the public URL.
export const dynamic = 'force-dynamic';
export { default } from '../../../compare/models/catalog-page';
