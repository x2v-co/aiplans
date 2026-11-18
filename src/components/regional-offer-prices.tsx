import React from 'react';
import { createTranslator } from 'next-intl';
import en from '../../messages/en.json';
import zh from '../../messages/zh.json';
import type { ComparisonContext } from '@/lib/price-offers/compare';
import type { Offer, EvidenceScope } from '@/lib/price-offers/contract';
import { presentOffers, rationalText } from '@/lib/price-offers/presentation';

type ReasonKey = keyof typeof en.regionalOffers.reasons;
function reasonKey(reason: string): ReasonKey {
  if (reason.startsWith('fx_')) return 'fx';
  if (reason.startsWith('evidence_')) return 'evidence';
  if (reason.startsWith('freshness_')) return 'freshness';
  if (reason.endsWith('_unverified')) return 'unverified';
  const keys: Record<string, ReasonKey> = { entitlement_not_equivalent: 'rights', market_or_channel_unknown: 'market',
    billing_commitment_or_unit_mismatch: 'billing', promotion_context_mismatch: 'promotion',
    eligibility_context_mismatch: 'eligibility', tax_not_comparable: 'tax',
    purchase_qualification_unknown_or_different: 'qualification', validity_unknown_or_inactive: 'validity',
    renewal_association_unknown: 'renewal', price_unknown_or_sales: 'price' };
  return keys[reason] ?? 'unverified';
}

/** Server-only markup, native keyboard-operable disclosure, no client data or archive imports. */
export function RegionalOfferPrices({ planId, offers, status, locale, now, comparison }: {
  planId: number; offers?: readonly unknown[] | null; status?: 'available' | 'missing-table';
  locale: string; now: string; comparison?: ComparisonContext;
}) {
  const rows = presentOffers({ planId, offers, status, now, comparison });
  if (!rows.length) return null; // Exactly zero additional legacy markup, including missing-table fallback.
  const t = createTranslator({ locale, messages: locale === 'zh' ? zh : en, namespace: 'regionalOffers' });
  const timestamp = (value: string | null) => value ? <time dateTime={value}>{value}</time> : t('unknown');
  const reviewed = (value: string, scope: string) => <>{value}{scope !== 'reviewed' && <> · {t('unknown')}</>}</>;
  const period = (value: Offer['identity']['billing'] | Offer['identity']['commitment']) =>
    `${value.count === null ? '' : `${value.count} `}${t(`periods.${value.period}`)}`;
  return <section aria-label={t('title')} className="mt-3 min-w-0 max-w-full space-y-3 text-sm [overflow-wrap:anywhere]">
    <h3 className="font-semibold">{t('title')}</h3>
    {rows.map(({ dto: o, cheapest, reasons }) => <article key={o.id} className="min-w-0 max-w-full rounded-md border p-3">
      <p className="text-xs text-zinc-500">{t('priceReviewed')}</p>
      <div className="mt-1 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
        <strong className="text-2xl font-bold" data-original-offer-price="true">{o.price.currency} {o.price.amount}</strong>
        <span>{t('billing')}: {period(o.identity.billing)}</span>
      </div>
      <p className="mt-1 font-medium">
        {t('market')}: {reviewed(o.identity.market.scope === 'international' ? t('international')
          : o.identity.market.country ?? t('unknown'), o.reviews.market)}
        {' · '}{t('channel')}: {reviewed(t(`channels.${o.identity.channel}`), o.reviews.channel)}
      </p>
      <p>{t('merchant')}: {reviewed(o.identity.merchant ?? t('unknown'), o.reviews.channel)}
        {['app_store', 'google_play'].includes(o.identity.channel) && <> · {t('storefront')}: {o.identity.storefrontCountry ?? t('unknown')}</>}</p>
      <p>{t('commitment')}: {period(o.identity.commitment)} · {t('unit')}: {o.identity.unitCount} {t(`units.${o.identity.unit}`)}</p>
      {o.monthlyEquivalent && <p className="mt-1 text-xs text-zinc-500">
        {t(o.monthlyEquivalent.label === 'annual_monthly_equivalent' ? 'equivalentAnnual' : 'equivalentQuarter')}: {' '}
        {o.monthlyEquivalent.currency} {rationalText(o.monthlyEquivalent.numerator, o.monthlyEquivalent.denominator)} {t('perMonth')}
      </p>}
      {o.conversion && <div className="mt-1 text-xs text-zinc-500">
        <p>{t('conversion')}: CNY {rationalText(o.conversion.numerator, o.conversion.denominator)}</p>
        <p>{t('fxAt')}: {timestamp(o.conversion.fx.validAt)}</p>
        <p>{t('fxObserved')}: {timestamp(o.conversion.fx.observedAt)}</p>
        <p>{t('fxBasis')}: {o.conversion.fx.basis} · {o.conversion.fx.base}/{o.conversion.fx.quote} · {o.conversion.fx.rate}</p>
        <a href={o.conversion.fx.source} target="_blank" rel="noopener noreferrer" className="underline">{t('fxSource')}</a>
      </div>}
      <p className="mt-1">{t('promotion')}: {reviewed(t(`phases.${o.identity.promotion}`), o.reviews.promotion)}</p>
      <p>{t('tax')}: {t(`taxes.${o.tax.status}`)} · {t(`review.${o.tax.review}`)}</p>
      {(['account', 'payment', 'seat'] as const).map(key => <p key={key}>
        {t(key)}: {t(`review.${o.qualification[key].status}`)} · {o.qualification[key].description ?? t('unknown')}
      </p>)}
      {cheapest && <p className="mt-1 font-semibold">{t('lowest')}</p>}
      <details className="mt-2 min-w-0 max-w-full">
        <summary className="cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-offset-2">{t('details')}</summary>
        <div className="mt-2 space-y-2">
          <p>{t('rights')}: {reviewed(`${o.identity.entitlementGroup ?? t('unknown')} / ${o.identity.entitlementVersion ?? t('unknown')}`, o.reviews.entitlement)}</p>
          <p>{t('eligibilityClass')}: {reviewed(o.identity.eligibilityClass ?? t('unknown'), o.reviews.eligibility)}</p>
          {o.identity.promotionId && <p>{t('campaign')}: {o.identity.promotionId}</p>}
          <p>{t('renewal')}: {o.renewalOfferId ? <>{o.renewalOfferId} · {t('renewalCaution')}</> : t('noRenewal')}</p>
          {o.tax.description && <p>{t('tax')}: {o.tax.description}</p>}
          <p>{t('validity')}: {t(`review.${o.validity.status}`)} · {t('start')}: {timestamp(o.validity.startsAt)} · {t('end')}: {' '}
            {o.validity.openEnded ? t('openEnded') : timestamp(o.validity.endsAt)}</p>
          <p>{t('observed')}: {timestamp(o.observedAt)}</p>
          <p>{t('reviewedAt')}: {timestamp(o.reviewedAt)}</p>
          <p>{t('fieldReviews')}: {(Object.keys(o.reviews) as EvidenceScope[]).map(scope => `${t(`scopes.${scope}`)}: ${t(`review.${o.reviews[scope]}`)}`).join(' · ')}</p>
          {reasons.includes('comparison_context_required') ? <p>{t('comparisonRequired')}</p>
            : reasons.length ? <div><p>{t('notRanked')}</p><ul className="list-inside list-disc">
              {[...new Set(reasons.map(reasonKey))].map(reason => <li key={reason}>{t(`reasons.${reason}`)}</li>)}
            </ul></div> : <p>{t('eligible')}</p>}
          <ul className="space-y-2">
            {o.sources.map(source => <li key={source.id}>
              <a href={source.url} target="_blank" rel="noopener noreferrer" className="underline">{t('source')} · {source.id}</a>
              <p>{t(`review.${source.status}`)} · {t('sourceScopes')}: {source.scopes.map(scope => t(`scopes.${scope}`)).join(' · ')}</p>
              <p>{t('observed')}: {timestamp(source.observedAt)}</p>
              <p>{t('reviewedAt')}: {timestamp(source.reviewedAt)}</p>
              <p>{source.note}</p>
            </li>)}
          </ul>
        </div>
      </details>
    </article>)}
  </section>;
}
