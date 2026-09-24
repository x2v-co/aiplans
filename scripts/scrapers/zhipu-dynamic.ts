/** Zhipu China token pricing from official input/output pricing tables. */
import { normalizeModelName } from '../utils/validator';
import { PlaywrightScraper, type PriceData, type ScraperResult } from './lib/playwright-scraper';

const ZHIPU_PRICING_URL = 'https://bigmodel.cn/pricing';
const ZHIPU_PRICING_API = 'https://bigmodel.cn/api/biz/operation/query?ids=1160,1161';

type RecordValue = Record<string, unknown>;

function record(value: unknown): RecordValue | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : null;
}

function text(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  const object = record(value);
  return object ? text(object.value) : '';
}

function fieldValues(fields: unknown): Map<string, string> {
  const values = new Map<string, string>();
  if (!Array.isArray(fields)) return values;
  for (const field of fields) {
    const item = record(field);
    if (!item) continue;
    const label = text(item.label);
    const value = Array.isArray(item.values) ? item.values.map(text).filter(Boolean).join(' / ') : text(item.value);
    if (label && value) values.set(label, value);
  }
  return values;
}

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
    // The pricing page is now a Vue shell. Its public operation endpoint
    // contains the same model cards as the rendered page and is much more
    // stable than waiting for implementation-specific table markup.
    const response = await fetch(ZHIPU_PRICING_API, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'aiplans.dev pricing scraper (+https://aiplans.dev)',
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`Zhipu pricing API returned HTTP ${response.status}`);
    const body = record(await response.json());
    const operations = body && Array.isArray(body.data) ? body.data : [];

    const prices: PriceData[] = [];
    const seen = new Set<string>();
    for (const operation of operations) {
      const item = record(operation);
      const operationId = text(item?.operationId);
      if (!item || !['1160', '1161'].includes(operationId) || typeof item.content !== 'string') continue;
      let payload: RecordValue | null;
      try {
        payload = record(JSON.parse(item.content));
      } catch {
        continue;
      }

      const cards: Array<{ modelName: string; fields: Map<string, string> }> = [];
      if (operationId === '1160' && Array.isArray(payload?.list)) {
        for (const card of payload.list) {
          const cardRecord = record(card);
          const table = record(cardRecord?.table);
          const rows = Array.isArray(table?.modelList) ? table.modelList : [];
          const fields = new Map<string, string>();
          for (const row of rows) {
            const rowRecord = record(row);
            const values = rowRecord
              ? Object.entries(rowRecord)
                .filter(([key]) => key !== 'sort')
                .map(([, value]) => text(value))
                .filter(Boolean)
              : [];
            if (values.length >= 2) fields.set(values[0], values[values.length - 1]);
          }
          const modelName = text(cardRecord?.title);
          if (modelName) cards.push({ modelName, fields });
        }
      }
      if (operationId === '1161' && Array.isArray(payload?.tabs)) {
        for (const tab of payload.tabs) {
          const tabRecord = record(tab);
          if (text(tabRecord?.title) !== '模型' || !Array.isArray(tabRecord?.cards)) continue;
          for (const card of tabRecord.cards) {
            const cardRecord = record(card);
            const modelName = text(cardRecord?.title);
            if (modelName) cards.push({ modelName, fields: fieldValues(cardRecord?.fieldList) });
          }
        }
      }

      for (const card of cards) {
        const modelName = cleanModel(card.modelName);
        const inputText = card.fields.get('输入单价') ?? card.fields.get('输入价格');
        const outputText = card.fields.get('输出单价') ?? card.fields.get('输出价格');
        const input = cny(inputText);
        const output = cny(outputText);
        const cachedInput = cny(card.fields.get('缓存命中'));
        if (!modelName || seen.has(modelName) || input == null || output == null || output < input) continue;
        prices.push({
          modelName,
          inputPricePer1M: input,
          cachedInputPricePer1M: cachedInput ?? undefined,
          outputPricePer1M: output,
          contextWindow: context(card.fields.get('上下文')),
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
