/**
 * OpenAI API Scraper — uses Playwright to parse https://openai.com/api/pricing/.
 * NO FALLBACK DATA — fails cleanly when scraping fails.
 *
 * Migrated 2026-04-13 to use KnownModelsExtractor base class.
 * Original was ~270 lines; this is ~50 lines.
 *
 * Each KNOWN_MODELS entry defines:
 *   - pattern: regex matching the model header on the pricing page
 *   - name: canonical slug
 *   - min/maxInput, min/maxOutput: validation range (rejects parsed prices outside)
 */
import type { ScraperResult } from '../utils/validator';
import { KnownModelsExtractor, type KnownModel } from './lib/known-models-extractor';

const OPENAI_PRICING_URL = 'https://openai.com/api/pricing/';

const KNOWN_MODELS: KnownModel[] = [
  // GPT-5.4 series (current flagship as of 2026-03)
  { pattern: /GPT-5\.4\s+nano/i, name: 'gpt-5.4-nano', minInput: 0.18, maxInput: 0.22, minOutput: 1.2, maxOutput: 1.3, contextWindow: 128_000 },
  { pattern: /GPT-5\.4\s+mini/i, name: 'gpt-5.4-mini', minInput: 0.65, maxInput: 0.75, minOutput: 4.5, maxOutput: 5.5, contextWindow: 128_000 },
  { pattern: /GPT-5\.4(?!\s*(mini|nano))/i, name: 'gpt-5.4', minInput: 2.5, maxInput: 3.0, minOutput: 14.5, maxOutput: 15.5, contextWindow: 128_000 },

  // GPT-4o series
  { pattern: /GPT-4o\s+mini/i, name: 'gpt-4o-mini', minInput: 0.12, maxInput: 0.18, minOutput: 0.45, maxOutput: 0.55, contextWindow: 128_000 },
  { pattern: /GPT-4o(?!\s*mini)/i, name: 'gpt-4o', minInput: 2.0, maxInput: 2.75, minOutput: 7.5, maxOutput: 10.5, contextWindow: 128_000 },

  // GPT-4.1 series (launched 2025-04-14)
  { pattern: /GPT-4\.1\s+nano/i, name: 'gpt-4.1-nano', minInput: 0.08, maxInput: 0.12, minOutput: 0.35, maxOutput: 0.45, contextWindow: 1_000_000 },
  { pattern: /GPT-4\.1\s+mini/i, name: 'gpt-4.1-mini', minInput: 0.35, maxInput: 0.45, minOutput: 1.5, maxOutput: 1.7, contextWindow: 1_000_000 },
  { pattern: /GPT-4\.1(?!\s*(mini|nano))/i, name: 'gpt-4.1', minInput: 1.8, maxInput: 2.2, minOutput: 7.5, maxOutput: 8.5, contextWindow: 1_000_000 },

  // GPT-4 legacy
  { pattern: /GPT-4\s+turbo/i, name: 'gpt-4-turbo', minInput: 9, maxInput: 11, minOutput: 29, maxOutput: 31, contextWindow: 128_000 },
  { pattern: /GPT-4(?!\s*[.o])/i, name: 'gpt-4', minInput: 29, maxInput: 31, minOutput: 59, maxOutput: 61, contextWindow: 8_192 },

  // GPT-3.5
  { pattern: /GPT-3\.5\s+turbo/i, name: 'gpt-3.5-turbo', minInput: 0.45, maxInput: 0.55, minOutput: 1.4, maxOutput: 1.6, contextWindow: 16_385 },

  // o-series reasoning models
  { pattern: /o1\s+mini/i, name: 'o1-mini', minInput: 1.8, maxInput: 2.2, minOutput: 7, maxOutput: 9, contextWindow: 128_000 },
  { pattern: /o1\s+preview/i, name: 'o1-preview', minInput: 14, maxInput: 16, minOutput: 55, maxOutput: 65, contextWindow: 128_000 },
  { pattern: /o3\s+mini/i, name: 'o3-mini', minInput: 0.9, maxInput: 1.2, minOutput: 3.5, maxOutput: 4.5, contextWindow: 200_000 },
  { pattern: /o3\s+pro/i, name: 'o3-pro', minInput: 19, maxInput: 21, minOutput: 79, maxOutput: 81, contextWindow: 200_000 },
  { pattern: /o4\s+mini/i, name: 'o4-mini', minInput: 0.9, maxInput: 1.2, minOutput: 3.5, maxOutput: 4.5, contextWindow: 128_000 },
  { pattern: /o3(?!\s*(mini|pro))/i, name: 'o3', minInput: 1.8, maxInput: 2.2, minOutput: 7.5, maxOutput: 8.5, contextWindow: 200_000 },
  { pattern: /o1(?!\s*(mini|preview))/i, name: 'o1', minInput: 14, maxInput: 16, minOutput: 55, maxOutput: 65, contextWindow: 200_000 },
];

class OpenAIScraper extends KnownModelsExtractor {
  getSourceName(): string { return 'OpenAI-API'; }
  getSourceUrl(): string { return OPENAI_PRICING_URL; }
  models(): KnownModel[] { return KNOWN_MODELS; }
  // OpenAI's page is heavy JS + occasional Cloudflare challenge
  waitAfterNav(): number { return 8000; }
}

export async function scrapeOpenAIDynamic(): Promise<ScraperResult> {
  return new OpenAIScraper().run();
}

// CLI test
if (require.main === module) {
  scrapeOpenAIDynamic().then(result => {
    console.log('\n📊 Scrape Result:');
    console.log(JSON.stringify(result, null, 2));
  });
}
