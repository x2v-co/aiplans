import { AI_VERTICAL_CATALOG } from './ai-vertical-catalog';
import { publicModelDescription } from './public-catalog-copy';

/**
 * Model pages render the DB description, which the vertical seeds write in English
 * (bestFor + notes + Sources). Catalog rows with `descriptionZh` supply the zh copy;
 * the source links are kept, with a localized label.
 */
export function localizedModelDescription(slug: string, dbDescription: string | null | undefined, locale: string): string {
  if (locale === 'zh') {
    const item = AI_VERTICAL_CATALOG.find(entry => entry.slug === slug && entry.descriptionZh);
    if (item?.descriptionZh) {
      const sources = item.sourceUrls?.map(source => `${source.publisher}: ${source.url}`).join(' | ');
      return [item.descriptionZh, sources ? `来源：${sources}` : undefined].filter(Boolean).join('\n');
    }
  }
  return publicModelDescription(dbDescription);
}
