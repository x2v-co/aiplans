/** StepFun token pricing from the official semantic pricing tables. */

import { normalizeModelName } from '../utils/validator';
import { PlaywrightScraper, type PriceData, type ScraperResult } from './lib/playwright-scraper';

const STEPFUN_PRICING_URL = 'https://platform.stepfun.com/docs/zh/guides/pricing/details';

function parseCny(text: string | undefined, bareNumberIsCny = false): number | null {
  // Old layout: "7 元"; current layout (2026-10): bare "7" with the unit stated
  // above the table ("单位：元／百万 tokens").
  const match = text?.match(/([\d.]+)\s*元/) ?? (bareNumberIsCny ? text?.trim().match(/^([\d.]+)$/) : null);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

class StepFunScraper extends PlaywrightScraper {
  getSourceName(): string { return 'StepFun'; }
  getSourceUrl(): string { return STEPFUN_PRICING_URL; }

  async scrape(): Promise<ScraperResult> {
    await this.navigate(STEPFUN_PRICING_URL);
    await this.page!.waitForFunction(() =>
      Array.from(document.querySelectorAll('table')).some(table =>
        /输入价格.*缓存未命中/.test(table.textContent ?? '')
          && /输出价格/.test(table.textContent ?? '')
      ),
      undefined,
      { timeout: 15_000 }
    );

    const tables = await this.page!.locator('table').evaluateAll(elements =>
      elements.map(table => {
        // Nearest preceding "单位：..." note, which now carries the billing unit.
        let unitNote = '';
        let node: Element | null = table;
        for (let hops = 0; node && hops < 6 && !unitNote; hops++) {
          let sib: Element | null = node.previousElementSibling;
          for (let i = 0; sib && i < 4 && !unitNote; i++, sib = sib.previousElementSibling) {
            const m = (sib.textContent ?? '').match(/单位[:：][^。\n]*/);
            if (m) unitNote = m[0];
          }
          node = node.parentElement;
        }
        return {
          unitNote,
          rows: Array.from(table.querySelectorAll('tr')).map(row =>
            Array.from(row.querySelectorAll('th,td')).map(cell =>
              (cell.textContent ?? '').replace(/\s+/g, ' ').trim()
            )
          ),
        };
      })
    );

    const prices: PriceData[] = [];
    const seen = new Set<string>();
    for (const { unitNote, rows } of tables) {
      const header = rows[0] ?? [];
      const modelIndex = header.findIndex(cell => /^(模型|Model ID)$/i.test(cell));
      const unitIndex = header.findIndex(cell => /^计费单位/.test(cell));
      const inputIndex = header.findIndex(cell => /输入价格.*缓存未命中/.test(cell));
      const cachedIndex = header.findIndex(cell => /输入价格.*缓存命中/.test(cell));
      const outputIndex = header.findIndex(cell => /^输出价格$/.test(cell));
      if ([modelIndex, inputIndex, cachedIndex, outputIndex].some(index => index < 0)) continue;
      const tablePerMillionCny = /元\s*[／/]\s*(百万|1M)\s*tokens/i.test(unitNote);
      if (unitIndex < 0 && !tablePerMillionCny) continue;

      for (const cells of rows.slice(1)) {
        if (unitIndex >= 0 && !/1M\s*tokens/i.test(cells[unitIndex] ?? '')) continue;
        const modelName = normalizeModelName(cells[modelIndex] ?? '').toLowerCase();
        const input = parseCny(cells[inputIndex], tablePerMillionCny);
        const cachedInput = parseCny(cells[cachedIndex], tablePerMillionCny);
        const output = parseCny(cells[outputIndex], tablePerMillionCny);
        if (!modelName || seen.has(modelName) || input == null || output == null || output < input) continue;

        prices.push({
          modelName,
          inputPricePer1M: input,
          cachedInputPricePer1M: cachedInput,
          outputPricePer1M: output,
          contextWindow: null,
          isAvailable: true,
          currency: 'CNY',
        });
        seen.add(modelName);
      }
    }

    const errors = prices.length === 0
      ? ['No StepFun 1M-token pricing rows were found in the official tables']
      : undefined;
    return {
      success: prices.length > 0,
      source: this.getSourceName(),
      prices,
      errors,
    };
  }
}

export async function scrapeStepFunDynamic(): Promise<ScraperResult> {
  // devbox (SG) → platform.stepfun.com routinely exceeds the 30s default on
  // domcontentloaded; give the CN docs site more headroom.
  return new StepFunScraper({ timeout: 60_000 }).run();
}

if (require.main === module) {
  scrapeStepFunDynamic().then(result => console.log(JSON.stringify(result, null, 2)));
}
