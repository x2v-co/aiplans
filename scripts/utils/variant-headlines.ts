import type { ScrapedPrice, ScrapedPriceVariant } from './validator';

type SeedPrice = Readonly<Record<string, unknown>>;

/** C22 applies to a model/provider group, not to each cache TTL. Validate the
 * projected group before saving a cache-write variant, including future keys.
 * A headline must carry the channel's input/output price; cache creation is a
 * separate charge and does not determine the headline input/output price.
 */
export function assertCacheWriteHeadlines(variants: readonly SeedPrice[], channels: readonly SeedPrice[]): void {
  const active = variants.filter(v => v.is_available !== false);
  const groups = new Map<string, SeedPrice[]>();
  for (const variant of active) {
    const key = `${variant.model_id}:${variant.provider_id}`;
    const group = groups.get(key) ?? [];
    group.push(variant);
    groups.set(key, group);
  }
  for (const [key, group] of groups) {
    if (!group.some(v => /^cache[-_]write(?:[-_]|$)/.test(String(v.variant_key)) || v.cache_create_price_per_1m != null)) continue;
    const headlines = group.filter(v => v.is_headline === true);
    if (headlines.length !== 1) throw new Error(`Cache-write group ${key} requires exactly one active headline (found ${headlines.length}); nothing written.`);
    const matching = channels.filter(c => c.model_id === group[0].model_id && c.provider_id === group[0].provider_id && c.is_available !== false);
    if (matching.length !== 1) throw new Error(`Cache-write group ${key} requires exactly one active channel price; nothing written.`);
    for (const field of ['input_price_per_1m', 'output_price_per_1m']) {
      const headline = headlines[0][field];
      const channel = matching[0][field];
      if (headline == null || channel == null || !Number.isFinite(Number(headline)) || !Number.isFinite(Number(channel)) || Math.abs(Number(headline) - Number(channel)) >= 1e-6) {
        throw new Error(`Cache-write group ${key} headline must match channel ${field}; nothing written.`);
      }
    }
  }
}

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
