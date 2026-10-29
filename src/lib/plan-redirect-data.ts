import { sql } from './db';
import { cachePlanRedirectCatalog, type PlanRedirectRow } from './provider-redirects';

// UNION ALL preserves ambiguous plan rows. LEFT JOIN also counts plans without
// an owner, so they cannot accidentally make another plan look unambiguous.
export const getPlanRedirectCatalog = cachePlanRedirectCatalog(async () => [
  ...await sql<PlanRedirectRow[]>`
    SELECT 'provider' AS kind, slug, slug AS provider_slug FROM providers
    UNION ALL
    SELECT 'plan' AS kind, plans.slug, providers.slug AS provider_slug
    FROM plans
    LEFT JOIN providers ON providers.id = plans.provider_id
  `,
]);
