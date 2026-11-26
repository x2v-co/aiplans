export type CatalogIdentity = { id: number; slug: string };
export type CatalogRedirect = { old_slug: string; model_id: number };

/** Redirects are persisted review results, never inferred from SEO or fuzzy names. */
export function resolveCatalogIdentity<T extends CatalogIdentity>(
  slug: string, catalog: readonly T[], redirects: readonly CatalogRedirect[],
): T | undefined {
  const direct = catalog.filter(row => row.slug === slug);
  const aliases = redirects.filter(row => row.old_slug === slug);
  const ids = new Set([...direct.map(row => row.id), ...aliases.map(row => row.model_id)]);
  if (ids.size > 1 || direct.length > 1 || aliases.length > 1) throw new Error(`Ambiguous catalog identity: ${slug}`);
  const id = [...ids][0];
  if (id === undefined) return undefined;
  const result = catalog.find(row => row.id === id);
  if (!result) throw new Error(`Dangling catalog redirect: ${slug}`);
  return result;
}
