/**
 * xAI model pricing from the official structured model directory.
 *
 * docs.x.ai embeds __XAI_PUBLIC_MODELS__ as JSON. The token price fields are
 * expressed in thousandths of a dollar per million tokens (12500 = $12.50/M).
 * Aliases are intentionally not emitted as separate products.
 */

import type { ScraperResult } from '../utils/validator';
import type { PriceData } from './lib/playwright-scraper';

const XAI_MODELS_URL = 'https://docs.x.ai/docs/models';
const XAI_DIRECTORY_MARKER = 'globalThis.__XAI_PUBLIC_MODELS__=';

interface XaiLanguageModel {
  name?: string;
  outputModalities?: string[];
  promptTextTokenPrice?: string;
  cachedPromptTokenPrice?: string;
  completionTextTokenPrice?: string;
  maxPromptLength?: number;
}

interface XaiDirectory {
  clusterConfigs?: Array<{ languageModels?: XaiLanguageModel[] }>;
}

function canonicalModelName(name: string): string {
  if (name === 'grok-build-0.1') return 'grok-code-fast-1';
  return name.replace(/-0309(?=-|$)/, '');
}

function parseDirectory(html: string): PriceData[] {
  const markerIndex = html.indexOf(XAI_DIRECTORY_MARKER);
  if (markerIndex < 0) throw new Error('xAI structured model directory was not found');

  const jsonStart = markerIndex + XAI_DIRECTORY_MARKER.length;
  const jsonEnd = html.indexOf(';</script>', jsonStart);
  if (jsonEnd < 0) throw new Error('xAI structured model directory is incomplete');

  const directory = JSON.parse(html.slice(jsonStart, jsonEnd)) as XaiDirectory;
  const unique = new Map<string, PriceData>();

  for (const model of directory.clusterConfigs?.flatMap(config => config.languageModels ?? []) ?? []) {
    if (!model.name || !model.outputModalities?.includes('TEXT')) continue;
    const inputRaw = Number(model.promptTextTokenPrice);
    const outputRaw = Number(model.completionTextTokenPrice);
    if (!Number.isFinite(inputRaw) || !Number.isFinite(outputRaw)) continue;

    const modelName = canonicalModelName(model.name);
    const inputPrice = inputRaw / 1000;
    const outputPrice = outputRaw / 1000;
    if (inputPrice <= 0 || outputPrice < inputPrice) continue;

    if (!unique.has(modelName)) {
      unique.set(modelName, {
        modelName,
        inputPricePer1M: inputPrice,
        outputPricePer1M: outputPrice,
        cachedInputPricePer1M: model.cachedPromptTokenPrice
          ? Number(model.cachedPromptTokenPrice) / 1000
          : undefined,
        contextWindow: model.maxPromptLength ?? null,
        isAvailable: true,
        currency: 'USD',
      });
    }
  }

  return [...unique.values()];
}

export async function scrapeGrokDynamic(): Promise<ScraperResult> {
  try {
    const response = await fetch(XAI_MODELS_URL, {
      headers: { Accept: 'text/html' },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`xAI models request failed with HTTP ${response.status}`);

    const prices = parseDirectory(await response.text());
    const errors = prices.length === 0 ? ['No current xAI text model prices were found'] : undefined;
    return {
      source: 'Grok-API',
      success: prices.length > 0,
      prices,
      errors,
    };
  } catch (error) {
    return {
      source: 'Grok-API',
      success: false,
      prices: [],
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}

if (require.main === module) {
  scrapeGrokDynamic().then(result => console.log(JSON.stringify(result, null, 2)));
}
