/** Any scraper result shape (playwright-scraper or utils/validator). */
export interface ScraperOutcome { success: boolean; prices?: readonly unknown[] }

/**
 * Exit code for running a single scraper directly (`npx tsx scripts/scrapers/x.ts`).
 * The runner (index-dynamic.ts) already exits 1 when any provider fails, but a
 * standalone run used to exit 0 even on `success:false` / zero prices, so a
 * post-deploy check or cron that keys on the exit code saw failures as success.
 */
export function scraperExitCode(result: ScraperOutcome | null | undefined): 0 | 1 {
  return result?.success === true && (result.prices?.length ?? 0) > 0 ? 0 : 1;
}

/** Run a scraper as a CLI: print via `report`, set a non-zero exit code on failure. */
export async function runScraperCli<T extends ScraperOutcome>(
  scrape: () => Promise<T>,
  report: (result: T) => void,
): Promise<void> {
  try {
    const result = await scrape();
    report(result);
    process.exitCode = scraperExitCode(result);
  } catch (error) {
    console.error('❌ scraper crashed:', error);
    process.exitCode = 1;
  }
}
