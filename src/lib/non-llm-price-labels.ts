import en from '../../messages/en.json';
import zh from '../../messages/zh.json';
import { catalogForKind } from '@/lib/ai-vertical-catalog';
import { IMAGE_MODEL_CATALOG } from '@/lib/image-model-catalog';
import { NON_LLM_CATALOG } from '@/lib/non-llm-catalog';

type PriceCopy = Record<string, string>;

function copyFor(locale: string): PriceCopy {
  return (locale === 'zh' ? zh.nonLlmModels : en.nonLlmModels) as PriceCopy;
}

/** Readable fallback when a price key has no locale entry. */
export function humanizePriceKey(key: string): string {
  if (!key) return key;
  if (/[\s/()]/.test(key)) return key.trim();
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Label a usageRates.priceKind, usageRates.unit, or pricingUnit for display. */
export function labelNonLlmPriceKey(key: string, locale: string): string {
  const hit = copyFor(locale)[key];
  if (typeof hit === 'string' && hit.length > 0) return hit;
  return humanizePriceKey(key);
}

/** Every priceKind / unit / pricingUnit used on image, voice, video and music cards. */
export function catalogPriceLabelKeys(): string[] {
  const keys = new Set<string>();
  const items = [
    ...NON_LLM_CATALOG,
    ...IMAGE_MODEL_CATALOG,
    ...catalogForKind('video-model'),
    ...catalogForKind('music-model'),
  ];
  for (const item of items) {
    if (item.pricingUnit) keys.add(item.pricingUnit);
    for (const rate of item.usageRates ?? []) {
      keys.add(rate.priceKind);
      keys.add(rate.unit);
    }
  }
  return [...keys].sort();
}
