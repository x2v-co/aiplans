import type { ScraperResult } from './validator';

/**
 * Provider-level failures that are usually the network/page being slow rather
 * than the scraper being broken (Playwright waits, navigation, fetch resets).
 */
export const TRANSIENT_SCRAPER_ERROR = /Timeout \d+ms exceeded|timed? ?out|ETIMEDOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|socket hang up|fetch failed|net::ERR_|Target (page|closed)|browser has been closed/i;

export function isTransientFailure(result: ScraperResult | undefined, reason?: unknown): boolean {
  const text = reason != null ? String(reason) : (result?.errors ?? []).join('\n');
  return (reason != null || result?.success === false) && TRANSIENT_SCRAPER_ERROR.test(text);
}

export type ScraperRunResult = { updated: number; errors: number; warnings: number };

/**
 * Run one scraper with a single retry on transient failure. If it is still
 * transiently failing after the retry, degrade it to a warning: nothing is
 * written (the last successful prices stay as they are) and the group is not
 * failed, so one slow docs page cannot block the v1 catalog publication
 * (planprice 2026-11-03: Google-Gemini-API waitForFunction 15000ms).
 * Non-transient failures (parser breakage, bad data) still count as errors.
 */
export async function runWithTransientDegrade(
  name: string,
  fn: () => Promise<ScraperResult>,
  process: (result: ScraperResult) => Promise<ScraperRunResult>,
  log: Pick<Console, 'warn'> = console,
): Promise<ScraperRunResult> {
  const degraded = (detail: string): ScraperRunResult => {
    log.warn(`⚠️ ${name} still failing transiently after retry; keeping last successful data, not blocking publication: ${detail.slice(0, 300)}`);
    return { updated: 0, errors: 0, warnings: 1 };
  };
  const attempt = async (): Promise<ScraperResult> => fn();
  let result: ScraperResult;
  try {
    result = await attempt();
  } catch (reason) {
    if (!isTransientFailure(undefined, reason)) throw reason;
    log.warn(`🔁 ${name} crashed with a transient error, retrying once: ${String(reason).slice(0, 300)}`);
    try {
      result = await attempt();
    } catch (again) {
      if (!isTransientFailure(undefined, again)) throw again;
      return degraded(String(again));
    }
  }
  if (isTransientFailure(result)) {
    log.warn(`🔁 ${name} failed with a transient error, retrying once: ${(result.errors ?? []).join('; ').slice(0, 300)}`);
    try {
      result = await attempt();
    } catch (again) {
      if (!isTransientFailure(undefined, again)) throw again;
      return degraded(String(again));
    }
    if (isTransientFailure(result)) return degraded((result.errors ?? []).join('; '));
  }
  return process(result);
}
