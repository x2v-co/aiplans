"use client";

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { currentPlanEstimates, tokenRange, type VerifiedQuotaEstimate } from '@/lib/quota/estimates';

export function QuotaEstimateDetails({ estimate, locale }: { estimate: VerifiedQuotaEstimate; locale: string }) {
  const t = useTranslations('quota');
  const monthly = tokenRange(estimate, locale, true);
  return (
    <div className="space-y-2 text-xs">
      <p className="font-semibold">{t('monthlyEstimate')}: {monthly ?? t('monthlyUnknown')}</p>
      <p>{t('sourceWindow')}: {t(`windows.${estimate.window}`)} · {t('estimate')}: {tokenRange(estimate, locale) ?? t('unknown')}</p>
      <p>{t('model')}: {estimate.servedModel ?? t('unknown')}</p>
      <p>{t('mix', { name: estimate.mix.name, cache: estimate.mix.cacheReadPct, input: estimate.mix.inputPct, output: estimate.mix.outputPct })}</p>
      <p>{t('confidence')}: {estimate.confidence} · {t('verifiedAt')}: <time dateTime={estimate.verifiedAt}>{estimate.verifiedAt.slice(0, 10)}</time></p>
      {estimate.notes && <p className="whitespace-pre-line break-words">{estimate.notes}</p>}
      <div>
        <span>{t('evidence')}: </span>
        {estimate.evidence.length ? <ul className="list-inside list-disc break-all">
          {estimate.evidence.map((evidence) => <li key={`${evidence.id}-${evidence.url}`}>
            <a href={evidence.url} target="_blank" rel="noopener noreferrer" className="underline">{evidence.url}</a>
            {' '}(<time dateTime={evidence.capturedAt}>{evidence.capturedAt.slice(0, 10)}</time>)
          </li>)}
        </ul> : t('noEvidence')}
      </div>
    </div>
  );
}

export function PlanQuotaEstimates({ estimates, planSlug, locale }: {
  estimates: VerifiedQuotaEstimate[]; planSlug: string; locale: string;
}) {
  const t = useTranslations('quota');
  const current = currentPlanEstimates(estimates, planSlug);
  return (
    <section className="my-4 space-y-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
      <h3 className="text-sm font-semibold">{t('title')}</h3>
      <p className="text-xs text-zinc-500">{t('caveat')}</p>
      {current.length ? current.map(estimate => <QuotaEstimateDetails key={estimate.id} estimate={estimate} locale={locale} />)
        : <p className="text-xs text-zinc-500">{t('empty')}</p>}
      <Link href={`/${locale}/quota-changes`} className="text-xs text-blue-600 underline">{t('historyTitle')}</Link>
    </section>
  );
}
