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

/** Normalizes a DB date (postgres.js returns DATE as a Date) or catalog string to YYYY-MM-DD. */
export function shutdownDay(value: string | Date | null | undefined): string | null {
  if (value == null) return null;
  if (value instanceof Date || Object.prototype.toString.call(value) === '[object Date]') {
    const time = (value as Date).getTime();
    return Number.isFinite(time) ? (value as Date).toISOString().slice(0, 10) : null;
  }
  const day = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const parsed = new Date(`${day}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === day ? day : null;
}

/**
 * True from the published shutdown day onward, in UTC. Same boundary as
 * modelShutdownNotice ("retired" on the day), the scraper's channel sweep and
 * seed-openai-shutdowns, so the site label, seeds and audits agree.
 */
export function shutdownReached(value: string | Date | null | undefined, now = new Date()): boolean {
  const day = shutdownDay(value);
  return day != null && now.toISOString().slice(0, 10) >= day;
}
