/**
 * KnownModelsExtractor — shared base for all *-dynamic.ts scrapers that follow
 * the "validate against KNOWN_MODELS price ranges" pattern (currently
 * openai, deepseek, mistral, qwen, hunyuan, anthropic, etc.).
 *
 * MIGRATION GUIDE:
 *   Existing scrapers (~200 lines each) have these duplicated pieces:
 *     1. KNOWN_MODELS array with { pattern, name, minInput, maxInput, minOutput, maxOutput }
 *     2. extractModelPrice() that walks lines, validates against ranges
 *     3. inferContextWindow() lookup table
 *     4. scrape() boilerplate (navigate + extract loop + dedupe)
 *
 *   To migrate a scraper:
 *     1. Replace the inline KNOWN_MODELS with: extends KnownModelsExtractor + override `models()`
 *     2. Override `priceLabels()` if the page uses non-default labels (e.g. 输入/输出 for CN pages)
 *     3. Override `currency()` if not USD
 *     4. Override `inferContextWindow()` if the lookup is non-trivial
 *
 *   Estimated savings: ~150 lines per migrated scraper (75% reduction).
 *
 * NOTE: this file is NEW infrastructure. Existing scrapers continue to work
 * unmodified. Migrate one at a time and run the corresponding scraper end-to-end
 * (including a write to staging DB) before moving on.
 */
import type { ScraperResult } from '../../utils/validator';
import { normalizeModelName } from '../../utils/validator';
import { PlaywrightScraper, PriceData } from './playwright-scraper';

export interface KnownModel {
  pattern: RegExp;
  name: string;          // canonical model name (used as slug seed)
  minInput: number;      // expected lower bound for input price (per-1M)
  maxInput: number;      // expected upper bound
  minOutput: number;
  maxOutput: number;
  contextWindow?: number;
}

export interface PriceLabels {
  input: RegExp;        // matches "Input:" / "输入" / "Prompt:" etc, captures number
  output: RegExp;       // matches "Output:" / "输出" / "Completion:" etc
  cachedInput?: RegExp; // optional: cache-hit price label
}

export const DEFAULT_LABELS: PriceLabels = {
  input: /(?<![Cc]ached\s)Input:\s*\$?([\d.]+)/,
  output: /Output:\s*\$?([\d.]+)/i,
  cachedInput: /Cached\s+input:\s*\$?([\d.]+)/i,
};

export const CN_LABELS: PriceLabels = {
  input: /(?:输入|Input)\s*[::]?\s*[¥$￥]?([\d.]+)/i,
  output: /(?:输出|Output)\s*[::]?\s*[¥$￥]?([\d.]+)/i,
};

export type ExtractMode = 'labeled' | 'positional';

/**
 * Default number patterns for positional mode.
 * USD: `$0.28` or `0.28`
 * CNY: `2.5元` or `¥2.5` or `￥2.5` or `2.5`
 */
export const NUMBER_REGEX = {
  usd: /\$?(\d+\.?\d*)/g,
  cny: /[¥￥]?(\d+\.?\d*)\s*元?/g,
} as const;

export abstract class KnownModelsExtractor extends PlaywrightScraper {
  /** List of models to look for. Subclass MUST override. */
  abstract models(): KnownModel[];

  /**
   * Extraction strategy:
   *   - 'labeled': look for "Input:$X.XX" / "Output:$X.XX" labels (default; OpenAI/Anthropic)
   *   - 'positional': extract all numbers in context, match first by range (DeepSeek/Qwen/CN vendors)
   */
  extractMode(): ExtractMode {
    return 'labeled';
  }

  /** Price labels for input / output / cached. Used in 'labeled' mode. */
  labels(): PriceLabels {
    return DEFAULT_LABELS;
  }

  /** Number regex for 'positional' mode. Defaults to USD style. */
  numberRegex(): RegExp {
    return new RegExp(NUMBER_REGEX.usd.source, 'g');
  }

  /**
   * Regex matching another model's header (used as stop signal when scanning
   * context to avoid bleeding into the next model's prices).
   * Default catches common model-name prefixes.
   */
  modelHeaderRegex(): RegExp {
    return /^(?:GPT-|o[0-9]|Claude|Gemini|Mistral|Mixtral|Codestral|Pixtral|Qwen|DeepSeek|Hunyuan|HY-|GLM|Kimi|MiniMax|Llama)/i;
  }

  /** Currency code for prices (USD by default). Override for non-USD vendors. */
  currency(): string {
    return 'USD';
  }

  /** Number of lines after a model header to scan for prices. */
  contextWindowLines(): number {
    return 8;
  }

  /** Infer context window for a model name. Override for vendor-specific tables. */
  inferContextWindow(model: string): number {
    return 128_000;
  }

  /** Wait time after page navigation in ms (override for slow-loading vendors). */
  waitAfterNav(): number {
    return 5_000;
  }

  /**
   * Default scrape() implementation: navigate, extract per-known-model, dedupe,
   * return ScraperResult. Subclasses can override if a vendor needs special logic.
   */
  async scrape(): Promise<ScraperResult> {
    const errors: string[] = [];
    const prices: PriceData[] = [];

    await this.navigate(this.getSourceUrl());
    await this.page!.waitForTimeout(this.waitAfterNav());

    const bodyText = (await this.page!.textContent('body')) || '';
    if (bodyText.length < 100) {
      errors.push(`Empty page body for ${this.getSourceName()} — page may be JS-blocked or geo-restricted`);
    }
    const lines = bodyText.split('\n').map(l => l.trim()).filter(Boolean);

    for (const m of this.models()) {
      const found = this.extractModel(lines, m);
      if (found && !prices.some(p => p.modelName === found.modelName)) {
        prices.push(found);
      }
    }

    if (prices.length === 0) {
      errors.push(`No prices extracted from ${this.getSourceUrl()}; page structure may have changed.`);
    }

    return {
      success: errors.length === 0 && prices.length > 0,
      source: this.getSourceName(),
      prices,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Walk the lines around a matching model header and pull input/output prices,
   * validating each against the model's expected min/max range.
   */
  protected extractModel(lines: string[], model: KnownModel): PriceData | null {
    return this.extractMode() === 'positional'
      ? this.extractModelPositional(lines, model)
      : this.extractModelLabeled(lines, model);
  }

  /** Labeled extraction (OpenAI/Anthropic style: "Input:$X.XX"). */
  protected extractModelLabeled(lines: string[], model: KnownModel): PriceData | null {
    const labels = this.labels();
    const modelHeaderRe = this.modelHeaderRegex();

    for (let i = 0; i < lines.length; i++) {
      if (!model.pattern.test(lines[i])) continue;

      const ctx = lines.slice(i, Math.min(lines.length, i + this.contextWindowLines()));
      let inputPrice: number | null = null;
      let outputPrice: number | null = null;
      let cachedInputPrice: number | undefined;

      for (const line of ctx) {
        if (line !== lines[i] && modelHeaderRe.test(line) && !model.pattern.test(line)) break;

        if (labels.cachedInput) {
          const cm = line.match(labels.cachedInput);
          if (cm) cachedInputPrice = parseFloat(cm[1]);
        }
        if (inputPrice == null) {
          const im = line.match(labels.input);
          if (im) {
            const v = parseFloat(im[1]);
            if (v >= model.minInput && v <= model.maxInput) inputPrice = v;
          }
        }
        if (outputPrice == null) {
          const om = line.match(labels.output);
          if (om) {
            const v = parseFloat(om[1]);
            if (v >= model.minOutput && v <= model.maxOutput) outputPrice = v;
          }
        }
        if (inputPrice != null && outputPrice != null) break;
      }

      if (inputPrice != null && outputPrice != null) {
        return this.build(model, inputPrice, outputPrice, cachedInputPrice);
      }
    }
    return null;
  }

  /**
   * Positional extraction (CN vendors / Mistral / DeepSeek style):
   * extract all numbers in context, find first input/output pair where each
   * value falls within its expected range. Range validation prevents the
   * "first 2 numbers wins" bug that plagued mistral-dynamic.ts pre-2026-04-13.
   */
  protected extractModelPositional(lines: string[], model: KnownModel): PriceData | null {
    const numRe = this.numberRegex();
    const modelHeaderRe = this.modelHeaderRegex();

    for (let i = 0; i < lines.length; i++) {
      if (!model.pattern.test(lines[i])) continue;

      const ctx = lines.slice(i, Math.min(lines.length, i + this.contextWindowLines()));

      // Collect candidate numbers across all context lines, stopping at
      // the next model header so we don't leak prices from neighbors.
      const candidates: number[] = [];
      for (const line of ctx) {
        if (line !== lines[i] && modelHeaderRe.test(line) && !model.pattern.test(line)) break;
        // Reset regex state — we're using /g so lastIndex persists otherwise
        const re = new RegExp(numRe.source, numRe.flags);
        for (const m of line.matchAll(re)) {
          const v = parseFloat(m[1]);
          if (v > 0 && v < 10_000) candidates.push(v);
        }
      }
      if (candidates.length < 2) continue;

      // Find first number that falls in the input range, then a *different*
      // number in the output range. Order matters: input usually appears
      // before output on the page.
      let inputPrice: number | null = null;
      let outputPrice: number | null = null;
      for (const v of candidates) {
        if (inputPrice == null && v >= model.minInput && v <= model.maxInput) {
          inputPrice = v;
          continue;
        }
        if (inputPrice != null && outputPrice == null && v !== inputPrice
            && v >= model.minOutput && v <= model.maxOutput) {
          outputPrice = v;
          break;
        }
      }

      if (inputPrice != null && outputPrice != null) {
        return this.build(model, inputPrice, outputPrice);
      }
    }
    return null;
  }

  protected build(model: KnownModel, input: number, output: number, cachedInput?: number): PriceData {
    return {
      modelName: normalizeModelName(model.name),
      inputPricePer1M: input,
      outputPricePer1M: output,
      cachedInputPricePer1M: cachedInput,
      contextWindow: model.contextWindow ?? this.inferContextWindow(model.name),
      isAvailable: true,
      currency: this.currency(),
    };
  }
}

/**
 * EXAMPLE — minimal scraper using the base. Compare with the ~270-line
 * openai-dynamic.ts that this would replace.
 *
 * class OpenAIScraperV2 extends KnownModelsExtractor {
 *   getSourceName() { return 'OpenAI-API'; }
 *   getSourceUrl()  { return 'https://openai.com/api/pricing/'; }
 *   waitAfterNav() { return 8000; }
 *
 *   models(): KnownModel[] {
 *     return [
 *       { pattern: /GPT-5\.4\s+nano/i, name: 'gpt-5.4-nano', minInput: 0.18, maxInput: 0.22, minOutput: 1.2, maxOutput: 1.3 },
 *       { pattern: /GPT-5\.4\s+mini/i, name: 'gpt-5.4-mini', minInput: 0.65, maxInput: 0.75, minOutput: 4.5, maxOutput: 5.5 },
 *       // ...
 *     ];
 *   }
 * }
 *
 * export async function scrapeOpenAIDynamic() {
 *   return new OpenAIScraperV2().run();
 * }
 */
