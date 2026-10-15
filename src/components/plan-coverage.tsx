"use client";
import { useTranslations } from 'next-intl';
import { normalizeThirdPartyCoverage, type ThirdPartyCoverage } from '@/lib/third-party-coverage';

export function PlanCoverage({
  coverage,
  note,
}: {
  coverage?: ThirdPartyCoverage | null;
  note?: string | null;
  locale: string;
}) {
  const t = useTranslations('quota');
  return (
    <div className="text-xs text-zinc-600 dark:text-zinc-400">
      <p>
        {t('coverage')}: {t(`coverageValues.${normalizeThirdPartyCoverage(coverage)}`)}
      </p>
      {note && <p className="mt-1">{note}</p>}
    </div>
  );
}
