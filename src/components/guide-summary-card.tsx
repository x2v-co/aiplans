import { CalendarDays, Lightbulb } from 'lucide-react';
import type { GuideApiValue, GuideApiValueGroup, GuideSummary } from '@/lib/pricing-guides';
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

function ApiValueBlock({ item, locale }: { item: GuideApiValue; locale: Locale }) {
  return (
    <div className="rounded border border-emerald-300 bg-white p-3 dark:border-emerald-800 dark:bg-zinc-900" data-testid="guide-api-value">
      {item.pool && (
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800/80 dark:text-emerald-300/80">
          {item.pool[locale]}
        </p>
      )}
      <p className={`text-lg font-bold text-emerald-700 dark:text-emerald-400 ${item.pool ? 'mt-1' : ''}`}>
        {item.value[locale]}
      </p>
      <p className="mt-1 text-xs leading-5 text-zinc-500">
        {locale === 'zh' ? '口径：' : 'Basis: '}
        {item.basis[locale]}
      </p>
    </div>
  );
}

function ApiValueGroupBlock({ group, locale }: { group: GuideApiValueGroup; locale: Locale }) {
  return (
    <div className="mt-3 rounded border border-emerald-300 bg-white/70 p-3 dark:border-emerald-800 dark:bg-zinc-950/40" data-testid="guide-api-value-group">
      <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">{group.title[locale]}</p>
      {group.period && (
        <p className="mt-0.5 text-xs text-zinc-500">{group.period[locale]}</p>
      )}
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {group.rows.map((row) => (
          <ApiValueBlock key={`${row.pool?.en ?? ''}-${row.value.en}`} item={row} locale={locale} />
        ))}
      </div>
    </div>
  );
}

/** Prefer grouped comparisons; fall back to flat apiValues, then single apiValue. */
export function resolveGuideApiPresentation(summary: GuideSummary): {
  groups?: GuideApiValueGroup[];
  flat?: GuideApiValue[];
  single?: GuideApiValue;
} {
  if (summary.apiValueGroups && summary.apiValueGroups.length > 0) {
    return { groups: summary.apiValueGroups };
  }
  if (summary.apiValues && summary.apiValues.length > 0) {
    return { flat: summary.apiValues };
  }
  if (summary.apiValue) return { single: summary.apiValue };
  return {};
}

export function GuideSummaryCard({ summary, locale }: { summary: GuideSummary; locale: Locale }) {
  const presentation = resolveGuideApiPresentation(summary);
  return (
    <aside
      aria-label={locale === 'zh' ? '结论' : 'Key takeaway'}
      className="mt-6 rounded-md border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950/30"
      data-testid="guide-summary-card"
    >
      <p className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-300">
        <Lightbulb className="h-4 w-4" />
        {locale === 'zh' ? '结论先看' : 'TL;DR'}
      </p>
      <p className="mt-2 text-base font-medium leading-7 text-zinc-900 dark:text-zinc-100">{summary.conclusion[locale]}</p>
      {presentation.groups?.map((group) => (
        <ApiValueGroupBlock key={group.title.en} group={group} locale={locale} />
      ))}
      {presentation.flat && (
        <div className="mt-3 grid gap-2">
          {presentation.flat.map((item) => (
            <ApiValueBlock key={`${item.pool?.en ?? ''}-${item.value.en}`} item={item} locale={locale} />
          ))}
        </div>
      )}
      {presentation.single && (
        <div className="mt-3">
          <ApiValueBlock item={presentation.single} locale={locale} />
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
