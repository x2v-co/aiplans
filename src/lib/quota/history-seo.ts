import en from '../../../messages/en.json';
import zh from '../../../messages/zh.json';
import { buildMetadata, jsonLd, SITE_URL, type Locale } from '../seo';
import type { QuotaChange } from './estimates';

export function quotaHistoryMetadata(locale: Locale, hasChanges: boolean) {
  return buildMetadata({
    locale, path: '/quota-changes', noindex: !hasChanges,
    title: { en: en.quota.historyTitle, zh: zh.quota.historyTitle },
    description: { en: en.quota.historyDescription, zh: zh.quota.historyDescription },
  });
}

/** Describe the collection only. Token estimates and price claims never enter JSON-LD. */
export function quotaHistoryJsonLd(locale: Locale, changes: QuotaChange[]) {
  const copy = locale === 'zh' ? zh.quota : en.quota;
  const url = `${SITE_URL}/${locale}/quota-changes`;
  return jsonLd({
    '@type': 'CollectionPage', name: copy.historyTitle, description: copy.historyDescription,
    url, inLanguage: locale === 'zh' ? 'zh-CN' : 'en',
    mainEntity: {
      '@type': 'ItemList', numberOfItems: changes.length,
      itemListElement: changes.map(({ previous, next }, index) => ({
        '@type': 'ListItem', position: index + 1,
        name: `${next.planName} · ${next.servedModel ?? copy.unknown}`,
        url: `${url}#change-${previous.id}-${next.id}`,
      })),
    },
  }).replace(/</g, '\\u003c');
}
