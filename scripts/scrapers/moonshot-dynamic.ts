/** Moonshot/Kimi token pricing from the official Kimi pricing tables. */
import { normalizeModelName } from '../utils/validator';
import { PlaywrightScraper, type PriceData, type ScraperResult } from './lib/playwright-scraper';

const PRICING_PAGE = 'https://platform.kimi.com/docs/pricing/chat';


/**
 * The model cell can carry badges/tooltips next to the id, e.g. during the
 * Kimi K3 launch promo: `kimi-k3<Badge>Promo</Badge>` plus "Promotion valid
 * until October 11, 2026". Keep only model ids; anything that is not a plain
 * id is dropped (and the identity guard rejects it downstream).
 *
 * One cell can also list several ids with no separator
 * (`kimi-k2-thinkingkimi-k2-instruct-0905…`). The old `^(kimi|moonshot)[a-z0-9.-]*`
 * match consumed that whole string as a single slug. The compare sitemap then
 * published it, and the page returned 200. Split on each new family prefix.
 */
export function parseKimiModelIds(raw: string): string[] {
  const text = raw
    .replace(/<[^>]*>/g, ' ')
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  const ids: string[] = [];
  for (const token of text.split(/[^a-z0-9.-]+/)) {
    if (!token) continue;
    for (const part of token.split(/(?<=[a-z0-9])(?=(?:kimi|moonshot)(?:-|\d))/)) {
      const id = part.replace(/(?:-?(?:promo|promotion|new|hot|limited))+$/i, '');
      if (/^(?:kimi|moonshot)[a-z0-9.-]*[a-z0-9]$/.test(id)) ids.push(id);
    }
  }
  return [...new Set(ids)];
}

export function parseKimiModelCell(raw: string): string | null {
  return parseKimiModelIds(raw)[0] ?? null;
}

export interface KimiPricingTable {
  headers: string[];
  rows: string[][];
  contextText: string;
}

/** Fail the full-catalog scrape on any incomplete table/row: a partial result
 * would otherwise retire valid Moonshot channels in index-dynamic. */
export function parseKimiPricingTables(tables: KimiPricingTable[]): PriceData[] {
  const prices: PriceData[] = [];
  const seen = new Set<string>();
  for (const table of tables) {
    const headers = table.headers.map(value => value.trim());
    const modelIndex = headers.findIndex(value => /^(名称|模型)$/.test(value));
    const inputIndex = headers.indexOf('输入');
    const outputIndex = headers.indexOf('输出');
    const cacheIndex = headers.indexOf('缓存命中');
    if ([modelIndex, inputIndex, outputIndex, cacheIndex].some(index => index < 0)) {
      throw new Error('Unrecognized Kimi pricing table headers');
    }
    const contextMatch = table.contextText.match(/([\d,]+)\s*tokens?\s*上下文窗口/i);
    const contextWindow = contextMatch ? Number(contextMatch[1].replace(/,/g, '')) : 0;
    if (!contextWindow || !table.rows.length) throw new Error('Incomplete Kimi pricing table');
    for (const cells of table.rows) {
      const modelIds = parseKimiModelIds(cells[modelIndex] ?? '');
      if (modelIds.length !== 1) throw new Error('Invalid Kimi pricing model cell');
      const modelName = normalizeModelName(modelIds[0]).toLowerCase();
      const readPrice = (index: number): number => {
        // Require CNY and per-million units; never reinterpret cache-write TTLs
        // or a changed currency/unit as a token price.
        const match = cells[index]?.trim().match(/^[¥￥]\s*(\d+(?:\.\d+)?)\s*\/\s*MTok$/i);
        if (!match) throw new Error(`Invalid Kimi price for ${modelName}: ${headers[index]}`);
        return Number(match[1]);
      };
      const input = readPrice(inputIndex);
      const output = readPrice(outputIndex);
      const cached = readPrice(cacheIndex);
      if (output < input || cached > input || seen.has(modelName)) {
        throw new Error(`Inconsistent Kimi pricing row: ${modelName}`);
      }
      prices.push({ modelName, inputPricePer1M: input, outputPricePer1M: output,
        cachedInputPricePer1M: cached, contextWindow, isAvailable: true, currency: 'CNY' });
      seen.add(modelName);
    }
  }
  if (!prices.length) throw new Error('No Moonshot token pricing rows found');
  return prices;
}

export class MoonshotScraper extends PlaywrightScraper {
  getSourceName(): string { return 'Moonshot'; }
  getSourceUrl(): string { return PRICING_PAGE; }

  async scrape(): Promise<ScraperResult> {
    // Mintlify's Markdown now contains empty tables. Read the rendered tables,
    // including the leaf header row beneath the grouped cache/token headings.
    await this.navigate(PRICING_PAGE, 'table tbody tr');
    await this.page!.waitForFunction(() => {
      const tables = [...document.querySelectorAll('table')];
      return tables.length > 0 && tables.every(table => table.querySelector('tbody tr'));
    });
    const tables = await this.page!.evaluate(() => {
      let heading: Element | null = null;
      const result: KimiPricingTable[] = [];
      for (const element of document.querySelectorAll('h2, h3, table')) {
        if (element.closest('table') !== element && element.closest('table')) continue;
        if (/^H[23]$/.test(element.tagName)) heading = element;
        if (element.tagName !== 'TABLE') continue;
        const headerRows = element.querySelectorAll('thead tr');
        const header = headerRows[headerRows.length - 1];
        const range = document.createRange();
        if (heading) range.setStartAfter(heading);
        range.setEndBefore(element);
        const contextText = heading ? range.toString() : '';
        result.push({ contextText,
          headers: header ? [...header.querySelectorAll('th, td')].map(cell => cell.textContent ?? '') : [],
          rows: [...element.querySelectorAll('tbody tr')].map(row =>
            [...row.querySelectorAll('th, td')].map(cell => cell.textContent ?? '')),
        });
      }
      return result;
    });
    return { source: this.getSourceName(), success: true, prices: parseKimiPricingTables(tables) };
  }
}

export async function scrapeMoonshotDynamic(): Promise<ScraperResult> {
  return new MoonshotScraper().run();
}

if (require.main === module) scrapeMoonshotDynamic().then(result => console.log(JSON.stringify(result, null, 2)));
