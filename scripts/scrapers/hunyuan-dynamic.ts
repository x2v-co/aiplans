/** Tencent Hunyuan official list prices from the published pricing table. */
import type { ScraperResult } from '../utils/validator';
import { PlaywrightScraper, type PriceData } from './lib/playwright-scraper';

const HUNYUAN_PRICING_URL = 'https://cloud.tencent.com/document/product/1729/97731';

function canonicalModel(raw: string): string | null {
  const clean = raw.trim().toLowerCase().replace(/\s+/g, '-');
  if (clean === 'tencent-hy-vision-1.5-instruct') return 'hy-vision-1.5-instruct';
  if (!/^(hunyuan|tencent-hy)/.test(clean)) return null;
  // Non-chat products share the pricing table but are not LLM API prices.
  if (/(^|-)(embedding|vision-video|video|tts|asr|rerank)(-|$)/.test(clean)) return null;
  return clean;
}

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

function decodeEntities(text: string): string {
  return text.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

/**
 * Row texts of the server-rendered 刊例价 table. Since 2026-10 the docs site
 * serves headless Chromium a ~10KB shell without the tables, while a normal
 * browser UA still gets the full SSR HTML, so parse that first.
 */
export function extractListPriceRows(html: string): string[] {
  const tables = html.match(/<table[\s\S]*?<\/table>/gi) ?? [];
  const table = tables.find(t => t.includes('刊例价'));
  if (!table) return [];
  return (table.match(/<tr[\s\S]*?<\/tr>/gi) ?? [])
    .map(row => decodeEntities(row.replace(/<[^>]+>/g, ' ')).replace(/[\s\uFEFF\u200B]+/g, ' ').trim());
}

export function parseListPriceRows(rows: string[]): PriceData[] {
  const prices: PriceData[] = [];
  const seen = new Set<string>();
  for (const text of rows) {
    const match = text.replace(/[\s\uFEFF\u200B]+/g, ' ').trim()
      .match(/^(.*?)输入[：:]\s*([\d.]+)\s*元\s*输出[：:]\s*([\d.]+)\s*元/i);
    if (!match) continue;
    const modelName = canonicalModel(match[1]);
    if (!modelName || seen.has(modelName)) continue;
    const input = Number(match[2]);
    const output = Number(match[3]);
    if (input <= 0 || output < input) continue;
    prices.push({
      modelName,
      inputPricePer1M: input,
      outputPricePer1M: output,
      contextWindow: modelName.includes('vision') ? 32_000 : 128_000,
      isAvailable: true,
      currency: 'CNY',
    });
    seen.add(modelName);
  }
  return prices;
}

class HunyuanScraper extends PlaywrightScraper {
  getSourceName(): string { return 'Hunyuan-Tencent'; }
  getSourceUrl(): string { return HUNYUAN_PRICING_URL; }

  async scrape(): Promise<ScraperResult> {
    let prices: PriceData[] = [];
    try {
      const res = await fetch(HUNYUAN_PRICING_URL, {
        headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'zh-CN,zh;q=0.9' },
        signal: AbortSignal.timeout(30_000),
      });
      if (res.ok) prices = parseListPriceRows(extractListPriceRows(await res.text()));
    } catch (error) {
      console.warn(`Hunyuan SSR fetch failed, falling back to browser: ${String(error)}`);
    }

    if (prices.length === 0) {
      await this.navigate(HUNYUAN_PRICING_URL);
      await this.page!.waitForTimeout(2_000);
      const rows = await this.page!.locator('table').filter({ hasText: '刊例价' }).first()
        .locator('tr').allTextContents();
      prices = parseListPriceRows(rows);
    }

    const errors = prices.length === 0
      ? ['No Hunyuan list prices found in the official pricing table']
      : undefined;
    return { source: this.getSourceName(), success: prices.length > 0, prices, errors };
  }
}

export async function scrapeHunyuanDynamic(): Promise<ScraperResult> {
  return new HunyuanScraper().run() as Promise<ScraperResult>;
}

if (require.main === module) {
  scrapeHunyuanDynamic().then(result => console.log(JSON.stringify(result, null, 2)));
}
