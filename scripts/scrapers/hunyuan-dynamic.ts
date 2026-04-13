/**
 * Hunyuan / 腾讯混元 API Scraper — Tencent Cloud pricing docs.
 * NO FALLBACK DATA — fails cleanly when scraping fails.
 *
 * Migrated 2026-04-13 to use KnownModelsExtractor base class.
 * Original was ~270 lines; this is ~55 lines.
 *
 * Prices on this page are CNY (¥/元 per 1M tokens).
 */
import type { ScraperResult } from '../utils/validator';
import { KnownModelsExtractor, NUMBER_REGEX, type KnownModel } from './lib/known-models-extractor';

const HUNYUAN_PRICING_URL = 'https://cloud.tencent.com/document/product/1729/97731';

const KNOWN_MODELS: KnownModel[] = [
  // HY 2.0 (Tencent's current flagship)
  { pattern: /tencent.*hy.*2\.0.*think|hy.*2\.0.*think/i,    name: 'hy-2.0-think',     minInput: 3,   maxInput: 5,   minOutput: 14,  maxOutput: 18, contextWindow: 128_000 },
  { pattern: /tencent.*hy.*2\.0.*instruct|hy.*2\.0.*instruct/i, name: 'hy-2.0-instruct', minInput: 2,   maxInput: 5,   minOutput: 6,   maxOutput: 12, contextWindow: 128_000 },

  // Hunyuan-T1 / TurboS
  { pattern: /hunyuan-t1(?!-vision)/i,              name: 'hunyuan-t1',                minInput: 0.5, maxInput: 2,   minOutput: 2,   maxOutput: 6,  contextWindow: 128_000 },
  { pattern: /hunyuan-turbos(?!-vision)/i,          name: 'hunyuan-turbos',            minInput: 0.5, maxInput: 1.5, minOutput: 1,   maxOutput: 3,  contextWindow: 128_000 },
  { pattern: /hunyuan-a13b/i,                       name: 'hunyuan-a13b',              minInput: 0.3, maxInput: 1,   minOutput: 1,   maxOutput: 3,  contextWindow: 128_000 },

  // Specialized
  { pattern: /hunyuan-large-role/i,                 name: 'hunyuan-large-role',        minInput: 1,   maxInput: 4,   minOutput: 6,   maxOutput: 12, contextWindow: 128_000 },
  { pattern: /hunyuan-translation-lite/i,           name: 'hunyuan-translation-lite',  minInput: 0.5, maxInput: 2,   minOutput: 2,   maxOutput: 4,  contextWindow: 128_000 },
  { pattern: /hunyuan-translation(?!-lite)/i,       name: 'hunyuan-translation',       minInput: 0.5, maxInput: 2,   minOutput: 2,   maxOutput: 5,  contextWindow: 128_000 },

  // Vision
  { pattern: /tencent.*hy.*vision.*1\.5/i,          name: 'hy-vision-1.5-instruct',    minInput: 2,   maxInput: 4,   minOutput: 6,   maxOutput: 12, contextWindow: 32_000 },
  { pattern: /hunyuan-turbos-vision-video/i,        name: 'hunyuan-turbos-vision-video', minInput: 2, maxInput: 4,   minOutput: 6,   maxOutput: 12, contextWindow: 32_000 },
  { pattern: /hunyuan-turbos-vision(?!-video)/i,    name: 'hunyuan-turbos-vision',     minInput: 2,   maxInput: 4,   minOutput: 6,   maxOutput: 12, contextWindow: 32_000 },
  { pattern: /hunyuan-t1-vision(?!-video)/i,        name: 'hunyuan-t1-vision',         minInput: 2,   maxInput: 4,   minOutput: 6,   maxOutput: 12, contextWindow: 32_000 },

  // Embedding
  { pattern: /hunyuan-embedding/i,                  name: 'hunyuan-embedding',         minInput: 0.3, maxInput: 1,   minOutput: 0.3, maxOutput: 1,  contextWindow: 8192 },

  // Legacy
  { pattern: /hunyuan-pro(?!-role)/i,               name: 'hunyuan-pro',               minInput: 3,   maxInput: 8,   minOutput: 8,   maxOutput: 20, contextWindow: 128_000 },
  { pattern: /hunyuan-standard/i,                   name: 'hunyuan-standard',          minInput: 2,   maxInput: 5,   minOutput: 5,   maxOutput: 12, contextWindow: 128_000 },
  { pattern: /hunyuan-turbo(?!s)/i,                 name: 'hunyuan-turbo',             minInput: 1,   maxInput: 3,   minOutput: 3,   maxOutput: 8,  contextWindow: 128_000 },
];

class HunyuanScraper extends KnownModelsExtractor {
  getSourceName(): string { return 'Hunyuan-Tencent'; }
  getSourceUrl(): string { return HUNYUAN_PRICING_URL; }
  models(): KnownModel[] { return KNOWN_MODELS; }
  extractMode() { return 'positional' as const; }
  currency(): string { return 'CNY'; }
  numberRegex(): RegExp { return new RegExp(NUMBER_REGEX.cny.source, 'g'); }
  modelHeaderRegex(): RegExp { return /(hunyuan|tencent.*hy)/i; }
}

export async function scrapeHunyuanDynamic(): Promise<ScraperResult> {
  return new HunyuanScraper().run();
}

if (require.main === module) {
  scrapeHunyuanDynamic().then(result => {
    console.log('\n📊 Scrape Result:');
    console.log(JSON.stringify(result, null, 2));
  });
}
