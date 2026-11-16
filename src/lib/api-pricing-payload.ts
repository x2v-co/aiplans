import type { ChannelPrice, ChannelPriceVariant, GroupedProduct } from './grouped-products';
import type { ChannelTermsFields } from './channel-terms';
import type { CurrencyCode } from './currency';
import type { PriceSchedule } from './effective-price';
import { deriveProviderRegions, shouldShowChinaBadge } from './supported-regions';

/**
 * The /api-pricing props, trimmed to what api-pricing-view.tsx renders.
 *
 * Every prop of a client component is serialized into the page's RSC flight
 * data, and the view needs every model (search, sort and filters run in the
 * browser), so the full `getGroupedProducts` payload used to ship inline:
 * 2.8 MB of the 3.8 MB HTML that /en/api-pricing served on 2026-11-16. Most of
 * it was never read: the same provider object repeated on every channel row,
 * benchmark arrays (only the arena number is shown), and the raw OpenRouter
 * endpoint metadata (`constraints_json`, uptime, quantization) on ~1,300 price
 * variants. This module keeps the rendered fields, stores each provider once,
 * and drops null fields; `expandApiPricingPayload` rebuilds the shape the view
 * reads. The /api/products/grouped contract is unchanged.
 */

// A type alias (not an interface) so it satisfies index-signature props such as
// LimitedTimeOfferRow['providers'].
export type ApiPricingProvider = {
  id: number;
  name: string;
  slug: string;
  type: string;
  region?: string | null;
  logo?: string | null;
  logo_url?: string | null;
  website?: string | null;
  pricing_url?: string | null;
  invite_url?: string | null;
  /**
   * Sourced evidence that the provider serves mainland China, i.e.
   * `shouldShowChinaBadge(deriveProviderRegions(provider), 'zh')`. Precomputed
   * so the region evidence fields (country lists, source URLs, notes) stay on
   * the server.
   */
  china_badge?: true;
};

/** Fields the variant list and DeepSeek peak/off-peak badge read. */
export type ApiPricingVariant = Pick<ChannelPriceVariant,
  'id' | 'variant_name' | 'input_price_per_1m' | 'output_price_per_1m' | 'currency'
> & Partial<Pick<ChannelPriceVariant,
  'variant_kind' | 'is_headline' | 'cached_input_price_per_1m' | 'constraints_json'
>>;

interface ApiPricingChannelBase extends PriceSchedule, ChannelTermsFields {
  id: number;
  input_price_per_1m: number;
  output_price_per_1m: number;
  cached_input_price_per_1m?: number | null;
  currency: CurrencyCode;
  /** Only `[needs-verification]` notes are rendered. */
  notes?: string | null;
  member_shutdown_date?: string | null;
  model_slug?: string;
  variant?: string[];
  /** Only kept when a channel has two or more variants (the only case rendered). */
  price_variants?: ApiPricingVariant[];
}

export interface ApiPricingChannelWire extends ApiPricingChannelBase {
  provider_id: number;
}

export interface ApiPricingChannel extends ApiPricingChannelBase {
  providers: ApiPricingProvider;
}

interface ApiPricingProductBase {
  id: number;
  name: string;
  slug: string;
  context_window?: number | null;
  benchmark_arena_elo?: number | null;
  released_at?: string | Date | null;
  created_at?: string | Date | null;
  shutdown_date?: string | null;
  replacement_model?: string | null;
}

export interface ApiPricingProductWire extends ApiPricingProductBase {
  /** Omitted when it is the lowercased slug. */
  baseName?: string;
  /** Omitted when the card has a single member (its own slug). */
  memberSlugs?: string[];
  provider_id?: number;
  versions: ApiPricingChannelWire[];
}

export interface ApiPricingProduct extends ApiPricingProductBase {
  baseName: string;
  memberSlugs: string[];
  providers: ApiPricingProvider | null;
  versions: ApiPricingChannel[];
}

export interface ApiPricingPayload {
  providers: ApiPricingProvider[];
  products: ApiPricingProductWire[];
}

type ProviderInput = NonNullable<GroupedProduct['providers']> | ChannelPrice['providers'];

/** Copies the listed keys, skipping null and undefined values. */
function pick<T extends object, K extends keyof T>(source: T, keys: readonly K[]): Partial<Pick<T, K>> {
  const out: Partial<Pick<T, K>> = {};
  for (const key of keys) {
    const value = source[key];
    if (value != null) out[key] = value;
  }
  return out;
}

function slimProvider(provider: ProviderInput): ApiPricingProvider {
  return {
    id: provider.id,
    name: provider.name,
    slug: provider.slug,
    type: 'type' in provider && typeof provider.type === 'string' ? provider.type : '',
    ...pick(provider as ChannelPrice['providers'], ['region', 'logo', 'logo_url', 'website', 'pricing_url', 'invite_url']),
    ...(shouldShowChinaBadge(deriveProviderRegions(provider), 'zh') ? { china_badge: true as const } : {}),
  };
}

function slimVariant(variant: ChannelPriceVariant): ApiPricingVariant {
  // DeepSeekWindowPrices reads only these two keys; the rest of
  // constraints_json is OpenRouter endpoint metadata that nothing renders.
  const windowConstraints = variant.variant_kind === 'time_window' && variant.constraints_json
    ? pick(variant.constraints_json, ['time_window', 'peak_schedule'])
    : null;
  return {
    id: variant.id,
    variant_name: variant.variant_name,
    input_price_per_1m: variant.input_price_per_1m,
    output_price_per_1m: variant.output_price_per_1m,
    currency: variant.currency,
    ...pick(variant, ['variant_kind', 'cached_input_price_per_1m']),
    ...(variant.is_headline ? { is_headline: true } : {}),
    ...(windowConstraints && Object.keys(windowConstraints).length ? { constraints_json: windowConstraints } : {}),
  };
}

const CHANNEL_KEYS = [
  'cached_input_price_per_1m', 'promo_ends_at', 'regular_input_price_per_1m', 'regular_output_price_per_1m',
  'regular_cached_input_price_per_1m', 'data_for_discount', 'data_for_discount_note', 'quota_unit', 'variant',
] as const satisfies ReadonlyArray<keyof ChannelPrice>;

function slimChannel(cp: ChannelPrice, card: GroupedProduct): ApiPricingChannelWire {
  return {
    id: cp.id,
    provider_id: cp.providers.id,
    input_price_per_1m: cp.input_price_per_1m,
    output_price_per_1m: cp.output_price_per_1m,
    currency: cp.currency,
    ...pick(cp, CHANNEL_KEYS),
    ...(cp.notes?.startsWith('[needs-verification]') ? { notes: cp.notes } : {}),
    // The row badge only renders when a member's date differs from the card's.
    ...(cp.member_shutdown_date && cp.member_shutdown_date !== card.shutdown_date
      ? { member_shutdown_date: cp.member_shutdown_date } : {}),
    ...(cp.model_slug && cp.model_slug !== card.slug ? { model_slug: cp.model_slug } : {}),
    ...((cp.price_variants?.length ?? 0) > 1 ? { price_variants: cp.price_variants!.map(slimVariant) } : {}),
  };
}

export function buildApiPricingPayload(products: GroupedProduct[]): ApiPricingPayload {
  const providers = new Map<number, ApiPricingProvider>();
  const remember = (provider: ProviderInput) => {
    if (!providers.has(provider.id)) providers.set(provider.id, slimProvider(provider));
    return provider.id;
  };
  const wire = products.map((card): ApiPricingProductWire => ({
    id: card.id,
    name: card.name,
    slug: card.slug,
    ...pick(card, ['context_window', 'benchmark_arena_elo', 'released_at', 'created_at', 'shutdown_date', 'replacement_model']),
    ...(card.baseName !== card.slug.toLowerCase() ? { baseName: card.baseName } : {}),
    ...(card.memberSlugs && (card.memberSlugs.length !== 1 || card.memberSlugs[0] !== card.slug)
      ? { memberSlugs: card.memberSlugs } : {}),
    ...(card.providers ? { provider_id: remember(card.providers) } : {}),
    versions: card.versions.map((cp) => {
      remember(cp.providers);
      return slimChannel(cp, card);
    }),
  }));
  return { providers: [...providers.values()], products: wire };
}

/** Rebuilds the nested shape the view renders. Pure, so SSR and hydration agree. */
export function expandApiPricingPayload(payload: ApiPricingPayload): ApiPricingProduct[] {
  const providers = new Map(payload.providers.map((provider) => [provider.id, provider]));
  return payload.products.map(({ provider_id, baseName, memberSlugs, versions, ...card }) => ({
    ...card,
    baseName: baseName ?? card.slug.toLowerCase(),
    memberSlugs: memberSlugs ?? [card.slug],
    providers: provider_id != null ? providers.get(provider_id) ?? null : null,
    versions: versions.map(({ provider_id: channelProviderId, ...cp }) => ({
      ...cp,
      model_slug: cp.model_slug ?? card.slug,
      providers: providers.get(channelProviderId)!,
    })),
  }));
}

/** zh-only China badge, from the precomputed sourced evidence. */
export function showChinaBadge(provider: ApiPricingProvider | null | undefined, locale: string): boolean {
  return locale === 'zh' && provider?.china_badge === true;
}
