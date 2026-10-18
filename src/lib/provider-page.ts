import type { ChannelTermsFields } from './channel-terms';
import { jsonLd, SITE_URL } from './seo';
import { getProviderLogoSrc } from './provider-branding';
import type { EconomicPlan } from './plan-economics';
import type { ThirdPartyCoverage } from './third-party-coverage';
import { PRICE_UNIT_INFO, type CurrencyCode, type PriceUnit } from './currency';

export type ProviderRecord = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  website: string | null;
  api_docs_url: string | null;
  pricing_url: string | null;
  console_url: string | null;
  invite_url: string | null;
  logo: string | null;
  logo_url: string | null;
  type: string | null;
  region: string | null;
  access_from_china: boolean | null;
};

export type ProviderPlanRecord = EconomicPlan & ChannelTermsFields & {
  id: number;
  name: string;
  plan_kind: string | null;
  tier: string | null;
  notes: string | null;
  annual_price: number | null;
  price_yearly_monthly: number | null;
  features: unknown;
  monthly_message_limit: number | null;
  context_window: number | null;
  monthly_api_credit_usd?: number | null;
  monthly_api_credit_status?: string | null;
  legacy_ends_on?: string | null;
  last_verified?: Date | string | null;
  rate_limit: number | null;
  access_from_china: boolean | null;
  third_party_coverage: ThirdPartyCoverage | null;
  third_party_coverage_note: string | null;
};

export type ProviderModelRecord = { id: number; name: string; slug: string; model_category?: string | null };

export function providerModelPath(slug: string, category?: string | null): string {
  const route = category === 'video' ? 'video-models'
    : category === 'music' ? 'music-models'
      : category === 'world' ? 'world-models'
        : category === 'decision' ? 'decision-models' : 'models';
  return `/${route}/${encodeURIComponent(slug)}`;
}

export function formatProviderApiPrice(value: number | null | undefined, currency: CurrencyCode, unit: string | null | undefined, locale: string): string {
  if (value == null) return '—';
  const priceUnit = unit || 'per_1m_tokens';
  const label = PRICE_UNIT_INFO[priceUnit as PriceUnit]?.label[locale === 'zh' ? 'zh' : 'en']
    || `/${priceUnit.replace(/^per_/, '').replaceAll('_', ' ')}`;
  // API rates can be smaller than a cent; rounding to two decimals suggests free usage.
  const price = new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
    style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 6,
  }).format(value);
  return `${price}${label}`;
}

/** Structured data uses official URLs, independently of outbound CTA referrals. */
export function providerOrganization(provider: ProviderRecord, locale: string): string {
  const pageUrl = `${SITE_URL}/${locale}/providers/${encodeURIComponent(provider.slug)}`;
  const logo = getProviderLogoSrc(provider);
  const sameAs = [...new Set([
    provider.website, provider.api_docs_url, provider.pricing_url, provider.console_url,
  ].filter((url): url is string => !!url))];
  return jsonLd({
    '@type': 'Organization',
    '@id': `${pageUrl}#organization`,
    name: provider.name,
    url: provider.website || pageUrl,
    ...(logo ? { logo: new URL(logo, SITE_URL).toString() } : {}),
    ...(sameAs.length ? { sameAs } : {}),
  });
}
