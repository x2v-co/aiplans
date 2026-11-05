import { CalendarDays, Lightbulb } from 'lucide-react';
import type { GuideSummary } from '@/lib/pricing-guides';
import type { Locale } from '@/lib/seo';

export function GuideDates({ publishedAt, updatedAt, locale }: { publishedAt: string; updatedAt: string; locale: Locale }) {
  return (
    <p className="mt-3 inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-500" data-testid="guide-dates">
      <CalendarDays className="h-4 w-4" />
      <span>
        {locale === 'zh' ? '发布于 ' : 'Published '}
        <time dateTime={publishedAt}>{publishedAt}</time>
      </span>
      <span>
        {locale === 'zh' ? '更新于 ' : 'Updated '}
        <time dateTime={updatedAt}>{updatedAt}</time>
      </span>
    </p>
  );
}

export function GuideSummaryCard({ summary, locale }: { summary: GuideSummary; locale: Locale }) {
  return (
    <aside
      aria-label={locale === 'zh' ? '结论' : 'Key takeaway'}
      className="mt-6 rounded-md border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950/30"
    >
      <p className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-300">
        <Lightbulb className="h-4 w-4" />
        {locale === 'zh' ? '结论先看' : 'TL;DR'}
      </p>
      <p className="mt-2 text-base font-medium leading-7 text-zinc-900 dark:text-zinc-100">{summary.conclusion[locale]}</p>
      {summary.apiValue && (
        <div className="mt-3 rounded border border-emerald-300 bg-white p-3 dark:border-emerald-800 dark:bg-zinc-900">
          <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{summary.apiValue.value[locale]}</p>
          <p className="mt-1 text-xs leading-5 text-zinc-500">
            {locale === 'zh' ? '口径：' : 'Basis: '}
            {summary.apiValue.basis[locale]}
          </p>
        </div>
      )}
      {summary.keyFacts && summary.keyFacts.length > 0 && (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
          {summary.keyFacts.map((fact) => (
            <li key={fact.en}>{fact[locale]}</li>
          ))}
        </ul>
      )}
    </aside>
  );
}
