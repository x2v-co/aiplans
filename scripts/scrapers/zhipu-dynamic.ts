/** Zhipu China token pricing from official input/output pricing tables. */
import { normalizeModelName } from '../utils/validator';
import { PlaywrightScraper, type PriceData, type ScraperResult } from './lib/playwright-scraper';

const ZHIPU_PRICING_URL = 'https://bigmodel.cn/pricing';

function cny(text: string | undefined): number | null {
  if (/免费|free/i.test(text ?? '')) return 0;
  const match = text?.match(/([\d.]+)\s*元/i);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function yen(text: string | undefined): number | null {
  const match = text?.match(/¥\s*([\d.]+)/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function context(text: string | undefined): number | null {
  const match = text?.trim().match(/^([\d.]+)\s*([KM])$/i);
  if (!match) return null;
  return Number(match[1]) * (match[2].toUpperCase() === 'M' ? 1_000_000 : 1_000);
}

function cleanModel(text: string): string | null {
  const match = text.match(/^(GLM-[\w.]+(?:-[\w.]+)*)/i);
  return match ? normalizeModelName(match[1]).toLowerCase() : null;
}

class ZhipuScraper extends PlaywrightScraper {
  getSourceName(): string { return 'Zhipu-AI'; }
  getSourceUrl(): string { return ZHIPU_PRICING_URL; }

  async scrape(): Promise<ScraperResult> {
    await this.navigate(ZHIPU_PRICING_URL);
    await this.page!.waitForFunction(() =>
      Array.from(document.querySelectorAll('table')).some(table =>
        /输入单价.*百万tokens/i.test((table.textContent ?? '').replace(/\s+/g, ''))
      ),
      undefined,
      { timeout: 15_000 }
    );
    await this.page!.waitForTimeout(2_000);

    const tables = await this.page!.locator('table').evaluateAll(elements =>
      elements.map(table => Array.from(table.querySelectorAll('tr')).map(row =>
        Array.from(row.querySelectorAll('th,td')).map(cell =>
          (cell.textContent ?? '').replace(/\s+/g, ' ').trim()
        )
      ))
    );

    const prices: PriceData[] = [];
    const seen = new Set<string>();
    for (let tableIndex = 0; tableIndex < tables.length - 1; tableIndex++) {
      const header = tables[tableIndex][0] ?? [];
      const modelIndex = header.findIndex(cell => /^模型名称$/.test(cell));
      const contextIndex = header.findIndex(cell => /^上下文/.test(cell));
      const inputIndex = header.findIndex(cell => /^输入单价.*百万tokens/i.test(cell));
      const outputIndex = header.findIndex(cell => /^输出单价.*百万tokens/i.test(cell));
      const cachedIndex = header.findIndex(cell => /^缓存命中.*百万tokens/i.test(cell));
      if ([modelIndex, inputIndex, outputIndex].some(index => index < 0)) continue;

      for (const cells of tables[tableIndex + 1]) {
        const modelName = cleanModel(cells[modelIndex] ?? '');
        if (!modelName || seen.has(modelName)) continue;
        const input = cny(cells[inputIndex]);
        const output = cny(cells[outputIndex]);
        const cachedInput = cachedIndex >= 0 ? cny(cells[cachedIndex]) : null;
        if (input == null || output == null || output < input) continue;
        prices.push({
          modelName,
          inputPricePer1M: input,
          cachedInputPricePer1M: cachedInput ?? undefined,
          outputPricePer1M: output,
          contextWindow: context(cells[contextIndex]),
          isAvailable: true,
          currency: 'CNY',
        });
        seen.add(modelName);
      }
    }

    for (let tableIndex = 0; tableIndex < tables.length - 1; tableIndex++) {
      const header = tables[tableIndex][0] ?? [];
      const modelIndex = header.findIndex(cell => /^Model$/i.test(cell));
      const contextIndex = header.findIndex(cell => /^Context$/i.test(cell));
      const pricingIndex = header.findIndex(cell => /^Pricing$/i.test(cell));
      if ([modelIndex, pricingIndex].some(index => index < 0)) continue;
      const cells = tables[tableIndex + 1].find(row => /^GLM-4$/i.test(row[modelIndex] ?? ''));
      if (!cells || seen.has('glm-4')) continue;
      const unifiedPrice = yen(cells[pricingIndex]);
      if (unifiedPrice == null) continue;
      prices.push({
        modelName: 'glm-4',
        inputPricePer1M: unifiedPrice,
        outputPricePer1M: unifiedPrice,
        cachedInputPricePer1M: null,
        contextWindow: context(cells[contextIndex]),
        isAvailable: true,
        currency: 'CNY',
      });
      seen.add('glm-4');
    }

    return {
      source: this.getSourceName(),
      success: prices.length > 0,
      prices,
      errors: prices.length > 0 ? undefined : ['No Zhipu input/output token pricing rows found'],
    };
  }
}

export async function scrapeZhipuDynamic(): Promise<ScraperResult> {
  return new ZhipuScraper({ blockResources: false }).run();
}

if (require.main === module) scrapeZhipuDynamic().then(result => console.log(JSON.stringify(result, null, 2)));
