import { useTranslations } from 'next-intl';

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
    </details>
  );
}
