"use client";
import { useTranslations } from 'next-intl';
import { COPILOT_DEPRECATION_SOURCE, COPILOT_MODEL_DEPRECATIONS } from '@/lib/copilot';

/** Seeded source notes stay available on both subscription comparison surfaces.
 * Pre-seed/legacy rows with absent notes render nothing.
 */
export function CopilotPlanNotes({ slug, notes }: { slug?: string | null; notes?: string | null }) {
  const t = useTranslations('copilotPlan');
  if (!slug?.startsWith('copilot-') || !notes?.trim()) return null;
  return (
    <details className="my-3 text-xs text-zinc-600 dark:text-zinc-400">
      <summary className="cursor-pointer font-medium">{t('notes')}</summary>
      <p className="mt-2 whitespace-pre-line break-words">{notes}</p>
      <p className="mt-2 font-medium">{t('deprecations')}</p>
      <ul className="mt-1 list-disc pl-4">
        {COPILOT_MODEL_DEPRECATIONS.map(item => (
          <li key={item.model}>
            {t('deprecationItem', { model: item.model, date: item.date, replacement: item.replacement })}
            {item.exceptAnnualIndividual ? ` ${t('annualIndividualKeeps')}` : ''}
          </li>
        ))}
      </ul>
      <a className="underline" href={COPILOT_DEPRECATION_SOURCE} target="_blank" rel="noopener noreferrer">{t('deprecationSource')}</a>
    </details>
  );
}
