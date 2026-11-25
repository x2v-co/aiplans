import { createHash } from 'node:crypto';
import { canonicalJson } from '@/lib/planprice-v1-snapshot';
import { SITE_URL } from '@/lib/seo';

/** Public citation sample. Not a market census and not a redistributed price database. */
export const CITABLE_SCHEMA = 'aiplans-citable-official-quotes/1';

/** Same window as the read-only price staleness audit. */
export const DEFAULT_MAX_AGE_DAYS = 30;

export const COVERAGE_WORDING = {
  en: 'Live quote redistribution is unpublished. This download contains no live quotes and is not a complete official tariff. Local synthetic fixtures are not market data.',
  zh: '实时报价的再分发范围尚未发布，下载不包含实时报价，也不是完整的官方价目表。本地合成示例不是市场数据。',
} as const;

export const REDISTRIBUTION = {
  en: 'aiplans.dev does not grant a CC0, MIT, or other republication license for these third-party prices. Redistribution rights have not been independently verified; live quote exports remain empty (redistribution_scope_unpublished). Aggregator, reseller, cloud-marketplace, and benchmark feeds stay out of this file.',
  zh: 'aiplans.dev 不就这些第三方价格授予 CC0、MIT 或其他再分发许可。再分发权利尚未经独立核验，实时报价导出保持为空（redistribution_scope_unpublished）。聚合、转售、云市场和基准数据都不进入本文件。',
} as const;

export const HISTORY_LIMIT = {
  en: 'This entry serves the current publishable sample. Earlier snapshot files are not kept here.',
  zh: '这个入口提供当前可公开的样本。更早的快照文件不在这里提供。',
} as const;

export const PUBLIC_QUOTE_FIELDS = [
  'model_slug',
  'model_name',
  'provider_slug',
  'provider_name',
  'channel_role',
  'currency',
  'price_unit',
  'input_price',
  'input_missing',
  'output_price',
  'output_missing',
  'cached_input_price',
  'cached_input_missing',
  'zero_price',
  'promo_active',
  'promo_ends_at',
  'regular_input_price',
  'regular_input_missing',
  'regular_output_price',
  'regular_output_missing',
  'regular_cached_input_price',
  'regular_cached_input_missing',
  'billing_conditions',
  'source_url',
  'verified_at',
  'citation_url_en',
  'citation_url_zh',
  'replaces_model_slug',
  'successor_model_slug',
  'shutdown_date',
] as const;

export type PublicQuoteField = typeof PUBLIC_QUOTE_FIELDS[number];
export type ChannelRole = 'official' | 'producer';
export type WithholdReason = 'stale' | 'unverified' | 'missing_source' | 'redistribution_scope_unpublished';

export interface PublicQuote {
  model_slug: string;
  model_name: string;
  provider_slug: string;
  provider_name: string;
  channel_role: ChannelRole;
  currency: string;
  price_unit: string;
  input_price: number | null;
  input_missing: boolean;
  output_price: number | null;
  output_missing: boolean;
  cached_input_price: number | null;
  cached_input_missing: boolean;
  zero_price: boolean;
  promo_active: boolean;
  promo_ends_at: string | null;
  regular_input_price: number | null;
  regular_input_missing: boolean;
  regular_output_price: number | null;
  regular_output_missing: boolean;
  regular_cached_input_price: number | null;
  regular_cached_input_missing: boolean;
  billing_conditions: string;
  source_url: string;
  verified_at: string;
  citation_url_en: string;
  citation_url_zh: string;
  replaces_model_slug: string;
  successor_model_slug: string;
  shutdown_date: string | null;
}

/** A normalized row. Withheld rows stay available for same-scope comparisons and stay out of the download. */
export interface Observation extends Omit<PublicQuote, 'source_url' | 'verified_at'> {
  source_url: string | null;
  verified_at: string | null;
  withhold: WithholdReason | null;
}

export interface RawChannelQuote {
  model_slug?: unknown;
  model_name?: unknown;
  provider_slug?: unknown;
  provider_name?: unknown;
  provider_type?: unknown;
  source_url?: unknown;
  pricing_url?: unknown;
  website?: unknown;
  currency?: unknown;
  price_unit?: unknown;
  input_price_per_1m?: unknown;
  output_price_per_1m?: unknown;
  cached_input_price_per_1m?: unknown;
  promo_ends_at?: unknown;
  regular_input_price_per_1m?: unknown;
  regular_output_price_per_1m?: unknown;
  regular_cached_input_price_per_1m?: unknown;
  last_verified?: unknown;
  is_available?: unknown;
  is_public?: unknown;
  is_partner_only?: unknown;
  is_self_service?: unknown;
  data_for_discount?: unknown;
  sample?: unknown;
  replaces_model_slug?: unknown;
  replacement_model?: unknown;
  shutdown_date?: unknown;
  variant_key?: unknown;
  variant_kind?: unknown;
  constraints_json?: unknown;
  channel_notes?: unknown;
  variant_notes?: unknown;
}

export interface Rejection {
  reason: string;
  model_slug: string | null;
  provider_slug: string | null;
}

export interface CitableSnapshot {
  schema: typeof CITABLE_SCHEMA;
  snapshot_id: string;
  generated_at: string;
  as_of: string;
  max_age_days: number;
  prior_snapshots_retained: false;
  history: 'current_sample_only';
  sample_kind: 'synthetic_fixture' | 'live_official_public_quotes';
  coverage: {
    wording_en: string;
    wording_zh: string;
    included: number;
    excluded_counts: Record<string, number>;
    excluded_counts_in_snapshot_id: false;
  };
  not_market_data: boolean;
  empty_export_reason: 'redistribution_scope_unpublished' | null;
  redistribution: {
    status: 'synthetic_fixture' | 'unpublished';
    granted_license: null;
    cc0: false;
    mit: false;
    statement_en: string;
    statement_zh: string;
  };
  quotes: PublicQuote[];
}

export interface PreparedQuotes {
  fixture: boolean;
  as_of: string;
  generated_at: string;
  max_age_days: number;
  observations: Observation[];
  rejections: Rejection[];
  publishable: PublicQuote[];
  excluded_counts: Record<string, number>;
  duplicates_collapsed: number;
  snapshot: CitableSnapshot;
}

export interface PrepareOptions {
  allowFixture?: boolean;
  asOf?: Date;
  generatedAt?: Date;
  maxAgeDays?: number;
}

const UNIT_ALIASES: Record<string, string> = {
  per_1m_tokens: 'per_1m_tokens',
  per_million_tokens: 'per_1m_tokens',
  '1m_tokens': 'per_1m_tokens',
  per_1m: 'per_1m_tokens',
  per_1k_tokens: 'per_1k_tokens',
  per_thousand_tokens: 'per_1k_tokens',
  per_1k: 'per_1k_tokens',
  per_request: 'per_request',
};

const SLUG_PATTERN = /^[a-z0-9][a-z0-9._-]{0,159}$/;
const HISTORY_QUERY_PARAMS = new Set(['snapshot', 'version', 'as_of', 'date', 'history', 'at']);

type PriceRead = { kind: 'missing' } | { kind: 'invalid' } | { kind: 'value'; value: number };

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const text = value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text || text.length > max) return null;
  return text;
}

function slug(value: unknown): string | null {
  const text = cleanText(value, 160);
  if (!text) return null;
  const normalized = text.toLowerCase();
  return SLUG_PATTERN.test(normalized) ? normalized : null;
}

function isTrue(value: unknown): boolean {
  return value === true || value === 'true';
}

function readPrice(value: unknown): PriceRead {
  if (value === null || value === undefined || value === '') return { kind: 'missing' };
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.trim()) : Number.NaN;
  if (!Number.isFinite(number)) return { kind: 'invalid' };
  if (number < 0) return { kind: 'invalid' };
  return { kind: 'value', value: number };
}

function readDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== 'string' || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function sourceCandidate(value: unknown, allowFixture: boolean): { url: string } | { error: 'missing' | 'invalid' | 'fixture' } {
  if (value === null || value === undefined || value === '') return { error: 'missing' };
  if (typeof value !== 'string') return { error: 'invalid' };
  const text = value.trim();
  if (text.length > 500) return { error: 'invalid' };
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return { error: 'invalid' };
  }
  if (url.protocol !== 'https:' || url.username || url.password) return { error: 'invalid' };
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')) return { error: 'invalid' };
  if (!allowFixture && (/(^|\.)example\.(test|invalid|com|org|net)$/.test(host) || host.endsWith('.test') || host.endsWith('.invalid'))) return { error: 'fixture' };
  // A site root/homepage cannot establish pricing provenance.
  if (!url.pathname.replace(/\//g, '') || /(?:^|\/)(?:index\.(?:html?|php)|home)\/?$/i.test(url.pathname)) return { error: 'invalid' };
  if (!/(?:pricing|prices|price|tariff|billing)/i.test(url.pathname)) return { error: 'invalid' };
  return { url: url.href };
}

export function trustedPricingSource(value: unknown, allowFixture = false): string | null {
  const parsed = sourceCandidate(value, allowFixture);
  return 'url' in parsed ? parsed.url : null;
}

function chooseSource(row: RawChannelQuote, allowFixture: boolean): { url: string | null; error: 'invalid' | 'fixture' | 'missing' | null } {
  for (const candidate of [row.source_url, row.pricing_url]) {
    const parsed = sourceCandidate(candidate, allowFixture);
    if ('url' in parsed) return { url: parsed.url, error: null };
    if (parsed.error !== 'missing') return { url: null, error: parsed.error };
  }
  return { url: null, error: 'missing' };
}

export function canonicalPriceUnit(value: unknown): string | null {
  const text = cleanText(value, 80);
  if (!text) return null;
  return UNIT_ALIASES[text.toLowerCase().replace(/[\s-]+/g, '_')] ?? null;
}

function slot(price: number | null): 'quoted' | 'missing' {
  return price === null ? 'missing' : 'quoted';
}

function researchedScope(row: RawChannelQuote): string | null {
  let constraints = row.constraints_json;
  if (typeof constraints === 'string') {
    try { constraints = JSON.parse(constraints); } catch { return null; }
  }
  if (!constraints || typeof constraints !== 'object' || Array.isArray(constraints)) return null;
  const channelNotes = cleanText(row.channel_notes, 4000);
  const variantNotes = cleanText(row.variant_notes, 4000);
  if ((row.channel_notes && !channelNotes) || (row.variant_notes && !variantNotes)) return null;
  if (Object.keys(constraints).length === 0 && !channelNotes && !variantNotes) return null;
  // Canonical structured constraints and researched notes all participate in identity.
  return canonicalJson({ variant: cleanText(row.variant_key, 200), kind: cleanText(row.variant_kind, 100), constraints, channel_notes: channelNotes, variant_notes: variantNotes });
}

function billingConditions(scope: string, input: number | null, output: number | null, cached: number | null, promo: string): string {
  return `scope=${scope};input=${slot(input)};output=${slot(output)};cache=${slot(cached)};promo=${promo}`;
}

function sortedCounts(counts: Map<string, number>): Record<string, number> {
  return Object.fromEntries([...counts.entries()].filter(([, count]) => count > 0).sort(([left], [right]) => left.localeCompare(right)));
}

function bump(counts: Map<string, number>, reason: string): void {
  counts.set(reason, (counts.get(reason) ?? 0) + 1);
}

export function snapshotDigest(quotes: PublicQuote[]): string {
  const ordered = [...quotes].sort((left, right) => fullKey(left).localeCompare(fullKey(right)));
  return `sha256:${createHash('sha256').update(canonicalJson(ordered), 'utf8').digest('hex')}`;
}

export function fullKey(quote: Pick<PublicQuote, 'model_slug' | 'provider_slug' | 'currency' | 'price_unit' | 'billing_conditions'>): string {
  return [quote.model_slug, quote.provider_slug, quote.currency, quote.price_unit, quote.billing_conditions].join('\t');
}

export function channelKey(quote: Pick<PublicQuote, 'model_slug' | 'provider_slug'>): string {
  return `${quote.model_slug}\t${quote.provider_slug}`;
}

function rejection(reason: string, model: string | null, provider: string | null): { observation: null; rejection: Rejection } {
  return { observation: null, rejection: { reason, model_slug: model, provider_slug: provider } };
}

export function normalizeChannelQuote(row: RawChannelQuote, options: PrepareOptions = {}): { observation: Observation | null; rejection: Rejection | null } {
  const allowFixture = options.allowFixture === true;
  const asOf = options.asOf ?? new Date();
  const maxAgeDays = options.maxAgeDays ?? DEFAULT_MAX_AGE_DAYS;
  const model = slug(row.model_slug);
  const provider = slug(row.provider_slug);
  if (row.sample === 'synthetic_fixture' && !allowFixture) return rejection('synthetic_blocked', model, provider);

  const modelName = cleanText(row.model_name, 200);
  const providerName = cleanText(row.provider_name, 200);
  if (!model || !modelName || !provider || !providerName) return rejection('invalid_identity', model, provider);

  const providerType = cleanText(row.provider_type, 40)?.toLowerCase() ?? '';
  let channelRole: ChannelRole;
  if (providerType === 'official') channelRole = 'official';
  else if (providerType === 'producer') channelRole = 'producer';
  else return rejection('non_official_channel', model, provider);
  if (row.is_available === false) return rejection('unavailable', model, provider);
  if (isTrue(row.data_for_discount) || row.is_public === false || isTrue(row.is_partner_only) || row.is_self_service === false) {
    return rejection('restricted_or_nonpublic', model, provider);
  }

  if (row.is_available !== true || row.is_public !== true || row.is_self_service !== true || row.is_partner_only !== false || row.data_for_discount !== false) {
    return rejection('eligibility_unestablished', model, provider);
  }
  const scope = researchedScope(row);
  if (!scope) return rejection('scope_unestablished', model, provider);

  const currency = cleanText(row.currency, 8)?.toUpperCase() ?? '';
  if (!/^[A-Z]{3}$/.test(currency)) return rejection('invalid_currency', model, provider);
  const priceUnit = canonicalPriceUnit(row.price_unit);
  if (!priceUnit) return rejection('invalid_unit', model, provider);

  const source = chooseSource(row, allowFixture);
  if (source.error === 'invalid') return rejection('invalid_source', model, provider);
  if (source.error === 'fixture') return rejection('fixture_source_blocked', model, provider);

  const input = readPrice(row.input_price_per_1m);
  const output = readPrice(row.output_price_per_1m);
  const cached = readPrice(row.cached_input_price_per_1m);
  if (input.kind === 'invalid' || output.kind === 'invalid' || cached.kind === 'invalid') return rejection('negative_or_invalid_price', model, provider);

  const promoDate = readDate(row.promo_ends_at);
  if (row.promo_ends_at != null && row.promo_ends_at !== '' && !promoDate) return rejection('ambiguous_promo', model, provider);
  const regularInput = readPrice(row.regular_input_price_per_1m);
  const regularOutput = readPrice(row.regular_output_price_per_1m);
  const regularCached = readPrice(row.regular_cached_input_price_per_1m);
  if (regularInput.kind === 'invalid' || regularOutput.kind === 'invalid' || regularCached.kind === 'invalid') {
    return rejection('negative_or_invalid_price', model, provider);
  }
  const regularPresent = regularInput.kind === 'value' || regularOutput.kind === 'value' || regularCached.kind === 'value';
  if (!promoDate && regularPresent) return rejection('ambiguous_promo', model, provider);

  let headlineInput = input.kind === 'value' ? input.value : null;
  let headlineOutput = output.kind === 'value' ? output.value : null;
  let headlineCached = cached.kind === 'value' ? cached.value : null;
  let promoActive = false;
  let promoEnds: string | null = null;
  let citedRegularInput: number | null = null;
  let citedRegularOutput: number | null = null;
  let citedRegularCached: number | null = null;

  if (promoDate && promoDate.getTime() <= asOf.getTime()) {
    if (regularInput.kind !== 'value' || regularOutput.kind !== 'value') return rejection('expired_promo_without_regular', model, provider);
    headlineInput = regularInput.value;
    headlineOutput = regularOutput.value;
    headlineCached = regularCached.kind === 'value' ? regularCached.value : null;
  } else if (promoDate) {
    promoActive = true;
    promoEnds = promoDate.toISOString();
    citedRegularInput = regularInput.kind === 'value' ? regularInput.value : null;
    citedRegularOutput = regularOutput.kind === 'value' ? regularOutput.value : null;
    citedRegularCached = regularCached.kind === 'value' ? regularCached.value : null;
  }

  if (headlineInput === null && headlineOutput === null) return rejection('missing_price', model, provider);

  const verified = readDate(row.last_verified);
  let withhold: WithholdReason | null = null;
  if (source.error === 'missing') withhold = 'missing_source';
  else if (!verified || verified.getTime() > asOf.getTime()) withhold = 'unverified';
  else if (verified.getTime() < asOf.getTime() - maxAgeDays * 86_400_000) withhold = 'stale';

  if (!withhold && !allowFixture) withhold = 'redistribution_scope_unpublished';
  const replaces = slug(row.replaces_model_slug) ?? '';
  const observation: Observation = {
    model_slug: model,
    model_name: modelName,
    provider_slug: provider,
    provider_name: providerName,
    channel_role: channelRole,
    currency,
    price_unit: priceUnit,
    input_price: headlineInput,
    input_missing: headlineInput === null,
    output_price: headlineOutput,
    output_missing: headlineOutput === null,
    cached_input_price: headlineCached,
    cached_input_missing: headlineCached === null,
    zero_price: headlineInput === 0 || headlineOutput === 0,
    promo_active: promoActive,
    promo_ends_at: promoEnds,
    regular_input_price: citedRegularInput,
    regular_input_missing: citedRegularInput === null,
    regular_output_price: citedRegularOutput,
    regular_output_missing: citedRegularOutput === null,
    regular_cached_input_price: citedRegularCached,
    regular_cached_input_missing: citedRegularCached === null,
    billing_conditions: billingConditions(scope, headlineInput, headlineOutput, headlineCached, promoActive && promoEnds ? `until:${promoEnds}` : 'none'),
    source_url: source.url,
    verified_at: withhold === 'unverified' || !verified ? null : verified.toISOString(),
    citation_url_en: `${SITE_URL}/en/models/${model}`,
    citation_url_zh: `${SITE_URL}/zh/models/${model}`,
    replaces_model_slug: replaces,
    successor_model_slug: slug(row.replacement_model) ?? '',
    shutdown_date: readDate(row.shutdown_date)?.toISOString() ?? null,
    withhold,
  };
  return { observation, rejection: null };
}

export function toPublicQuote(observation: Observation): PublicQuote | null {
  if (observation.withhold || !observation.source_url || !observation.verified_at) return null;
  return {
    model_slug: observation.model_slug,
    model_name: observation.model_name,
    provider_slug: observation.provider_slug,
    provider_name: observation.provider_name,
    channel_role: observation.channel_role,
    currency: observation.currency,
    price_unit: observation.price_unit,
    input_price: observation.input_price,
    input_missing: observation.input_missing,
    output_price: observation.output_price,
    output_missing: observation.output_missing,
    cached_input_price: observation.cached_input_price,
    cached_input_missing: observation.cached_input_missing,
    zero_price: observation.zero_price,
    promo_active: observation.promo_active,
    promo_ends_at: observation.promo_ends_at,
    regular_input_price: observation.regular_input_price,
    regular_input_missing: observation.regular_input_missing,
    regular_output_price: observation.regular_output_price,
    regular_output_missing: observation.regular_output_missing,
    regular_cached_input_price: observation.regular_cached_input_price,
    regular_cached_input_missing: observation.regular_cached_input_missing,
    billing_conditions: observation.billing_conditions,
    source_url: observation.source_url,
    verified_at: observation.verified_at,
    citation_url_en: observation.citation_url_en,
    citation_url_zh: observation.citation_url_zh,
    replaces_model_slug: observation.replaces_model_slug,
    successor_model_slug: observation.successor_model_slug,
    shutdown_date: observation.shutdown_date,
  };
}


/** Re-evaluate a saved public quote at a later comparison clock. Does not rewrite snapshot bytes or the digest. */
export function reobservePublicQuote(
  quote: PublicQuote,
  comparisonAsOf: Date,
  options: { maxAgeDays?: number; fixture: boolean },
): { observation: Observation | null; rejection: Rejection | null } {
  const maxAgeDays = options.maxAgeDays ?? DEFAULT_MAX_AGE_DAYS;
  const promoEnds = readDate(quote.promo_ends_at);
  if (quote.promo_ends_at && !promoEnds) return rejection('ambiguous_promo', quote.model_slug, quote.provider_slug);

  let input = quote.input_price;
  let output = quote.output_price;
  let cached = quote.cached_input_price;
  let promoActive = quote.promo_active;
  let promoEndsAt = quote.promo_ends_at;
  let regularInput = quote.regular_input_price;
  let regularOutput = quote.regular_output_price;
  let regularCached = quote.regular_cached_input_price;
  let billing = quote.billing_conditions;

  if (promoEnds && promoEnds.getTime() <= comparisonAsOf.getTime()) {
    if (quote.regular_input_price === null || quote.regular_output_price === null) {
      return rejection('expired_promo_without_regular', quote.model_slug, quote.provider_slug);
    }
    input = quote.regular_input_price;
    output = quote.regular_output_price;
    cached = quote.regular_cached_input_price;
    promoActive = false;
    promoEndsAt = null;
    regularInput = null;
    regularOutput = null;
    regularCached = null;
    const scope = /^scope=(\{.*\});input=(quoted|missing);output=(quoted|missing);cache=(quoted|missing);promo=/.exec(quote.billing_conditions);
    if (!scope) return rejection('scope_unestablished', quote.model_slug, quote.provider_slug);
    billing = billingConditions(scope[1], input, output, cached, 'none');
  }

  let withhold: WithholdReason | null = options.fixture ? null : 'redistribution_scope_unpublished';
  const verified = readDate(quote.verified_at);
  if (!verified || verified.getTime() > comparisonAsOf.getTime()) withhold = 'unverified';
  else if (verified.getTime() < comparisonAsOf.getTime() - maxAgeDays * 86_400_000) withhold = 'stale';

  const observation: Observation = {
    ...quote,
    input_price: input,
    input_missing: input === null,
    output_price: output,
    output_missing: output === null,
    cached_input_price: cached,
    cached_input_missing: cached === null,
    zero_price: input === 0 || output === 0,
    promo_active: promoActive,
    promo_ends_at: promoEndsAt,
    regular_input_price: regularInput,
    regular_input_missing: regularInput === null,
    regular_output_price: regularOutput,
    regular_output_missing: regularOutput === null,
    regular_cached_input_price: regularCached,
    regular_cached_input_missing: regularCached === null,
    billing_conditions: billing,
    withhold,
  };
  return { observation, rejection: null };
}

function samePublic(left: Observation, right: Observation): boolean {
  return canonicalJson(toPublicQuote({ ...left, withhold: null, source_url: left.source_url ?? 'https://example.invalid/', verified_at: left.verified_at ?? '1970-01-01T00:00:00.000Z' }))
    === canonicalJson(toPublicQuote({ ...right, withhold: null, source_url: right.source_url ?? 'https://example.invalid/', verified_at: right.verified_at ?? '1970-01-01T00:00:00.000Z' }));
}


/** Collapse clock-adjusted observations with the same identity; conflicting values are rejected. */
export function finalizeObservedQuotes(
  observations: Observation[],
  rejections: Rejection[] = [],
): { kept: Observation[]; rejections: Rejection[]; duplicatesCollapsed: number; excludedCounts: Record<string, number> } {
  const counts = new Map<string, number>();
  const nextRejections = [...rejections];
  for (const item of nextRejections) bump(counts, item.reason);
  const groups = new Map<string, Observation[]>();
  for (const observation of observations) {
    const key = fullKey(observation);
    const group = groups.get(key) ?? [];
    group.push(observation);
    groups.set(key, group);
  }
  const kept: Observation[] = [];
  let duplicatesCollapsed = 0;
  for (const group of groups.values()) {
    const identical = group.every((item) => samePublic(item, group[0]));
    if (!identical) {
      bump(counts, 'ambiguous_duplicate');
      nextRejections.push({ reason: 'ambiguous_duplicate', model_slug: group[0].model_slug, provider_slug: group[0].provider_slug });
      continue;
    }
    if (group.length > 1) duplicatesCollapsed += group.length - 1;
    kept.push(group[0]);
  }
  for (const observation of kept) {
    if (observation.withhold) bump(counts, observation.withhold);
  }
  return {
    kept: kept.sort((left, right) => fullKey(left).localeCompare(fullKey(right))),
    rejections: nextRejections,
    duplicatesCollapsed,
    excludedCounts: sortedCounts(counts),
  };
}

export function prepareQuotes(rows: RawChannelQuote[], options: PrepareOptions = {}): PreparedQuotes {
  const asOf = options.asOf ?? new Date();
  const generatedAt = options.generatedAt ?? new Date();
  const maxAgeDays = options.maxAgeDays ?? DEFAULT_MAX_AGE_DAYS;
  const rejections: Rejection[] = [];
  const observations: Observation[] = [];

  for (const row of rows) {
    const normalized = normalizeChannelQuote(row, { ...options, asOf, maxAgeDays });
    if (normalized.rejection) {
      rejections.push(normalized.rejection);
      continue;
    }
    if (normalized.observation) observations.push(normalized.observation);
  }

  const finalized = finalizeObservedQuotes(observations, rejections);
  const kept = finalized.kept;
  const countsFromFinalize = finalized.excludedCounts;

  const publishable = kept
    .map(toPublicQuote)
    .filter((quote): quote is PublicQuote => quote !== null)
    .sort((left, right) => fullKey(left).localeCompare(fullKey(right)));
  const fixture = options.allowFixture === true;
  const snapshot: CitableSnapshot = {
    schema: CITABLE_SCHEMA,
    snapshot_id: snapshotDigest(publishable),
    generated_at: generatedAt.toISOString(),
    as_of: asOf.toISOString(),
    max_age_days: maxAgeDays,
    prior_snapshots_retained: false,
    history: 'current_sample_only',
    sample_kind: fixture ? 'synthetic_fixture' : 'live_official_public_quotes',
    coverage: {
      wording_en: COVERAGE_WORDING.en,
      wording_zh: COVERAGE_WORDING.zh,
      included: publishable.length,
      excluded_counts: countsFromFinalize,
      excluded_counts_in_snapshot_id: false,
    },
    not_market_data: fixture,
    empty_export_reason: fixture ? null : 'redistribution_scope_unpublished',
    redistribution: {
      status: fixture ? 'synthetic_fixture' : 'unpublished',
      granted_license: null,
      cc0: false,
      mit: false,
      statement_en: REDISTRIBUTION.en,
      statement_zh: REDISTRIBUTION.zh,
    },
    quotes: publishable,
  };

  return {
    fixture,
    as_of: snapshot.as_of,
    generated_at: snapshot.generated_at,
    max_age_days: maxAgeDays,
    observations: kept.sort((left, right) => fullKey(left).localeCompare(fullKey(right))),
    rejections: finalized.rejections,
    publishable,
    excluded_counts: snapshot.coverage.excluded_counts,
    duplicates_collapsed: finalized.duplicatesCollapsed,
    snapshot,
  };
}

function csvCell(value: string): string {
  const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

export function snapshotToCsv(snapshot: CitableSnapshot): string {
  const metadata: Record<string, unknown> = {
    snapshot_id: snapshot.snapshot_id, as_of: snapshot.as_of, sample_kind: snapshot.sample_kind,
    not_market_data: snapshot.not_market_data, empty_export_reason: snapshot.empty_export_reason,
    redistribution_status: snapshot.redistribution.status, granted_license: null, cc0: false, mit: false,
    redistribution_en: snapshot.redistribution.statement_en, redistribution_zh: snapshot.redistribution.statement_zh,
    coverage_en: snapshot.coverage.wording_en, coverage_zh: snapshot.coverage.wording_zh,
  };
  const lines = Object.entries(metadata).map(([key, value]) => `# ${key},${csvCell(value === null ? 'null' : String(value))}`);
  lines.push(PUBLIC_QUOTE_FIELDS.join(','));
  for (const quote of snapshot.quotes) {
    lines.push(PUBLIC_QUOTE_FIELDS.map((field) => {
      const value = quote[field];
      if (value === null) return '';
      return csvCell(String(value));
    }).join(','));
  }
  return `\uFEFF${lines.join('\n')}\n`;
}

export function citableRequestPlan(url: URL):
  | { kind: 'history_missing' }
  | { kind: 'bad_query' }
  | { kind: 'bad_format' }
  | { kind: 'ok'; format: 'json' | 'csv' } {
  for (const key of url.searchParams.keys()) {
    if (HISTORY_QUERY_PARAMS.has(key)) return { kind: 'history_missing' };
  }
  for (const key of url.searchParams.keys()) {
    if (key !== 'format') return { kind: 'bad_query' };
  }
  const format = url.searchParams.get('format');
  if (format === null || format === 'json') return { kind: 'ok', format: 'json' };
  if (format === 'csv') return { kind: 'ok', format: 'csv' };
  return { kind: 'bad_format' };
}
