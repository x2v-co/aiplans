import type { ChannelPrice, ChannelPriceVariant, GroupedProduct } from './grouped-products';
import type { CatalogQuery } from './api-pricing-query';
import { CATALOG_PAGE_SIZE, CHANNEL_PAGE_SIZE, VARIANT_PAGE_SIZE } from './api-pricing-query';
import { SEO_MODEL_ALLOWLIST } from './seo-index-policy';
import { matchesSearch } from './search-match';
import { effectivePrice } from './effective-price';
import { limitedTimeOffer } from './limited-time-offer';
import { usd, normalizeChannelType } from './channel-price-utils';
import { deriveProviderRegions, sourcedChinaAccess } from './supported-regions';
import { modelFreshnessTime } from './model-freshness';
import { getProviderVisitRel, getProviderVisitUrl } from './provider-links';

export type CatalogProvider = {
  name: string;
  slug: string;
  type: string;
  region: string | null;
  china: boolean;
  href: string | null;
  rel: string;
}
export type CatalogChannel = Pick<ChannelPrice, 'id' | 'input_price_per_1m' | 'output_price_per_1m' |
  'cached_input_price_per_1m' | 'currency' | 'price_unit' | 'variant' | 'member_shutdown_date' |
  'promo_ends_at' | 'regular_input_price_per_1m' | 'regular_output_price_per_1m' |
  'regular_cached_input_price_per_1m' | 'data_for_discount' | 'data_for_discount_note' | 'quota_unit' | 'notes'> & {
    model_slug: string;
    providers: CatalogProvider;
    variantCount: number;
  };
export type CatalogVariant = Pick<ChannelPriceVariant, 'id' | 'variant_name' | 'variant_kind' | 'is_headline' |
  'input_price_per_1m' | 'output_price_per_1m' | 'cached_input_price_per_1m' | 'currency' | 'price_unit'> & {
    constraints_json?: Record<string, unknown>;
  };
export interface CatalogRow {
  slug: string;
  name: string;
  producer: string | null;
  context: number | null;
  shutdown: string | null;
  channelCount: number;
  quote: CatalogChannel | null;
}
export interface CatalogPage { rows: CatalogRow[]; total: number; offset: number; nextOffset: number | null }
export interface ChannelPage { slug: string; name: string; rows: CatalogChannel[]; total: number; offset: number; nextOffset: number | null; requestedAt: string }
export interface VariantPage { slug: string; channelId: number; rows: CatalogVariant[]; total: number; offset: number; nextOffset: number | null }

const china = (provider: Parameters<typeof deriveProviderRegions>[0]) => sourcedChinaAccess(deriveProviderRegions(provider)) === true;
const compareSlug = (a: GroupedProduct, b: GroupedProduct) => a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
const selected = (p: GroupedProduct) => SEO_MODEL_ALLOWLIST.has(p.slug) || (p.memberSlugs ?? []).some(slug => SEO_MODEL_ALLOWLIST.has(slug));

/** Only token units are comparable. Unknown/request/subscription units never establish a token floor. */
function inputUSD(cp: ChannelPrice): number | null {
  const value = usd(cp.input_price_per_1m, cp.currency);
  if (value == null || !Number.isFinite(value) || value < 0) return null;
  return cp.price_unit === 'per_1m_tokens' ? value : cp.price_unit === 'per_1k_tokens' ? value * 1000 : null;
}

function quoteFor(product: GroupedProduct, channels: ChannelPrice[], now: Date): ChannelPrice | null {
  // A sibling mini/batch/snapshot price must never be advertised as the canonical model's price.
  const exact = channels.filter(cp => (cp.model_slug ?? product.slug) === product.slug && !(cp.variant?.length)).map(cp => effectivePrice(cp, now));
  return [...exact].sort((a, b) => (inputUSD(a) ?? Infinity) - (inputUSD(b) ?? Infinity) || a.id - b.id)[0] ?? null;
}

/** Every active channel control must match the same channel, never producer metadata. */
export function eligibleChannels(product: GroupedProduct, query: CatalogQuery, now: Date): ChannelPrice[] {
  return product.versions.filter(cp =>
    (query.region === 'all' || cp.providers.region === query.region) &&
    (query.channel === 'all' || normalizeChannelType(cp.providers.type) === query.channel) &&
    (!query.china || china(cp.providers)) &&
    (!query.promo || limitedTimeOffer(effectivePrice(cp, now), now) !== null));
}

export function catalogChannel(cp: ChannelPrice, slug: string, now: Date): CatalogChannel {
  const row = effectivePrice(cp, now);
  return {
    id: row.id, model_slug: row.model_slug ?? slug,
    input_price_per_1m: row.input_price_per_1m, output_price_per_1m: row.output_price_per_1m,
    cached_input_price_per_1m: row.cached_input_price_per_1m, currency: row.currency, price_unit: row.price_unit,
    variant: row.variant, member_shutdown_date: row.member_shutdown_date,
    promo_ends_at: row.promo_ends_at, regular_input_price_per_1m: row.regular_input_price_per_1m,
    regular_output_price_per_1m: row.regular_output_price_per_1m, regular_cached_input_price_per_1m: row.regular_cached_input_price_per_1m,
    data_for_discount: row.data_for_discount, data_for_discount_note: row.data_for_discount_note, quota_unit: row.quota_unit,
    notes: row.notes?.startsWith('[needs-verification]') ? row.notes : undefined,
    providers: { name: row.providers.name, slug: row.providers.slug, type: row.providers.type,
      region: row.providers.region ?? null, china: china(row.providers),
      href: getProviderVisitUrl(row.providers, 'api'), rel: getProviderVisitRel(row.providers, 'api') },
    variantCount: row.price_variants?.length ?? 0,
  };
}

/** Public catalog remains on the server. Only one bounded projection crosses the client boundary. */
export function catalogPage(products: GroupedProduct[], query: CatalogQuery, now: Date): CatalogPage {
  const channelFiltered = query.region !== 'all' || query.channel !== 'all' || query.china || query.promo;
  const filtered = products.flatMap(p => {
    if (query.q && !matchesSearch(query.q, [p.name, p.slug, p.baseName, p.providers?.name,
      ...(p.memberSlugs ?? []), ...p.versions.flatMap(cp => [cp.model_slug, cp.providers.name, cp.providers.slug])])) return [];
    const channels = eligibleChannels(p, query, now);
    if (channelFiltered && !channels.length) return [];
    return [{ product: p, quote: quoteFor(p, channels, now), channelCount: channels.length }];
  });
  const direction = query.order === 'asc' ? 1 : -1;
  filtered.sort(({ product: a, quote: aq }, { product: b, quote: bq }) => {
    let order = 0;
    switch (query.sort) {
      case 'selected': order = Number(selected(b)) - Number(selected(a)) || direction * ((a.benchmark_arena_elo ?? 0) - (b.benchmark_arena_elo ?? 0)); break;
      case 'name': order = direction * (a.name < b.name ? -1 : a.name > b.name ? 1 : 0); break;
      case 'elo': order = direction * ((a.benchmark_arena_elo ?? 0) - (b.benchmark_arena_elo ?? 0)); break;
      case 'context': order = direction * ((a.context_window ?? 0) - (b.context_window ?? 0)); break;
      case 'latest': order = direction * (modelFreshnessTime(a) - modelFreshnessTime(b)); break;
      case 'price': {
        const av = aq && inputUSD(aq), bv = bq && inputUSD(bq);
        if (av == null || bv == null) order = av == null ? bv == null ? 0 : 1 : -1;
        else order = direction * (av - bv);
        break;
      }
    }
    return order || compareSlug(a, b);
  });
  const rows = filtered.slice(query.offset, query.offset + CATALOG_PAGE_SIZE).map(({ product: p, quote: cp, channelCount }) => {
    return { slug: p.slug, name: p.name, producer: p.providers?.name ?? null, context: p.context_window ?? null,
      shutdown: p.shutdown_date ?? null, channelCount, quote: cp ? catalogChannel(cp, p.slug, now) : null };
  });
  return { rows, total: filtered.length, offset: query.offset,
    nextOffset: query.offset + rows.length < filtered.length ? query.offset + rows.length : null };
}

export function channelPage(products: GroupedProduct[], slug: string, offset: number, now: Date, query?: CatalogQuery): ChannelPage | null {
  const product = products.find(p => p.slug === slug);
  if (!product) return null;
  const channels = query ? eligibleChannels(product, query, now) : product.versions;
  const rows = channels.slice(offset, offset + CHANNEL_PAGE_SIZE).map(cp => catalogChannel(cp, slug, now));
  return { slug, name: product.name, rows, total: channels.length, offset,
    nextOffset: offset + rows.length < channels.length ? offset + rows.length : null, requestedAt: now.toISOString() };
}

export function variantPage(products: GroupedProduct[], slug: string, channelId: number, offset: number, now: Date, query?: CatalogQuery): VariantPage | null {
  const product = products.find(p => p.slug === slug);
  const channel = product && (query ? eligibleChannels(product, query, now) : product.versions).find(cp => cp.id === channelId);
  if (!channel) return null;
  const variants = effectivePrice(channel, now).price_variants ?? [];
  const rows = variants.slice(offset, offset + VARIANT_PAGE_SIZE).map(v => ({
    id: v.id, variant_name: v.variant_name, variant_kind: v.variant_kind, is_headline: v.is_headline,
    input_price_per_1m: v.input_price_per_1m, output_price_per_1m: v.output_price_per_1m,
    cached_input_price_per_1m: v.cached_input_price_per_1m, currency: v.currency, price_unit: v.price_unit,
    ...(v.variant_kind === 'time_window' && v.constraints_json ? { constraints_json: {
      time_window: v.constraints_json.time_window, peak_schedule: v.constraints_json.peak_schedule,
    } } : {}),
  }));
  return { slug, channelId, rows, total: variants.length, offset, nextOffset: offset + rows.length < variants.length ? offset + rows.length : null };
}
