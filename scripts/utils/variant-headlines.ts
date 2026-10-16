import type { ScrapedPrice, ScrapedPriceVariant } from './validator';

/**
 * Every active variant group needs exactly one headline variant equal to the
 * channel price (audit C22). Scrapers that only publish extra tiers for a
 * model (e.g. Anthropic fast mode for Opus 5.5 / 5 / 4.8) left groups with no
 * headline (`variants.no_headline`). Add a `standard` headline variant from
 * the scraped base price for each such model. Models without a scraped base
 * price are left alone (their variants are not written anyway).
 */
export function addStandardHeadlines(
  prices: ScrapedPrice[],
  variants: ScrapedPriceVariant[],
  sourceUrl?: string,
): ScrapedPriceVariant[] {
  const withHeadline = new Set(variants.filter(v => v.isHeadline).map(v => v.modelSlug));
  const needing = [...new Set(variants.map(v => v.modelSlug))].filter(slug => slug && !withHeadline.has(slug));
  const added: ScrapedPriceVariant[] = [];
  for (const slug of needing) {
    const base = prices.find(p => p.modelSlug === slug && p.inputPricePer1M != null && p.outputPricePer1M != null);
    if (!base) continue;
    added.push({
      modelName: base.modelName, modelSlug: slug, variantKey: 'standard', variantName: 'Standard',
      variantKind: 'tier', inputPricePer1M: base.inputPricePer1M, outputPricePer1M: base.outputPricePer1M,
      cachedInputPricePer1M: base.cachedInputPricePer1M ?? undefined, currency: base.currency,
      sourceUrl, isAvailable: true, isPublic: true, isSelfService: true, isHeadline: true,
      constraints: { speed: 'standard' },
    } as ScrapedPriceVariant);
  }
  return [...variants, ...added];
}

/**
 * An "unverified" scrape (base row present but its price not parsed this run)
 * must not null out a channel row that already carries a real price: that
 * re-created Haiku 5.5's `variants.headline_drift` (channel null/null vs
 * headline variant 0.10/0.50) after every run where the docs row was missed.
 */
export function keepsLastKnownPrice(existing: { input_price_per_1m?: unknown; output_price_per_1m?: unknown } | null | undefined): boolean {
  return existing?.input_price_per_1m != null && existing?.output_price_per_1m != null;
}
