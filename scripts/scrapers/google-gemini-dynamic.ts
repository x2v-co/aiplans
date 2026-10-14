/** Google Gemini API standard token pricing from the official pricing tables. */
import type { ScraperResult } from '../utils/validator';
import { parseGooglePriceCell } from './lib/google-price-parser';
import { PlaywrightScraper, type PriceData, type ScraperResult as BrowserScraperResult } from './lib/playwright-scraper';

const GOOGLE_PRICING_URL = 'https://ai.google.dev/gemini-api/docs/pricing';

function canonicalModel(heading: string): string | null {
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
    await this.page!.waitForFunction(() =>
      Array.from(document.querySelectorAll('table')).some(table =>
        table.previousElementSibling?.textContent?.trim() === 'Standard'
          && /Input price/i.test(table.textContent ?? '')
          && /Output price/i.test(table.textContent ?? '')
      ),
      undefined,
      { timeout: 15_000 }
    );

    const tables = await this.page!.locator('table').evaluateAll(elements => {
      const modelHeadings = Array.from(document.querySelectorAll('h2'));

      return elements.map(table => {
        const model = modelHeadings
          .filter(heading => heading.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING)
          .at(-1);
        const tier = table.previousElementSibling?.textContent?.trim() || '';
        return {
          model: (model?.textContent ?? '').replace(/\s+/g, ' ').trim(),
          tier: tier.replace(/\s+/g, ' '),
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

    const errors = prices.length === 0
      ? ['No standard text-token prices found in the official Google Gemini pricing tables']
      : undefined;
    return { success: errors == null, source: this.getSourceName(), prices, errors };
  }
}

export async function scrapeGoogleDynamic(): Promise<ScraperResult> {
  // The browser wrapper preserves this subclass's stricter price/result shape.
  return new GeminiScraper().run() as Promise<GoogleScraperResult>;
}

if (require.main === module) {
  scrapeGoogleDynamic().then(result => console.log(JSON.stringify(result, null, 2)));
}
