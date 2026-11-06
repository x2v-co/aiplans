"use client";
import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { modelShutdownNotice } from '@/lib/model-shutdown';

export function ModelLifecycleBadge({ shutdownDate, replacement }: { shutdownDate?: string | null; replacement?: string | null }) {
  const locale = useLocale();
  const t = useTranslations('modelShutdown');
  const notice = modelShutdownNotice(shutdownDate, locale);
  if (!notice) return null;
  return (
    <>
      <Badge variant="outline" className="border-amber-400 text-amber-800 dark:text-amber-300">{t(notice.status, { date: notice.date })}</Badge>
      {replacement ? <span className="text-xs font-normal text-amber-800 dark:text-amber-300">{t('replacement', { model: replacement })}</span> : null}
    </>
  );
}
