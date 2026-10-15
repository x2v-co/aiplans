/** Date-only API removal notices. Keep the announced day stable in every locale. */
export function modelShutdownNotice(shutdownDate: string | null | undefined, locale: string, now = new Date()) {
  if (!shutdownDate) return null;
  const date = new Date(`${shutdownDate}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(shutdownDate) || !Number.isFinite(date.getTime())
    || date.toISOString().slice(0, 10) !== shutdownDate) return null;
  return {
    // Retirement takes effect on the published UTC date.
    status: now.toISOString().slice(0, 10) >= shutdownDate ? 'retired' as const : 'retiring' as const,
    date: new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
      dateStyle: 'long', timeZone: 'UTC',
    }).format(date),
  };
}

export function modelLifecycleStatus(shutdownDate: string | null | undefined, now = new Date()): 'active' | 'retiring' | 'retired' {
  return modelShutdownNotice(shutdownDate, 'en', now)?.status ?? 'active';
}
