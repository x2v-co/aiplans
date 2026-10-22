/** DeepSeek API pricing scraper using the official semantic pricing table. */
import { DEEPSEEK_PEAK_SCHEDULE, deepseekPricingWindow } from '../../src/lib/deepseek-pricing';
import type { ScrapedPrice, ScrapedPriceVariant, ScraperResult } from '../utils/validator';
import { PlaywrightScraper } from './lib/playwright-scraper';

const DEEPSEEK_PRICING_URL = 'https://api-docs.deepseek.com/quick_start/pricing';
const PRICING_TABLE_TIMEOUT_MS = 20_000;

// Table headers carry footnote markers ("deepseek-flash(1)") and the current
// flash is labeled without its generation. Map to the canonical catalog slugs
// shared with OpenRouter/Fireworks/Vercel so the direct channel lands on the
// DeepSeek-V4.1-Flash-1017 row instead of spawning deepseek-flash(1) dupes.
// `deepseek-v4-flash` is the retired 0731 identity other hosts still sell;
// writing the official channel there left /models/deepseek-v4.1-flash with
// "No official channel available", and the unseen-channel retire pass then
// disabled the stopgap CNY row that had been seeded on the canonical model.
const CANONICAL_SLUG: Record<string, string> = {
  'deepseek-flash': 'deepseek-v4.1-flash',
};

function canonicalModelName(header: string): string {
  const stripped = header.toLowerCase().replace(/\(\d+\)\s*$/, '').trim();
  return CANONICAL_SLUG[stripped] ?? stripped;
}

class DeepSeekScraper extends PlaywrightScraper {
  getSourceName(): string { return 'DeepSeek-API'; }
  getSourceUrl(): string { return DEEPSEEK_PRICING_URL; }

  async scrape(): Promise<ScraperResult> {
    await this.navigate(DEEPSEEK_PRICING_URL);

    // navigate() only waits for domcontentloaded; the Docusaurus SSR shell
    // ships a PARAM/VALUE table before the client renders the pricing table.
    // Wait for a table carrying MODEL + PEAK cells instead of racing first().
    try {
      await this.page!.waitForFunction(() =>
        Array.from(document.querySelectorAll('table')).some(table => {
          const cells = Array.from(table.querySelectorAll('th, td'))
            .map(cell => (cell.textContent || '').replace(/\s+/g, ' ').trim().toUpperCase());
          return cells.includes('MODEL') && cells.includes('PEAK');
        }), undefined, { timeout: PRICING_TABLE_TIMEOUT_MS });
    } catch {
      // Fall through: parsing below reports a precise error instead of a bare timeout.
      console.warn(`DeepSeek pricing table (MODEL+PEAK) not rendered within ${PRICING_TABLE_TIMEOUT_MS}ms`);
    }

    const tables = await this.page!.locator('table').evaluateAll(nodes =>
      nodes.map(table =>
        Array.from(table.querySelectorAll('tr')).map(row =>
          Array.from(row.querySelectorAll('th, td')).map(cell =>
            (cell.textContent || '').replace(/\s+/g, ' ').trim()
          )
        )
      )
    );
    const rows = pickDeepSeekPricingTable(tables);

    return parseDeepSeekTable(rows);
  }
}

/** Pick the pricing table (MODEL header row + a PEAK cell); never the SSR PARAM/VALUE shell. */
export function pickDeepSeekPricingTable(tables: string[][][]): string[][] {
  const norm = (cell: string) => cell.trim().toUpperCase();
  return tables.find(rows =>
    rows.some(row => norm(row[0] ?? '') === 'MODEL') &&
    rows.some(row => row.some(cell => norm(cell) === 'PEAK'))
  ) ?? [];
}

/** Parse published windows independently; list always uses the explicit peak row. */
export function parseDeepSeekTable(rows: string[][], date = new Date()): ScraperResult {
  const names = rows.find(row => row[0] === 'MODEL')?.slice(1) ?? [];
  const prices: ScrapedPrice[] = [];
  const variants: ScrapedPriceVariant[] = [];
  const errors: string[] = [];
  for (const [index, header] of names.entries()) {
    const modelSlug = canonicalModelName(header);
    const windows = new Map<string, ScrapedPrice>();
    for (const window of ['peak', 'off-peak'] as const) {
      // Window label may sit in any cell: rowspan'd PRICING / token-type labels
      // precede it on the first row of each pair (2026-10 layout, OFF-PEAK first).
      const windowRows = rows.filter(row => row.some(cell => cell.trim().toLowerCase() === window));
      const rates = windowRows.map(row => parseDollar(row.slice(-names.length)[index]));
      const [cache, input, output] = rates;
      if (rates.length !== 3 || cache == null || input == null || output == null) {
        errors.push(`Missing ${window} cache-hit/cache-miss/output for ${header}`);
        continue;
      }
      const price: ScrapedPrice = {
        modelName: modelSlug, modelSlug, inputPricePer1M: input, outputPricePer1M: output,
        cachedInputPricePer1M: cache, contextWindow: 1_000_000, isAvailable: true, currency: 'USD',
        notes: `Peak list price; off-peak = 50%. Peak: ${DEEPSEEK_PEAK_SCHEDULE}. Source: ${DEEPSEEK_PRICING_URL}`,
      };
      windows.set(window, price);
      variants.push({ ...price, variantKey: window, variantName: window === 'peak' ? 'Peak' : 'Off-peak',
        variantKind: 'time_window', isHeadline: window === 'peak', sourceUrl: DEEPSEEK_PRICING_URL,
        constraints: { time_window: window, peak_schedule: DEEPSEEK_PEAK_SCHEDULE },
        // Both windows are explicitly published, independently of scrape time.
        deepseekWindow: true, observedAt: date.toISOString(),
        raw: { published_window: window, scheduled_window: deepseekPricingWindow(date) },
      });
    }
    const peak = windows.get('peak');
    if (peak) prices.push({ ...peak, deepseekWindow: true, observedAt: date.toISOString() });
  }
  if (!prices.length) errors.push('No DeepSeek peak prices found');
  return { success: !errors.length && prices.length > 0, source: 'DeepSeek-API', prices, variants,
    errors: errors.length ? errors : undefined };
}

function parseDollar(value: string | undefined): number | null {
  const match = value?.match(/\$([\d.]+)/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function scrapeDeepSeekDynamic(): Promise<ScraperResult> {
  return new DeepSeekScraper().run();
}

if (require.main === module) {
  scrapeDeepSeekDynamic().then(result => {
    console.log('\n📊 Scrape Result:');
    console.log(JSON.stringify(result, null, 2));
  });
}
