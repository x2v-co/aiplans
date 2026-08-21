/**
 * Pure helpers for picking the cheapest channel of a model and normalising
 * channel types for display.
 *
 * Channels are stored in the vendor's own currency — 154 CNY rows against 533
 * USD ones — so comparing `input_price_per_1m` directly treats ¥3 as $3. Since
 * the same real cost is a ~6.9× larger number in CNY, every Chinese channel was
 * judged the more expensive one: the cheapest channel was picked wrongly for 17
 * models, worst of all qwen3.5-flash, which reported $0.065 as its floor when
 * the true floor was $0.029 (124% too high). All "cheapest" selection below
 * therefore normalises to USD before comparing; display still renders each row
 * in its own currency via formatPrice.
 *
 * These live at module scope (not inside a component) so the React Compiler can
 * memoize useMemo/useDeferredValue filtering that depends on them.
 */
import type { CurrencyCode } from '@/lib/currency';
import { convertToUSD } from '@/lib/currency-conversion';
import type { ChannelPrice, GroupedProduct } from '@/lib/grouped-products';

/** Normalises a channel price to USD for comparison only. */
export function usd(
  price: number | null | undefined,
  currency: CurrencyCode,
): number | null {
  if (price == null) return null;
  return convertToUSD(price, currency || 'USD');
}

// Normalize legacy DB channel type values to the canonical set that has
// i18n entries. 'producer' is an older name for 'official' (the company
// that makes the model) — without this mapping the Badge renders the raw
// key `apiPricing.channelTypes.producer`. Any other unknown value falls
// back to 'aggregator'.
export function normalizeChannelType(
  type: string | null | undefined,
): 'official' | 'cloud' | 'aggregator' | 'reseller' {
  switch (type) {
    case 'official':
    case 'producer':
      return 'official';
    case 'cloud':
    case 'aggregator':
    case 'reseller':
      return type;
    default:
      return 'aggregator';
  }
}

function isOfficial(cp: ChannelPrice): boolean {
  const t = cp.providers?.type;
  return t === 'official' || t === 'producer';
}

/**
 * The single cheapest available channel of a model by USD-normalised input
 * price. Returns null when the model has no priced channel.
 */
export function getCheapestChannel(product: GroupedProduct): ChannelPrice | null {
  let best: ChannelPrice | null = null;
  let bestUsd = Infinity;
  for (const cp of product.versions) {
    const v = usd(cp.input_price_per_1m, cp.currency || 'USD');
    if (v != null && v < bestUsd) {
      bestUsd = v;
      best = cp;
    }
  }
  return best;
}

/**
 * The cheapest official/producer channel of a model by USD-normalised input
 * price. Used as the baseline for "vs Official" savings. Returns null when the
 * model has no official channel priced.
 */
export function getCheapestOfficialChannel(
  product: GroupedProduct,
): ChannelPrice | null {
  let best: ChannelPrice | null = null;
  let bestUsd = Infinity;
  for (const cp of product.versions) {
    if (!isOfficial(cp)) continue;
    const v = usd(cp.input_price_per_1m, cp.currency || 'USD');
    if (v != null && v < bestUsd) {
      bestUsd = v;
      best = cp;
    }
  }
  return best;
}

/** Cheapest input price across all channels, in USD. Falls back to official. */
export function getLowestPriceUSD(product: GroupedProduct): number | null {
  const cheapest = getCheapestChannel(product);
  if (cheapest) {
    return usd(
      cheapest.input_price_per_1m,
      cheapest.currency || 'USD',
    );
  }
  return getCheapestOfficialPrice(product);
}

/** Cheapest official/producer input price, in USD. */
export function getCheapestOfficialPrice(product: GroupedProduct): number | null {
  const official = getCheapestOfficialChannel(product);
  if (!official) return null;
  return usd(
    official.input_price_per_1m,
    official.currency || 'USD',
  );
}
