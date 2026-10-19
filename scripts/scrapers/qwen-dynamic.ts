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
import { KnownModelsExtractor, type KnownModel } from './lib/known-models-extractor';

const QWEN_PRICING_URL = 'https://help.aliyun.com/zh/model-studio/billing-for-model-studio';

const KNOWN_MODELS: KnownModel[] = [
  // Qwen3 Max series (flagship). Base input band 0-128K is ¥9/$54 as of the
  // 2026-09 Bailuan page; the scraper previously matched the 2026-01 snapshot
  // rows (¥2.5/10) below this table and stored stale prices (C19).
  { pattern: /qwen3-max/i,            name: 'qwen3-max',         minInput: 8,    maxInput: 10,   minOutput: 50,   maxOutput: 58,   contextWindow: 32_000 },
  { pattern: /qwen-max(?!-long|-vl)/i, name: 'qwen-max',          minInput: 2.0,  maxInput: 3.0,  minOutput: 8,    maxOutput: 12,   contextWindow: 32_000 },

  // Qwen3.5 Plus — headline is the ≤128K band ¥0.8/4.8 (model-pricing,
  // 华北2 北京, verified 2026-10-19). The old 1.5–2.5 / 10–14 window matched
  // the 128K–256K band ¥2/12 first. Higher bands stay in price variants;
  // this window must not accept them or the neighboring qwen-plus ¥0.8/2 row.
  { pattern: /qwen3\.5-plus/i,        name: 'qwen3.5-plus',      minInput: 0.75, maxInput: 0.85, minOutput: 4.6,  maxOutput: 5.0,  contextWindow: 128_000 },
  { pattern: /qwen-plus(?!-long|-coder)/i, name: 'qwen-plus',     minInput: 0.5,  maxInput: 1.2,  minOutput: 1.5,  maxOutput: 3,    contextWindow: 128_000 },

  // Qwen3.5 Flash / qwen-flash — headline is ≤128K. qwen3.5-flash is ¥0.2/2
  // (then ¥0.8/8 and ¥1.2/12). qwen-flash is ¥0.15/1.5, not the old ¥0.2/2
  // pin and not qwen-flash-character ¥0.25/1.5. Windows reject those rows
  // and the higher context bands so the positional matcher cannot store them
  // as the displayed price.
  { pattern: /qwen3\.5-flash/i,       name: 'qwen3.5-flash',     minInput: 0.18, maxInput: 0.22, minOutput: 1.9,  maxOutput: 2.1,  contextWindow: 128_000 },
  { pattern: /qwen-flash/i,           name: 'qwen-flash',        minInput: 0.14, maxInput: 0.16, minOutput: 1.4,  maxOutput: 1.6,  contextWindow: 128_000 },

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

  // ─── Current-generation models without a direct Bailuan channel row ───
  // Base-band CNY prices verified 2026-09-11 on model-pricing; added because
  // these previously had aggregator channels only. Dense open-weight rows
  // share the 2/8 tier so patterns must anchor to the full slug.
  // Flagship 3.7/3.8 Max (single band, 1M context):
  { pattern: /qwen3\.7-max/i,        name: 'qwen3.7-max',      minInput: 10,   maxInput: 13,   minOutput: 30,   maxOutput: 40,   contextWindow: 1_000_000 },
  { pattern: /qwen3\.8-max/i,        name: 'qwen3.8-max',      minInput: 10,   maxInput: 13,   minOutput: 30,   maxOutput: 40,   contextWindow: 1_000_000 },
  // Plus current band 0-256K:
  { pattern: /qwen3\.6-plus/i,       name: 'qwen3.6-plus',     minInput: 1.5,  maxInput: 2.5,  minOutput: 10,   maxOutput: 14,   contextWindow: 1_000_000 },
  // Flash family:
  { pattern: /qwen3\.6-flash/i,      name: 'qwen3.6-flash',    minInput: 1.0,  maxInput: 1.4,  minOutput: 6,    maxOutput: 8.5,  contextWindow: 1_000_000 },
  { pattern: /qwen3\.7-flash/i,      name: 'qwen3.7-flash',    minInput: 0.15, maxInput: 0.3,  minOutput: 0.6,  maxOutput: 1.0,  contextWindow: 1_000_000 },
  { pattern: /qwen3\.8-flash/i,      name: 'qwen3.8-flash',    minInput: 0.6,  maxInput: 0.95, minOutput: 2.2,  maxOutput: 3.2,  contextWindow: 1_000_000 },
  // Open-weight dense/MoT (flat tiered rows, base band):
  { pattern: /qwen3-235b-a22b/i,     name: 'qwen3-235b-a22b',  minInput: 1.5,  maxInput: 2.5,  minOutput: 6,    maxOutput: 10,   contextWindow: 128_000 },
  { pattern: /qwen3-32b/i,           name: 'qwen3-32b',        minInput: 1.5,  maxInput: 2.5,  minOutput: 6,    maxOutput: 10,   contextWindow: 128_000 },
  { pattern: /qwen3-14b/i,           name: 'qwen3-14b',        minInput: 0.8,  maxInput: 1.2,  minOutput: 3,    maxOutput: 5,    contextWindow: 128_000 },
  { pattern: /qwen3-8b/i,            name: 'qwen3-8b',         minInput: 0.4,  maxInput: 0.6,  minOutput: 1.5,  maxOutput: 2.5,  contextWindow: 128_000 },
  { pattern: /qwen3\.5-397b-a17b/i,  name: 'qwen3.5-397b-a17b', minInput: 1.0, maxInput: 1.4,  minOutput: 6,    maxOutput: 8.5,  contextWindow: 256_000 },
];

/** Same first-pair rule as KnownModelsExtractor positional mode. */
export function qwenPositionalPair(name: string, candidates: readonly number[]): { input: number; output: number } | null {
  const model = KNOWN_MODELS.find(item => item.name === name);
  if (!model) return null;
  let inputPrice: number | null = null;
  let outputPrice: number | null = null;
  for (const value of candidates) {
    if (inputPrice == null && value >= model.minInput && value <= model.maxInput) {
      inputPrice = value;
      continue;
    }
    if (inputPrice != null && outputPrice == null && value !== inputPrice && value >= model.minOutput && value <= model.maxOutput) {
      outputPrice = value;
      break;
    }
  }
  return inputPrice != null && outputPrice != null ? { input: inputPrice, output: outputPrice } : null;
}

class QwenScraper extends KnownModelsExtractor {
  getSourceName(): string { return 'Qwen'; }
  getSourceUrl(): string { return QWEN_PRICING_URL; }
  models(): KnownModel[] { return KNOWN_MODELS; }
  extractMode() { return 'positional' as const; }
  currency(): string { return 'CNY'; }
  numberRegex(): RegExp {
    // Require the 元 unit. The default CNY regex (元 optional) treats digits in
    // model-name/alias lines as price candidates: "当前能力等同于
    // qwen3-coder-plus-2025-09-23" feeds 3, 2025, 9, 23 into the positional
    // matcher, and 3 matched the input window so qwen3-coder-plus read ¥3
    // instead of ¥4 (C19). Every real price on this page is rendered "N元".
    return /[¥￥]?(\d+\.?\d*)\s*元/g;
  }
  modelHeaderRegex(): RegExp { return /qwen[0-9.\-]/i; }
  // Newer rows carry alias/Batch/cache/mode/band lines (up to 6) before the
  // first 元 price; the next-model header stops scanning before those.
  contextWindowLines(): number { return 12; }
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
