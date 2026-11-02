import type { AiCatalogItem } from './ai-vertical-catalog';

/** Preserve the denominator in explicit token units across all verticals.
 * Older catalog rows used per_token as a billing family even for /1M rates.
 * Only structured unit fields are read; prices are never inferred from prose.
 */
export function catalogBillingUnit(item: AiCatalogItem): AiCatalogItem['billingUnit'] {
  const millionTokens = [item.pricingUnit, item.unit].some(unit =>
    unit != null && /^per[ _]1m[ _]tokens$/i.test(unit.trim()));
  if (millionTokens && (!item.billingUnit || item.billingUnit === 'per_token' || item.billingUnit === 'per_1m_tokens')) {
    return 'per_1m_tokens';
  }
  return item.billingUnit;
}
