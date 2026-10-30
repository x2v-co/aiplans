import type { AiCatalogItem } from '../../src/lib/ai-vertical-catalog';

/** Kinds whose model rows are owned by the 2026-10-15 catalog audit seed. */
export const AUDIT_OWNED_VERTICAL_KINDS = ['video-model', 'music-model', 'decision-model'] as const;

export function isAuditOwnedVertical(item: AiCatalogItem): boolean {
  return (AUDIT_OWNED_VERTICAL_KINDS as readonly string[]).includes(item.kind);
}

/**
 * Single definition of the audited model fields. Both seed-catalog-audit and the
 * deploy-time seed-vertical-models use it, so a deploy can no longer rewrite them.
 */
export function auditVerticalModelFields(item: AiCatalogItem) {
  return {
    // subq-snap keeps the catalog's decision taxonomy; the P0 SQL preserves it too.
    model_category: item.modelCategory,
    pricing_unit: item.kind === 'decision-model' ? 'per_1m_tokens'
      : item.billingUnit === 'per_1m_tokens' ? 'per_1m_tokens'
      : item.billingUnit === 'per_second' ? 'per_second'
      : item.billingUnit === 'per_minute' ? 'per_minute'
      : item.billingUnit === 'per_song' ? 'per_generation' : 'unknown',
    description: verticalModelDescription(item),
  };
}

/** Plan-less usage row written by the catalog-audit seed. Deploy pricing uses seed-vertical-pricing. */
export function auditVerticalUsage(item: AiCatalogItem): readonly [string, string, number | null] {
  if (item.billingUnit === 'per_1m_tokens') return ['video_output_tokens', 'per_1m_tokens', item.pricePerUnit ?? null];
  if (item.billingUnit === 'per_minute') return ['minute', 'minute', item.pricePerUnit ?? null];
  if (item.billingUnit === 'per_song') return ['generation', 'song', item.pricePerUnit ?? null];
  if (item.billingUnit === 'per_second') return ['video_second', 'second', item.pricePerUnit ?? null];
  return ['availability', 'unknown', item.pricePerUnit ?? null];
}

/** Old seed identities to repair in place, scoped by model/provider/plan by callers. */
export function legacyVideoUsageKeys(item: AiCatalogItem): readonly (readonly [string, string])[] {
  const seconds = [['video_second', 'second'], ['video_second', 'per_second'],
    ['video_output_tokens', 'second'], ['video_output_tokens', 'per_second']] as const;
  if (item.slug === 'gemini-omni-1-1-flash') {
    return [['availability', 'unknown'], ['availability', 'availability'], ...seconds];
  }
  if (item.slug === 'seedance') return [...seconds, ['generation', 'generation']];
  return [];
}

/** Keep "Unit:" and "Sources:" lines: src/lib/vertical-models.ts parses Sources from it. */
export function verticalModelDescription(item: AiCatalogItem): string {
  const sources = item.sourceUrls?.map((source) => `${source.publisher}: ${source.url}`).join(' | ');
  return [
    item.bestFor,
    `Status: ${item.status}. Pricing confidence: ${item.pricingConfidence}. Unit: ${item.pricingUnit}. Last verified: ${item.lastVerified}.`,
    item.notes,
    sources ? `Sources: ${sources}` : undefined,
  ].filter(Boolean).join('\n');
}
