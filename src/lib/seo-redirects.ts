import { getSeoIndexCatalog, getSeoProviderCatalog } from './seo-index-data';
import { modelCanonicalSlug, modelShouldIndex, providerShouldIndex, verticalShouldIndex } from './seo-index-policy';
import type { AiCatalogKind } from './ai-vertical-catalog';
import { decodeSlugParam } from './route-params';

export function isSeoCatalogDetail(path: string): boolean {
  return /^\/(?:en|zh)\/(?:models|providers|(?:video|music|world|decision|voice|image|embedding)-models)\/[^/]+\/?$/.test(path);
}

/** Identity resolution is separate from redirect permission. Every catalog
 * destination must exist and pass the same gate as its metadata and sitemap.
 */
export async function seoDestinationIndexable(path: string): Promise<boolean> {
  const pathname = path.split('#')[0];
  const model = /^\/(?:en|zh)\/models\/([^/]+)$/.exec(pathname);
  if (model) {
    const slug = decodeSlugParam(model[1]);
    const facts = (await getSeoIndexCatalog()).find(row => row.slug === slug);
    return !!facts && modelCanonicalSlug(slug) === slug && modelShouldIndex(facts);
  }
  const provider = /^\/(?:en|zh)\/providers\/([^/]+)$/.exec(pathname);
  if (provider) {
    const slug = decodeSlugParam(provider[1]);
    return providerShouldIndex(slug) && (await getSeoProviderCatalog()).some(row => row.slug === slug);
  }
  const vertical = /^\/(?:en|zh)\/((?:video|music|world|decision|voice|image|embedding)-models)\/([^/]+)$/.exec(pathname);
  if (vertical) {
    const { getVerticalModelCatalog } = await import('./vertical-models');
    const kind = vertical[1].slice(0, -1) as AiCatalogKind;
    const slug = decodeSlugParam(vertical[2]);
    const item = (await getVerticalModelCatalog(kind)).find(row => row.slug === slug);
    return !!item && verticalShouldIndex(kind, slug, item.shutdownDate);
  }
  // These existing core landings have no catalog existence dependency.
  return /^\/(?:en|zh)\/(?:models|compare\/plans)$/.test(pathname);
}
