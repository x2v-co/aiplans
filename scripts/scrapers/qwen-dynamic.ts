/**
 * Qwen / 通义千问 API Scraper — Alibaba Cloud Model Studio pricing page.
 * NO FALLBACK DATA — fails cleanly when scraping fails.
 *
 * Migrated 2026-04-13 to use KnownModelsExtractor base class.
 * Original was ~214 lines; this is ~70 lines.
 *
 * Prices on this page are CNY (¥/元 per 1M tokens).
 */
import type { ScraperResult } from '../utils/validator';
import { KnownModelsExtractor, NUMBER_REGEX, type KnownModel } from './lib/known-models-extractor';

const QWEN_PRICING_URL = 'https://help.aliyun.com/zh/model-studio/billing-for-model-studio';

const KNOWN_MODELS: KnownModel[] = [
  // Qwen3 Max series (flagship)
  { pattern: /qwen3-max/i,            name: 'qwen3-max',         minInput: 2.0,  maxInput: 3.0,  minOutput: 8,    maxOutput: 12,   contextWindow: 32_000 },
  { pattern: /qwen-max(?!-long|-vl)/i, name: 'qwen-max',          minInput: 2.0,  maxInput: 3.0,  minOutput: 8,    maxOutput: 12,   contextWindow: 32_000 },

  // Qwen3.5 Plus / Plus
  { pattern: /qwen3\.5-plus/i,        name: 'qwen3.5-plus',      minInput: 0.5,  maxInput: 1.2,  minOutput: 1.5,  maxOutput: 3,    contextWindow: 128_000 },
  { pattern: /qwen-plus(?!-long|-coder)/i, name: 'qwen-plus',     minInput: 0.5,  maxInput: 1.2,  minOutput: 1.5,  maxOutput: 3,    contextWindow: 128_000 },

  // Qwen3.5 Flash / Flash
  { pattern: /qwen3\.5-flash/i,       name: 'qwen3.5-flash',     minInput: 0.1,  maxInput: 0.3,  minOutput: 1.5,  maxOutput: 3,    contextWindow: 128_000 },
  { pattern: /qwen-flash/i,           name: 'qwen-flash',        minInput: 0.1,  maxInput: 0.25, minOutput: 1,    maxOutput: 2,    contextWindow: 128_000 },

  // Turbo
  { pattern: /qwen-turbo/i,           name: 'qwen-turbo',        minInput: 0.2,  maxInput: 0.5,  minOutput: 0.4,  maxOutput: 1,    contextWindow: 8192 },

  // Coder series
  { pattern: /qwen3-coder-plus/i,     name: 'qwen3-coder-plus',  minInput: 3,    maxInput: 5,    minOutput: 12,   maxOutput: 20,   contextWindow: 32_000 },
  { pattern: /qwen3-coder-flash/i,    name: 'qwen3-coder-flash', minInput: 0.5,  maxInput: 1.5,  minOutput: 3,    maxOutput: 5,    contextWindow: 32_000 },
  { pattern: /qwen-coder-plus/i,      name: 'qwen-coder-plus',   minInput: 2.5,  maxInput: 4.5,  minOutput: 5,    maxOutput: 9,    contextWindow: 32_000 },

  // VL (vision)
  { pattern: /qwen3-vl-plus/i,        name: 'qwen3-vl-plus',     minInput: 0.5,  maxInput: 1.5,  minOutput: 8,    maxOutput: 12,   contextWindow: 32_000 },
  { pattern: /qwen3-vl-flash/i,       name: 'qwen3-vl-flash',    minInput: 0.1,  maxInput: 0.25, minOutput: 0.5,  maxOutput: 2,    contextWindow: 32_000 },
  { pattern: /qwen-vl-max/i,          name: 'qwen-vl-max',       minInput: 1,    maxInput: 2,    minOutput: 3,    maxOutput: 5,    contextWindow: 8192 },

  // Reasoning
  { pattern: /qwq-plus/i,             name: 'qwq-plus',          minInput: 1,    maxInput: 2,    minOutput: 3,    maxOutput: 5,    contextWindow: 128_000 },
  { pattern: /qvq-max/i,              name: 'qvq-max',           minInput: 5,    maxInput: 10,   minOutput: 25,   maxOutput: 40,   contextWindow: 32_000 },

  // Long context
  { pattern: /qwen-long/i,            name: 'qwen-long',         minInput: 0.3,  maxInput: 0.7,  minOutput: 1.5,  maxOutput: 3,    contextWindow: 1_000_000 },

  // Math
  { pattern: /qwen-math-plus/i,       name: 'qwen-math-plus',    minInput: 3,    maxInput: 5,    minOutput: 10,   maxOutput: 15,   contextWindow: 32_000 },

  // OCR
  { pattern: /qwen-vl-ocr/i,          name: 'qwen-vl-ocr',       minInput: 0.2,  maxInput: 0.4,  minOutput: 0.3,  maxOutput: 0.7,  contextWindow: 8192 },
];

class QwenScraper extends KnownModelsExtractor {
  getSourceName(): string { return 'Qwen'; }
  getSourceUrl(): string { return QWEN_PRICING_URL; }
  models(): KnownModel[] { return KNOWN_MODELS; }
  extractMode() { return 'positional' as const; }
  currency(): string { return 'CNY'; }
  numberRegex(): RegExp { return new RegExp(NUMBER_REGEX.cny.source, 'g'); }
  modelHeaderRegex(): RegExp { return /qwen[0-9.\-]/i; }
  contextWindowLines(): number { return 5; }
}

export async function scrapeQwenDynamic(): Promise<ScraperResult> {
  return new QwenScraper().run();
}

if (require.main === module) {
  scrapeQwenDynamic().then(result => {
    console.log('\n📊 Scrape Result:');
    console.log(JSON.stringify(result, null, 2));
  });
}
