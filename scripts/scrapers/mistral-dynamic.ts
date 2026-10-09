/** Mistral API token pricing from the official docs pricing tables. */
import { normalizeModelName } from '../utils/validator';
import { PlaywrightScraper, type PriceData, type ScraperResult } from './lib/playwright-scraper';

// mistral.ai/pricing/api/ now 30x-redirects here (observed 2026-10-09); the old
// <mistral-block-card-model> cards no longer exist. The docs page renders plain
// <table>s with a [Model, Input, Cached input, Output] header, prices in $/M tokens.
const MISTRAL_PRICING_URL = 'https://docs.mistral.ai/inference/pricing';

/** Third-party models resold on La Plateforme; not Mistral's own price list. */
const THIRD_PARTY_PREFIX = /^(z\.ai|zhipu|deepseek|qwen|meta|llama)\b/i;

/**
 * Parse a price cell. Discounted rows read "Original price: $1.36 Sale price: $0.68";
 * the sale price is what a customer pays today (the scraper runs daily, so the list
 * price comes back automatically when the sale ends). Cells with any other unit
 * ("/1000 Pages", "/Min", "/M Chars"), "Free" or "—" are not per-token prices.
 */
export function parseMistralPriceCell(cell: string | undefined): number | null {
  if (!cell || cell.includes('/')) return null;
  const sale = cell.match(/Sale price:\s*\$\s*([\d.]+)/i);
  const plain = cell.match(/^\s*\$\s*([\d.]+)\s*$/);
  const raw = sale?.[1] ?? plain?.[1];
  if (raw == null) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

class MistralScraper extends PlaywrightScraper {
  getSourceName(): string { return 'Mistral-AI'; }
  getSourceUrl(): string { return MISTRAL_PRICING_URL; }

  async scrape(): Promise<ScraperResult> {
    await this.navigate(MISTRAL_PRICING_URL);
    await this.page!.waitForFunction(() =>
      Array.from(document.querySelectorAll('table')).some(table =>
        /Cached input/i.test(table.textContent ?? '') && /Output/.test(table.textContent ?? '')
      ),
      undefined,
      { timeout: 20_000 }
    );

    const tables = await this.page!.locator('table').evaluateAll(elements =>
      elements.map(table => Array.from(table.querySelectorAll('tr')).map(row =>
        Array.from(row.querySelectorAll('th,td')).map(cell =>
          (cell.textContent ?? '').replace(/\s+/g, ' ').trim()
        )
      ))
    );

    const prices: PriceData[] = [];
    const seen = new Set<string>();
    for (const rows of tables) {
      const header = rows[0] ?? [];
      const modelIndex = header.findIndex(cell => /^Model$/i.test(cell));
      const inputIndex = header.findIndex(cell => /^Input$/i.test(cell));
      const cachedIndex = header.findIndex(cell => /^Cached input$/i.test(cell));
      const outputIndex = header.findIndex(cell => /^Output$/i.test(cell));
      if ([modelIndex, inputIndex, outputIndex].some(index => index < 0)) continue;

      for (const cells of rows.slice(1)) {
        const title = (cells[modelIndex] ?? '').replace(/↗/g, '').replace(/Sale price/gi, '').trim();
        if (!title || THIRD_PARTY_PREFIX.test(title)) continue;
        const input = parseMistralPriceCell(cells[inputIndex]);
        const output = parseMistralPriceCell(cells[outputIndex]);
        const cached = cachedIndex >= 0 ? parseMistralPriceCell(cells[cachedIndex]) : null;
        const modelName = normalizeModelName(title).toLowerCase().replace(/\s+/g, '-');
        if (!modelName || seen.has(modelName) || input == null || output == null || output < input) continue;
        prices.push({
          modelName,
          inputPricePer1M: input,
          cachedInputPricePer1M: cached ?? undefined,
          outputPricePer1M: output,
          contextWindow: null,
          isAvailable: true,
          currency: 'USD',
        });
        seen.add(modelName);
      }
    }

    return {
      source: this.getSourceName(),
      success: prices.length > 0,
      prices,
      errors: prices.length > 0 ? undefined : ['No Mistral token pricing tables found'],
    };
  }
}

export async function scrapeMistralDynamic(): Promise<ScraperResult> {
  return new MistralScraper().run();
}

if (require.main === module) scrapeMistralDynamic().then(result => console.log(JSON.stringify(result, null, 2)));
