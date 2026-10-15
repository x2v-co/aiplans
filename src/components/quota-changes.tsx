"use client";

import { useTranslations } from 'next-intl';
import { type QuotaChange } from '@/lib/quota/estimates';
import { QuotaEstimateDetails } from './quota-estimates';

export function QuotaChanges({ changes, locale }: { changes: QuotaChange[]; locale: string }) {
  const t = useTranslations('quota');
  return (
    <main className="container mx-auto max-w-5xl space-y-6 px-4 py-8">
      <h1 className="text-3xl font-bold">{t('historyTitle')}</h1>
      <p className="text-zinc-600 dark:text-zinc-400">{t('historyDescription')}</p>
      <p className="text-sm text-zinc-500">{t('caveat')}</p>
      {changes.length ? <ol className="space-y-6">
        {changes.map(({ previous, next }) => <li key={previous.id} id={`change-${previous.id}-${next.id}`} className="rounded-lg border p-5">
          <h2 className="text-lg font-semibold">{next.providerName ? `${next.providerName} · ` : ''}{next.planName} ({next.planSlug})</h2>
          <p className="my-2 text-sm">{t('recordedAt')}: <time dateTime={next.createdAt}>{next.createdAt.slice(0, 10)}</time></p>
          <div className="grid gap-4 md:grid-cols-2">
            <section className="space-y-2"><h3 className="font-medium">{t('previous')} · #{previous.id}</h3><QuotaEstimateDetails estimate={previous} locale={locale} /></section>
            <section className="space-y-2"><h3 className="font-medium">{t('next')} · #{next.id}</h3><QuotaEstimateDetails estimate={next} locale={locale} /></section>
          </div>
        </li>)}
      </ol> : <p className="rounded-lg border p-6 text-zinc-500">{t('empty')}</p>}
    </main>
  );
}
