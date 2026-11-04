/** Google Gemini API standard token pricing from the official pricing tables. */
import type { ScraperResult } from '../utils/validator';
import { parseGooglePriceCell } from './lib/google-price-parser';
import { runScraperCli } from './lib/cli-exit';
import { PlaywrightScraper, type PriceData, type ScraperResult as BrowserScraperResult } from './lib/playwright-scraper';

// Since 2026-11-02 this redirects to the AI Studio docs app
// (https://aistudio.google.com/docs/pricing), which renders each model's tiers as
// Angular Material tabs instead of an <h3>Standard</h3> before the table.
const GOOGLE_PRICING_URL = 'https://ai.google.dev/gemini-api/docs/pricing';

/** AI Studio headings end with the anchor icon's ligature text ("Gemini 4 Argon link"). */
export function cleanGoogleHeading(text: string): string {
  return text.replace(/\s+/g, ' ').trim().replace(/(?:\s*\b(?:link|content_copy|anchor)\b)+$/i, '').trim();
}

export function canonicalModel(rawHeading: string): string | null {
  const heading = cleanGoogleHeading(rawHeading);
  if (!/^Gemini\s+\d/i.test(heading)) return null;
  if (/(audio|image|live|translate|tts|computer use|omni)/i.test(heading)) return null;

  return heading
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/^-|-$/g, '');
}

type GooglePrice = ScraperResult['prices'][number] & PriceData;
type GoogleScraperResult = ScraperResult & BrowserScraperResult;

export interface GooglePricingTable { model: string; tier: string; rows: string[][] }

export function parseGooglePricingTables(tables: GooglePricingTable[], now = new Date()): GooglePrice[] {
  const prices: GooglePrice[] = [];
  const seen = new Set<string>();
  for (const table of tables) {
    if (table.tier !== 'Standard') continue;
    const modelName = canonicalModel(table.model);
    if (!modelName || seen.has(modelName)) continue;

    const inputRow = table.rows.find(row => /^Input price/i.test(row[0] ?? ''));
    const outputRow = table.rows.find(row => /^Output price/i.test(row[0] ?? ''));
    const input = parseGooglePriceCell(inputRow?.[2], now);
    const output = parseGooglePriceCell(outputRow?.[2], now);
    const cachingRow = table.rows.find(row => /^Context caching price/i.test(row[0] ?? ''));
    const cached = parseGooglePriceCell(cachingRow?.[2], now);
    if (input.current == null || output.current == null || input.current <= 0 || output.current < input.current) continue;

    prices.push({
      modelName,
      modelSlug: modelName,
      inputPricePer1M: input.current,
      outputPricePer1M: output.current,
      cachedInputPricePer1M: cached.current ?? null,
      promoEndsAt: input.promoEndsAt,
      regularInputPricePer1M: input.regular,
      regularOutputPricePer1M: output.promoEndsAt === input.promoEndsAt ? output.regular : null,
      regularCachedInputPricePer1M: cached.promoEndsAt === input.promoEndsAt ? cached.regular : null,
      contextWindow: 1_000_000,
      isAvailable: true,
      currency: 'USD',
    });
    seen.add(modelName);
  }
  return prices;
}

class GeminiScraper extends PlaywrightScraper {
  getSourceName(): string { return 'Google-Gemini-API'; }
  getSourceUrl(): string { return GOOGLE_PRICING_URL; }

  async scrape(): Promise<GoogleScraperResult> {
    await this.navigate(GOOGLE_PRICING_URL);
    // Wait only for the price tables themselves, not for one particular tier
    // markup: the old `previousElementSibling === 'Standard'` wait timed out on
    // the AI Studio layout, and #299 treats a Playwright timeout as transient,
    // so the layout change silently froze all Google rows from 2026-11-02.
    await this.page!.waitForFunction(() =>
      Array.from(document.querySelectorAll('table')).some(table =>
        /Input price/i.test(table.textContent ?? '') && /Output price/i.test(table.textContent ?? '')
      ),
      undefined,
      { timeout: 45_000 }
    );

    // No named helper functions inside evaluateAll: tsx (esbuild keepNames)
    // wraps them in `__name(...)`, which does not exist in the page.
    const tables = await this.page!.locator('table').evaluateAll(elements => {
      const modelHeadings = Array.from(document.querySelectorAll('h2'));
      return elements.map(table => {
        const model = modelHeadings
          .filter(heading => heading.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING)
          .at(-1);
        // AI Studio: <mat-tab-group> with [role=tab] labels and [role=tabpanel] bodies.
        let label: Element | null | undefined = null;
        const panel = table.closest('[role="tabpanel"], mat-tab-body');
        if (panel) {
          const labelledBy = panel.getAttribute('aria-labelledby');
          label = (labelledBy ? document.getElementById(labelledBy) : null)
            ?? (panel.id ? document.querySelector(`[role="tab"][aria-controls="${CSS.escape(panel.id)}"]`) : null)
            ?? panel.closest('mat-tab-group, .mat-mdc-tab-group')?.querySelector('[role="tab"][aria-selected="true"]');
        }
        // ai.google.dev (until 2026-11-01): <h3>Standard</h3><table>.
        const tier = (label ?? table.previousElementSibling)?.textContent ?? '';
        return {
          model: (model?.textContent ?? '').replace(/\s+/g, ' ').trim(),
          tier: tier.replace(/\s+/g, ' ').trim(),
          rows: Array.from(table.querySelectorAll('tr')).map(row =>
            Array.from(row.querySelectorAll('th,td')).map(cell =>
              (cell.textContent ?? '').replace(/\s+/g, ' ').trim()
            )
          ),
        };
      });
    });

    if (process.env.DEBUG_SCRAPER === '1') {
      console.log(JSON.stringify(tables.slice(0, 5), null, 2));
    }

    const prices = parseGooglePricingTables(tables);

    // Deliberately not phrased like a timeout: a page that loaded but no longer
    // matches the parser is a structural change and must fail the run loudly.
    const tiers = [...new Set(tables.map(table => table.tier || '(none)'))].slice(0, 8).join(', ');
    const errors = prices.length === 0
      ? [`No standard text-token prices found in the official Google Gemini pricing tables (page structure changed? ${tables.length} tables, tiers: ${tiers}, url=${this.page!.url()})`]
      : undefined;
    return { success: errors == null, source: this.getSourceName(), prices, errors };
  }
}

export async function scrapeGoogleDynamic(): Promise<ScraperResult> {
  // The browser wrapper preserves this subclass's stricter price/result shape.
  return new GeminiScraper().run() as Promise<GoogleScraperResult>;
}

if (require.main === module) {
  void runScraperCli(scrapeGoogleDynamic, result => console.log(JSON.stringify(result, null, 2)));
}
