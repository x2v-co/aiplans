import { createTranslator } from 'next-intl';
import enMessages from '../../messages/en.json';
import zhMessages from '../../messages/zh.json';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EntitlementLine } from '@/components/data-trust-label';
import { planCardCopy, planMoney, planPriceState, type PlanHighlightFields } from '@/lib/plan-card-display';
import { planEntitlementTrust, planPriceTrust, reviewedPlanSource, safeSourceUrl, type PlanTrustRow } from '@/lib/data-trust';
import { providerDisplayName } from '@/lib/provider-display-name';
import { labelNonLlmPriceKey } from '@/lib/non-llm-price-labels';
import { pricingLabel } from '@/lib/model-pricing-seo';
import type { ModelUsagePriceRow } from '@/lib/model-usage-prices';
import type { ChannelTermsFields } from '@/lib/channel-terms';
import { normalizeThirdPartyCoverage, type PlanCoverageFields } from '@/lib/third-party-coverage';

export interface ModelPlanCardRow extends PlanTrustRow, ChannelTermsFields, Partial<PlanCoverageFields>, PlanHighlightFields {
  id: number;
  name: string;
  slug: string;
  tier: string | null;
  price: number | null;
  annual_price: number | null;
  price_yearly_monthly?: number | null;
  currency: string | null;
  features: unknown;
  access_from_china: boolean | null;
  plan_kind: string | null;
  providers: { id: number; name: string; name_en?: string | null; slug: string; logo: string | null;
    pricing_url?: string | null; website?: string | null } | null;
}

export function ModelPlanCard({ plan, locale, now, usagePrices = [], recommended, bestValue }: {
  plan: ModelPlanCardRow;
  locale: string;
  now: Date;
  usagePrices?: ModelUsagePriceRow[];
  recommended?: boolean;
  bestValue?: boolean;
}) {
  // Native <details> needs no client state. Keep the static card on the server
  // so dates, currency and translations are computed once per request.
  const messages = locale === 'zh' ? zhMessages : enMessages;
  const t = createTranslator({ locale, messages, namespace: 'modelDetail' });
  const quota = createTranslator({ locale, messages, namespace: 'quota' });
  const terms = createTranslator({ locale, messages, namespace: 'channelTerms' });
  const source = reviewedPlanSource(plan.providers?.slug, locale, plan.providers
    ? { ...plan.providers, name: providerDisplayName(plan.providers, locale) } : null);
  const priceTrust = planPriceTrust(plan, source, locale, now, plan.providers?.slug);
  const entitlementTrust = planEntitlementTrust(plan, source, locale, now);
  const copy = planCardCopy({
    name: plan.name,
    locale,
    structured: plan,
    features: plan.features,
    sourceLabel: priceTrust.sourceLabel,
    notes: plan.notes,
    conditions: [
      ...priceTrust.conditions, ...entitlementTrust.conditions,
      `${quota('coverage')}: ${quota(`coverageValues.${normalizeThirdPartyCoverage(plan.third_party_coverage)}`)}`,
      plan.access_from_china ? t('chinaAvailable') : null,
      plan.data_for_discount ? terms('training') : null,
    ],
  });
  const sourceUrl = priceTrust.sourceUrl || safeSourceUrl(usagePrices[0]?.source_url)
    || safeSourceUrl(plan.notes?.match(/https?:\/\/[^\s]+/)?.[0]);
  const flags = priceTrust.flags;
  const currency = plan.currency || 'USD';
  const priceState = planPriceState(plan);
  const period = !plan.price_unit || plan.price_unit === 'per_month' ? t('month')
    : plan.price_unit === 'per_year' ? t('year') : labelNonLlmPriceKey(plan.price_unit, locale);

  return <Card data-plan-card={plan.id} className={`min-w-0 gap-3 py-4 ${recommended
    ? 'border-2 border-blue-500' : bestValue ? 'border-2 border-green-500' : ''}`}>
    <CardHeader className="gap-2 px-4">
      {plan.providers && <div className="text-xs text-zinc-500" data-plan-provider={plan.providers.slug}>{providerDisplayName(plan.providers, locale)}</div>}
      <CardTitle className="line-clamp-2 text-lg leading-6 [overflow-wrap:anywhere]">{copy.name}</CardTitle>
      <div className="flex flex-wrap gap-1 text-xs">
        {(copy.unverified || flags.unverified) && <Badge variant="outline" className="text-amber-700 dark:text-amber-400">{t('unverified')}</Badge>}
        {flags.expired && <Badge variant="outline" className="text-red-700 dark:text-red-400">{t('expired')}</Badge>}
        {flags.stale && <Badge variant="outline" className="text-amber-700 dark:text-amber-400">{t('stale')}</Badge>}
      </div>
      <div>
        {priceState === 'contactSales' ? <div className="text-xl font-bold">{t('contactSales')}</div>
          : priceState === 'priceUnknown' ? <div className="text-xl font-bold">{t('priceUnknown')}</div>
          : priceState === 'free' ? <div className="text-2xl font-bold">{t('free')}</div>
          : <div className="text-2xl font-bold">
            {planMoney(plan.price!, currency)}
            <span className="text-sm font-normal text-zinc-500"> / {period}</span>
          </div>}
        {priceState !== 'contactSales' && plan.annual_price != null && <div className="mt-1 text-sm text-zinc-500">
          {planMoney(plan.annual_price, currency)} / {t('year')}
        </div>}
        {usagePrices.length > 0 && <div className="mt-2 max-h-32 space-y-1 overflow-y-auto text-sm">
          {usagePrices.map(row => <div key={row.id}>
            {labelNonLlmPriceKey(row.price_kind, locale)}: {pricingLabel(row.price, row.currency)} / {labelNonLlmPriceKey(row.unit, locale)}
          </div>)}
        </div>}
      </div>
    </CardHeader>
    <CardContent className="space-y-3 px-4">
      {copy.points.length > 0 && <ul className="space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
        {copy.points.map(point => <li key={point} className="line-clamp-2 [overflow-wrap:anywhere]">
          <EntitlementLine text={point} locale={locale} />
        </li>)}
      </ul>}
      {priceTrust.verifiedOn && <div className="text-xs text-zinc-500">
        {t('lastVerified')}: <time dateTime={priceTrust.verifiedOn}>{priceTrust.verifiedOn}</time>
      </div>}
      {sourceUrl ? <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-block text-sm text-blue-600 hover:underline dark:text-blue-400">{t('source')}</a>
        : <p className="text-xs text-zinc-500">{t('sourceNotRecorded')}</p>}
      {copy.details.length > 0 && <details className="text-sm text-zinc-600 dark:text-zinc-400">
        <summary className="cursor-pointer">{t('details')}</summary>
        <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto [overflow-wrap:anywhere]">
          {copy.details.map(text => <li key={text}><EntitlementLine text={text} locale={locale} /></li>)}
        </ul>
      </details>}
    </CardContent>
  </Card>;
}
