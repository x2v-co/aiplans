import type { GroupedProduct } from './grouped-products';
import { isPrimaryModelVariant, modelFreshnessTime } from './model-freshness';

export function recentComparisonModels(products: GroupedProduct[]): GroupedProduct[] {
  return products.filter(p => isPrimaryModelVariant(p.slug) && !p.slug.startsWith('~'))
    .sort((a, b) => modelFreshnessTime(b) - modelFreshnessTime(a) || a.slug.localeCompare(b.slug));
}

export function comparisonPickerProducts(products: GroupedProduct[], query: string): GroupedProduct[] {
  const q = query.trim().toLowerCase();
  return q ? products.filter(p => [p.name, p.slug, p.baseName, p.providers?.name, ...(p.memberSlugs || [])]
    .some(value => value?.toLowerCase().includes(q))) : recentComparisonModels(products).slice(0, 60);
}

export function defaultComparisonSlugs(products: GroupedProduct[], vendorSlugs: string[], requested: string[]): string[] {
  const valid = new Set(products.map(p => p.slug));
  const selected = new Set(requested.filter(slug => valid.has(slug)).slice(0, 4));
  const recent = recentComparisonModels(products);
  const leaders = new Set(vendorSlugs);
  for (const product of [...recent.filter(p => leaders.has(p.slug)), ...recent]) {
    if (selected.size >= 2) break;
    selected.add(product.slug);
  }
  return [...selected];
}
