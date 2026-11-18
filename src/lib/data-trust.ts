import { introductoryEndDate, isIntroductoryPriceActive, promoTimeZone, promoTimeZoneLabel, type PriceSchedule } from './effective-price';

/**
 * Exact locale paths from the frozen 2026-11-18 detail-page PV sample:
 * SG 2026-10-21..11-17, 311 PV, cutoff 15 vs 14 (no cutoff tie).
 * This sample adds labeling coverage without removing the PR379 review pages.
 * It does not certify any source fact or establish an acceptance window.
 * TOP_TRUST_PAGES/isTrustPage describe only the sample; display helpers retain
 * the legacy bilingual pages as well. Sample membership always includes locale.
 * Staleness uses the same 30-day window as the read-only price/plan audit.
 * Nothing here writes the database.
 */
export const TRUST_STALE_DAYS = 30;
export const USAGE_ESTIMATE_REVIEWED_ON = '2026-10-18';

export type TrustPageKind = 'model' | 'provider' | 'compare-plan';

export type TrustPage = {
  rank: number;
  kind: TrustPageKind;
  slug: string;
  path: string;
};

export const TOP_TRUST_PAGES: readonly TrustPage[] = [
  { rank: 1, kind: 'compare-plan', slug: 'deepseek-v4-pro', path: '/zh/compare/plans/deepseek-v4-pro' },
  { rank: 2, kind: 'provider', slug: 'openai', path: '/zh/providers/openai' },
  { rank: 3, kind: 'compare-plan', slug: 'gemini-4-argon', path: '/zh/compare/plans/gemini-4-argon' },
  { rank: 4, kind: 'provider', slug: 'moonshot-china', path: '/zh/providers/moonshot-china' },
  { rank: 5, kind: 'provider', slug: 'google', path: '/zh/providers/google' },
  { rank: 6, kind: 'provider', slug: 'minimax-china', path: '/zh/providers/minimax-china' },
  { rank: 7, kind: 'compare-plan', slug: 'deepseek-v4.1-flash', path: '/zh/compare/plans/deepseek-v4.1-flash' },
  { rank: 8, kind: 'provider', slug: 'deepseek', path: '/zh/providers/deepseek' },
  { rank: 9, kind: 'model', slug: 'deepseek-v4.1-flash', path: '/zh/models/deepseek-v4.1-flash' },
  { rank: 10, kind: 'compare-plan', slug: 'kimi-k3', path: '/zh/compare/plans/kimi-k3' },
];

/** PR379 display coverage, selected for review using homepage entries, not PV. */
export const LEGACY_TRUST_PAGES: readonly Pick<TrustPage, 'kind' | 'slug'>[] = [
  { kind: 'model', slug: 'anthropic-claude-fable-5-1' },
  { kind: 'model', slug: 'anthropic-claude-opus-5-5' },
  { kind: 'model', slug: 'anthropic-claude-sonnet-5-5' },
  { kind: 'model', slug: 'openai-gpt-6-astra' },
  { kind: 'model', slug: 'openai-gpt-6-1-sol' },
  { kind: 'model', slug: 'openai-gpt-6-sol' },
  { kind: 'provider', slug: 'openai' },
  { kind: 'provider', slug: 'anthropic' },
  { kind: 'provider', slug: 'google' },
  { kind: 'provider', slug: 'zhipu-china' },
];

const REVIEWED_API_SOURCES: Record<string, { zh: string; en: string; url: string }> = {
  openai: { zh: 'OpenAI API 定价', en: 'OpenAI API pricing', url: 'https://developers.openai.com/api/docs/pricing' },
  anthropic: { zh: 'Claude API 定价', en: 'Claude API pricing', url: 'https://platform.claude.com/docs/en/about-claude/pricing' },
  google: { zh: 'Gemini API 定价', en: 'Gemini API pricing', url: 'https://ai.google.dev/gemini-api/docs/pricing' },
  'zhipu-china': { zh: '智谱定价页', en: 'Zhipu pricing', url: 'https://bigmodel.cn/pricing' },
};

/**
 * 2026-10-18 source check notes. They do not overwrite the stored price and do
 * not count as a confirmed entitlement. Once a later verified list price lands
 * (`price` finite and `last_verified` strictly after `reviewedOn`), the rule
 * expires and the card follows assessTrust. Keeps Google AI Plus/Pro from
 * staying "待核验" after catalog-2026-11-04 / 11-05-intel seeds.
 * Claude Team Standard / Premium notes were removed on 2026-10-20: the stored
 * rows match https://claude.com/pricing, rechecked 2026-10-20.
 */
const PRICE_REVIEW_NOTES: Array<{
  providerSlug: string;
  name: RegExp;
  withheld: boolean;
  reviewedOn: string;
  zh: string;
  en: string;
}> = [
  {
    providerSlug: 'google',
    name: /ai plus/i,
    withheld: true,
    reviewedOn: '2026-10-18',
    zh: '2026-10-18 官方订阅页公开 HTML 写 Google AI Plus 为 $4.99/月。该数字尚未写入本站价格，不能当成已确认标价',
    en: 'On 2026-10-18 the public Gemini subscriptions HTML listed Google AI Plus at $4.99/month. That figure is not stored here and is not a confirmed list price',
  },
  {
    providerSlug: 'google',
    name: /ai pro(?!.*ultra)/i,
    withheld: true,
    reviewedOn: '2026-10-18',
    zh: '2026-10-18 官方订阅页公开 HTML 中，$19.99/月与约 4 倍免费档用量相邻，对应 Plus 之上的 Pro 档。本站该档仍是价格未知',
    en: 'On 2026-10-18 the public Gemini subscriptions HTML listed $19.99/month next to about 4x Free usage, the tier above Plus. This row is still an unknown price',
  },
];

export function priceReviewNote(
  providerSlug: string | null | undefined,
  planName: string | null | undefined,
  locale: string,
  plan?: { price?: number | null; last_verified?: Date | string | null },
): { withheld: boolean; note: string } | null {
  if (!providerSlug || !planName) return null;
  const hit = PRICE_REVIEW_NOTES.find((row) => row.providerSlug === providerSlug && row.name.test(planName));
  if (!hit) return null;
  const verified = verifiedInstant(plan?.last_verified);
  const reviewDay = Date.parse(`${hit.reviewedOn}T00:00:00Z`);
  const storedPrice = typeof plan?.price === 'number' && Number.isFinite(plan.price);
  if (storedPrice && verified != null && Number.isFinite(reviewDay) && verified > reviewDay) {
    return null;
  }
  return { withheld: hit.withheld, note: zh(locale) ? hit.zh : hit.en };
}

const REVIEWED_PLAN_SOURCES: Record<string, { zh: string; en: string; url: string }> = {
  openai: { zh: 'OpenAI ChatGPT 定价页', en: 'OpenAI ChatGPT pricing', url: 'https://openai.com/chatgpt/pricing/' },
  anthropic: { zh: 'Claude 官方定价页', en: 'Claude pricing', url: 'https://claude.com/pricing' },
  google: { zh: 'Gemini 订阅页', en: 'Gemini subscriptions', url: 'https://gemini.google/subscriptions/' },
  'zhipu-china': { zh: '智谱定价页', en: 'Zhipu pricing', url: 'https://bigmodel.cn/pricing' },
};

export type TrustFlags = {
  estimated: boolean;
  expired: boolean;
  stale: boolean;
  unverified: boolean;
};

export type TrustAssessment = {
  sourceLabel: string;
  sourceUrl: string | null;
  conditions: string[];
  verifiedOn: string | null;
  flags: TrustFlags;
};

export type TrustKind = 'list_price' | 'entitlement' | 'estimate';

type TrustSource = { label: string; url: string | null };

export function isTrustPage(locale: string, kind: TrustPageKind, slug: string): boolean {
  const family = kind === 'model' ? 'models' : kind === 'provider' ? 'providers' : 'compare/plans';
  return TOP_TRUST_PAGES.some(page => page.path === `/${locale}/${family}/${slug}`);
}

/** Display is the old 20 locale paths plus eight new exact sample paths. */
export function isTrustDisplayPage(locale: string, kind: TrustPageKind, slug: string): boolean {
  return isTrustPage(locale, kind, slug) || ((locale === 'zh' || locale === 'en')
    && LEGACY_TRUST_PAGES.some(page => page.kind === kind && page.slug === slug));
}

export function isTrustModelSlug(slug: string, locale: string): boolean {
  return isTrustDisplayPage(locale, 'model', slug);
}

export function isTrustProviderSlug(slug: string, locale: string): boolean {
  return isTrustDisplayPage(locale, 'provider', slug);
}

export function safeSourceUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.includes('\\') && !trimmed.includes(' ')) {
    return trimmed;
  }
  try {
    const url = new URL(trimmed);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function verifiedInstant(value: Date | string | null | undefined): number | null {
  if (value == null || value === '') return null;
  // JSON timestamps from timestamp-without-time-zone columns are UTC in this
  // catalog. Browsers otherwise interpret them in the reader's local zone.
  const normalized = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(value)
    ? `${value.replace(' ', 'T')}Z` : value;
  const time = new Date(normalized).getTime();
  return Number.isFinite(time) ? time : null;
}

export function utcDay(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

function dateOnly(value: string): string | null {
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function zh(locale: string): boolean {
  return locale === 'zh';
}

/** Sentences that describe a guess must not render as a confirmed entitlement. */
export function featureLooksEstimated(text: string): boolean {
  return /估算|估计|大约|约\s*\d|~\s*\d|\bapprox(?:imately)?\b|\bestimat(?:e|ed)\b|\broughly\b/i.test(text);
}

export function assessTrust(input: {
  locale: string;
  kind: TrustKind;
  sourceLabel: string;
  sourceUrl?: string | null;
  conditions?: Array<string | null | undefined | false>;
  verifiedAt?: Date | string | null;
  notes?: string | null;
  withheld?: boolean;
  promoEndsAt?: Date | string | null;
  promoStillShown?: boolean;
  legacyEndsOn?: string | null;
  superseded?: boolean;
  now?: Date;
}): TrustAssessment {
  const now = input.now ?? new Date();
  const sourceUrl = safeSourceUrl(input.sourceUrl);
  const sourceLabel = input.sourceLabel.trim() || (zh(input.locale) ? '来源未记录' : 'Source not recorded');
  const verified = verifiedInstant(input.verifiedAt);
  const needsVerification = input.withheld === true || (input.notes ?? '').startsWith('[needs-verification]');
  let expired = input.superseded === true;
  if (input.promoStillShown && input.promoEndsAt != null) {
    const cutoff = new Date(input.promoEndsAt).getTime();
    if (Number.isFinite(cutoff) && now.getTime() >= cutoff) expired = true;
  }
  const legacy = input.legacyEndsOn ? dateOnly(String(input.legacyEndsOn)) : null;
  if (legacy && utcDay(now.getTime()) > legacy) expired = true;
  const stale = verified != null && now.getTime() - verified > TRUST_STALE_DAYS * 24 * 60 * 60 * 1000;
  const conditions = (input.conditions ?? []).flatMap((item) => {
    if (typeof item !== 'string') return [];
    const text = item.trim();
    return text ? [text] : [];
  });
  return {
    sourceLabel,
    sourceUrl,
    conditions: conditions.length
      ? conditions
      : [zh(input.locale) ? '未记录额外适用条件' : 'No extra conditions recorded'],
    verifiedOn: verified == null ? null : utcDay(verified),
    flags: {
      estimated: input.kind === 'estimate',
      expired,
      stale,
      unverified: needsVerification || verified == null || sourceUrl == null,
    },
  };
}

function unitCondition(currency: string | null | undefined, unit: string | null | undefined, locale: string): string {
  const code = currency || 'USD';
  const labels: Record<string, { zh: string; en: string }> = {
    per_1m_tokens: { zh: '每百万 tokens', en: 'per 1M tokens' },
    per_1k_tokens: { zh: '每千 tokens', en: 'per 1K tokens' },
    per_month: { zh: '每月', en: 'per month' },
    per_year: { zh: '每年', en: 'per year' },
    per_request: { zh: '每次请求', en: 'per request' },
    per_pack: { zh: '每包', en: 'per pack' },
  };
  const key = unit || 'per_1m_tokens';
  const unitLabel = labels[key]?.[zh(locale) ? 'zh' : 'en'] ?? key.replaceAll('_', ' ');
  return zh(locale) ? `币种 ${code}，计价单位 ${unitLabel}` : `Currency ${code}, unit ${unitLabel}`;
}

export function constraintConditions(constraints: unknown, locale: string): string[] {
  if (!constraints || typeof constraints !== 'object' || Array.isArray(constraints)) return [];
  const labels: Record<string, { zh: string; en: string }> = {
    time_window: { zh: '时段', en: 'time window' },
    peak_schedule: { zh: '峰谷', en: 'peak schedule' },
    context: { zh: '上下文', en: 'context' },
    context_tokens: { zh: '上下文 token', en: 'context tokens' },
    speed: { zh: '速度档', en: 'speed' },
    status: { zh: '状态', en: 'status' },
    region: { zh: '地区', en: 'region' },
    batch: { zh: '批处理', en: 'batch' },
    platforms: { zh: '平台', en: 'platforms' },
  };
  return Object.entries(constraints as Record<string, unknown>).flatMap(([key, value]) => {
    if (value == null || value === '' || (typeof value === 'object' && !Array.isArray(value))) return [];
    const shown = Array.isArray(value) ? value.map(String).join(', ') : String(value);
    if (!shown.trim()) return [];
    const label = labels[key]?.[zh(locale) ? 'zh' : 'en'] ?? key.replaceAll('_', ' ');
    return [`${label}: ${shown}`];
  }).slice(0, 6);
}

type ProviderRef = {
  name?: string | null;
  slug?: string | null;
  type?: string | null;
  pricing_url?: string | null;
  api_docs_url?: string | null;
  website?: string | null;
};

type VariantRef = {
  source_url?: string | null;
  is_headline?: boolean | null;
  variant_name?: string | null;
  variant_kind?: string | null;
  currency?: string | null;
  price_unit?: string | null;
  constraints_json?: unknown;
  notes?: string | null;
  last_verified?: Date | string | null;
};

export type ChannelTrustRow = PriceSchedule & {
  currency?: string | null;
  price_unit?: string | null;
  last_verified?: Date | string | null;
  notes?: string | null;
  data_for_discount_note?: string | null;
  providers?: ProviderRef | null;
  price_variants?: VariantRef[] | null;
};

function reviewedCopy(table: Record<string, { zh: string; en: string; url: string }>, slug: string | null | undefined, locale: string): TrustSource | null {
  if (!slug || !table[slug]) return null;
  const row = table[slug];
  return { label: zh(locale) ? row.zh : row.en, url: row.url };
}

function channelSource(channel: ChannelTrustRow, locale: string): TrustSource {
  const provider = channel.providers ?? {};
  const official = provider.type === 'official' || provider.type === 'producer';
  const reviewed = official ? reviewedCopy(REVIEWED_API_SOURCES, provider.slug, locale) : null;
  const url = reviewed?.url
    || safeSourceUrl(provider.pricing_url);
  const label = reviewed?.label
    || (provider.name ? (zh(locale) ? `${provider.name} 定价页` : `${provider.name} pricing`) : '');
  return { label, url };
}

function finitePrice(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value);
}

export function channelListPriceTrust(channel: ChannelTrustRow, locale: string, now = new Date()): TrustAssessment {
  const source = channelSource(channel, locale);
  const promoActive = isIntroductoryPriceActive(channel, now);
  const cutoff = channel.promo_ends_at == null ? NaN : new Date(channel.promo_ends_at).getTime();
  const promoEnded = Number.isFinite(cutoff) && now.getTime() >= cutoff;
  const replaced = promoEnded && finitePrice(channel.regular_input_price_per_1m) && finitePrice(channel.regular_output_price_per_1m);
  const headline = (channel.price_variants ?? []).find((variant) => variant.is_headline);
  const note = typeof channel.notes === 'string' && !channel.notes.startsWith('[') ? channel.notes.trim().slice(0, 180) : '';
  const promoZone = promoTimeZone(channel as Parameters<typeof promoTimeZone>[0]);
  const endDate = () => introductoryEndDate(channel.promo_ends_at!, locale, promoZone);
  const conditions = [
    unitCondition(channel.currency, channel.price_unit, locale),
    promoActive ? (zh(locale)
      ? `限时优惠，截止 ${endDate()}（${promoTimeZoneLabel(promoZone, locale)}），其后按常规价`
      : `Limited-time offer through ${endDate()} (${promoTimeZoneLabel(promoZone, locale)}); regular price applies after that`)
      : null,
    replaced ? (zh(locale)
      ? `介绍价已于 ${endDate()} 结束，当前数字是常规价`
      : `Introductory price ended ${endDate()}; the figure shown is the regular price`)
      : null,
    promoEnded && !replaced ? (zh(locale)
      ? '介绍价已结束，且没有可替换的常规价，不要把该数字当成现行标价'
      : 'Introductory price has ended and no regular price is stored; do not treat this figure as the current list price')
      : null,
    channel.data_for_discount_note,
    ...constraintConditions(headline?.constraints_json, locale),
    note,
  ];
  return assessTrust({
    locale,
    kind: 'list_price',
    sourceLabel: source.label,
    sourceUrl: source.url,
    conditions,
    verifiedAt: channel.last_verified,
    notes: channel.notes,
    promoEndsAt: channel.promo_ends_at,
    promoStillShown: promoEnded && !replaced,
    now,
  });
}

export function variantPriceTrust(variant: VariantRef, channel: ChannelTrustRow, locale: string, now = new Date()): TrustAssessment {
  const channelLevel = channelSource(channel, locale);
  const url = safeSourceUrl(variant.source_url);
  const label = variant.source_url
    ? (zh(locale) ? `${variant.variant_name || '报价变体'} 来源` : `${variant.variant_name || 'Variant'} source`)
    : channelLevel.label;
  const note = typeof variant.notes === 'string' && !variant.notes.startsWith('[') ? variant.notes.trim().slice(0, 180) : '';
  return assessTrust({
    locale,
    kind: 'list_price',
    sourceLabel: label,
    sourceUrl: url,
    conditions: [
      variant.variant_name ? (zh(locale) ? `变体 ${variant.variant_name}` : `Variant ${variant.variant_name}`) : null,
      variant.variant_kind ? (zh(locale) ? `类型 ${variant.variant_kind}` : `Kind ${variant.variant_kind}`) : null,
      unitCondition(variant.currency || channel.currency, variant.price_unit || channel.price_unit, locale),
      ...constraintConditions(variant.constraints_json, locale),
      note,
    ],
    verifiedAt: variant.last_verified,
    notes: variant.notes,
    now,
  });
}

export function reviewedPlanSource(
  providerSlug: string | null | undefined,
  locale: string,
  fallback?: ProviderRef | null,
): TrustSource {
  const reviewed = reviewedCopy(REVIEWED_PLAN_SOURCES, providerSlug, locale);
  if (reviewed) return reviewed;
  const name = fallback?.name;
  return {
    label: name ? (zh(locale) ? `${name} 定价页` : `${name} pricing`) : '',
    url: safeSourceUrl(fallback?.pricing_url),
  };
}

export type PlanTrustRow = {
  name?: string | null;
  tier?: string | null;
  currency?: string | null;
  price_unit?: string | null;
  price?: number | null;
  last_verified?: Date | string | null;
  notes?: string | null;
  legacy_ends_on?: string | null;
  is_contact_sales?: boolean | null;
  monthly_api_credit_status?: string | null;
  data_for_discount_note?: string | null;
  quota_unit?: string | null;
  third_party_coverage_note?: string | null;
};

/** A reviewed plan may use a more specific official source than its provider. */
function planReviewSource(plan: PlanTrustRow, fallback: TrustSource, locale: string): TrustSource {
  const url = plan.notes?.match(/\[aiplans:review-source\] (https:\/\/[^\s]+)/)?.[1];
  if (!url) return fallback;
  try {
    if (!['openai.com', 'help.openai.com', 'chatgpt.com'].includes(new URL(url).hostname)) return fallback;
    return {url, label: zh(locale) ? 'OpenAI 官方套餐说明' : 'OpenAI official plan details'};
  } catch { return fallback; }
}

export function planPriceTrust(
  plan: PlanTrustRow,
  source: TrustSource,
  locale: string,
  now = new Date(),
  providerSlug?: string | null,
  options: { historicalOnly?: boolean } = {},
): TrustAssessment {
  source = planReviewSource(plan, source, locale);
  const review = priceReviewNote(providerSlug, plan.name, locale, plan);
  return assessTrust({
    locale,
    kind: 'list_price',
    sourceLabel: source.label,
    sourceUrl: source.url,
    verifiedAt: plan.last_verified,
    notes: plan.notes,
    withheld: options.historicalOnly || review?.withheld || plan.price === null || plan.is_contact_sales === true,
    legacyEndsOn: plan.legacy_ends_on,
    now,
    conditions: [
      unitCondition(plan.currency, plan.price_unit || 'per_month', locale),
      options.historicalOnly ? (zh(locale)
        ? '历史价格记录；所列日期不是本轮核价。本轮未逐字段确认当前金额、币种、税费、购买资格或来源是否仍适用；API 定价、首页、公告或失效链接不能确认订阅价格'
        : 'Historical price record; the date is not a check in this review. Current amount, currency, tax, eligibility and source applicability are unconfirmed; API pricing, homepages, announcements or dead links do not confirm subscription prices') : null,
      options.historicalOnly && plan.price === 0 ? (zh(locale)
        ? '原值 0 或「免费」不构成该档存在、正式发布或官方免费的确认；当前价格待核验'
        : 'A stored zero or Free display does not confirm this tier exists, is published or is officially free; current price needs verification') : null,
      plan.is_contact_sales ? (zh(locale)
        ? '需联系销售；标成 0 或空白的价格不是公开成交价'
        : 'Contact sales; a zero or blank price is not a public purchase price') : null,
      !options.historicalOnly && plan.price === 0 && !plan.is_contact_sales && plan.tier === 'free' ? (zh(locale) ? '免费档公开标价' : 'Published free tier') : null,
      plan.legacy_ends_on ? (zh(locale)
        ? `旧套餐，宽限期截止 ${plan.legacy_ends_on}`
        : `Legacy tier; grace period ends ${plan.legacy_ends_on}`) : null,
      review?.note,
    ],
  });
}

export function planEntitlementTrust(plan: PlanTrustRow, source: TrustSource, locale: string, now = new Date(), options: { explainMissingVerification?: boolean } = {}): TrustAssessment {
  source = planReviewSource(plan, source, locale);
  return assessTrust({
    locale,
    kind: 'entitlement',
    sourceLabel: source.label,
    sourceUrl: source.url,
    // last_verified is the plan price check, not a field-specific rights check.
    verifiedAt: null,
    withheld: true,
    notes: plan.notes,
    legacyEndsOn: plan.legacy_ends_on,
    now,
    conditions: [
      options.explainMissingVerification === false ? null : zh(locale)
        ? '仅供查阅的套餐来源；未记录权益专属核验时间，价格核验不能确认权益'
        : 'Plan reference only; entitlement-specific verification time is not recorded. A price check does not confirm rights',
      zh(locale)
        ? '功能列表、消息限额、上下文和速率来自同一套餐记录；带「估算」标记的句子不是厂商保证额度'
        : 'Features, message caps, context and rate limits come from the same plan row; lines marked Estimate are not guaranteed allowances',
      plan.quota_unit ? (zh(locale) ? `额度单位 ${plan.quota_unit}` : `Quota unit ${plan.quota_unit}`) : null,
      plan.data_for_discount_note,
      plan.third_party_coverage_note,
      plan.monthly_api_credit_status === 'needs-verification' ? (zh(locale)
        ? '每月 API 额度金额未核到具体数字，见单独的待核验说明'
        : 'Monthly API credit amount is not a verified figure; see the separate needs-verification note') : null,
    ],
  });
}

export function planCreditTrust(source: TrustSource, locale: string, now = new Date()): TrustAssessment {
  return assessTrust({
    locale,
    kind: 'entitlement',
    sourceLabel: source.label,
    sourceUrl: source.url,
    withheld: true,
    verifiedAt: null,
    now,
    conditions: [
      zh(locale) ? '来源页提到包含每月 API 额度，但金额没有核成确定数字' : 'The source says a monthly API credit is included, but the amount is not a confirmed figure',
    ],
  });
}

/** A recorded value without its own source/date must not borrow a price check. */
export function unknownFactTrust(locale: string, conditions: string, now = new Date(), sourceUrl?: string | null): TrustAssessment {
  return assessTrust({ locale, kind: 'entitlement', sourceLabel: zh(locale) ? '字段参考资料（未核验）' : 'Field reference (unverified)',
    sourceUrl, verifiedAt: null, withheld: true, now, conditions: [conditions,
      zh(locale) ? '未记录此字段的独立来源或核验时间；不继承价格核验' : 'No independent source or verification time recorded for this field; no inherited price verification'],
  });
}

/** Arithmetic has a method, not an official verification date. Inputs retain their own labels. */
export function calculatedTrust(locale: string, conditions: string, now = new Date()): TrustAssessment {
  return assessTrust({ locale, kind: 'estimate', sourceLabel: zh(locale) ? '本站计算方法（非官方权益）' : 'Site calculation (not official rights)',
    sourceUrl: `/${locale === 'zh' ? 'zh' : 'en'}/methodology`, verifiedAt: null, now,
    conditions: [conditions, zh(locale) ? '依赖所列原始值、汇率和假设；计算日期未记录，不代表当前官方价格或保证额度'
      : 'Depends on displayed inputs, exchange rates and assumptions; calculation date not recorded. Not a current official price check or guaranteed allowance'],
  });
}

export function usagePriceTrust(row: { source_url?: string | null; last_verified?: string | null; currency?: string | null; unit?: string; price_kind?: string; constraints_json?: unknown }, locale: string, now = new Date()): TrustAssessment {
  return assessTrust({ locale, kind: 'list_price', sourceLabel: zh(locale) ? '本条用量报价来源' : 'This usage-rate source',
    sourceUrl: row.source_url, verifiedAt: row.last_verified, now,
    conditions: [unitCondition(row.currency, row.unit, locale), row.price_kind, ...constraintConditions(row.constraints_json, locale)],
  });
}

export function usageEstimateTrust(locale: string, now = new Date()): TrustAssessment {
  return assessTrust({
    locale,
    kind: 'estimate',
    sourceLabel: zh(locale) ? '本站用量假设（非厂商账单）' : 'Site usage assumption (not a vendor invoice)',
    sourceUrl: `/${locale === 'zh' ? 'zh' : 'en'}/methodology`,
    verifiedAt: USAGE_ESTIMATE_REVIEWED_ON,
    now,
    conditions: [
      zh(locale) ? '输入:输出 = 2:1，四档假设用量' : 'input:output = 2:1 across four assumed usage tiers',
      zh(locale) ? '渠道价先换算为美元再相加，不能当成账单' : 'Channel prices are converted to USD and summed; this is not an invoice',
      zh(locale) ? '日期仅为用量假设的方法复核日，不是各渠道当前价格核验日' : 'Date is the usage-method review date, not a current channel price check',
    ],
  });
}

export function quotaEstimateTrust(input: {
  verifiedAt: string;
  windowLabel: string;
  mix: string;
  servedModel: string | null;
  evidenceUrl: string | null;
  isCurrent: boolean;
}, locale: string, now = new Date()): TrustAssessment {
  return assessTrust({
    locale,
    kind: 'estimate',
    sourceLabel: input.evidenceUrl
      ? (zh(locale) ? '公开额度证据' : 'Public quota evidence')
      : (zh(locale) ? '本站额度估算方法' : 'Site quota estimate method'),
    sourceUrl: input.evidenceUrl || `/${locale === 'zh' ? 'zh' : 'en'}/methodology`,
    verifiedAt: input.verifiedAt,
    superseded: !input.isCurrent,
    withheld: !safeSourceUrl(input.evidenceUrl),
    now,
    conditions: [
      zh(locale) ? `额度周期 ${input.windowLabel}` : `Allowance window ${input.windowLabel}`,
      input.mix,
      input.servedModel ? (zh(locale) ? `按模型 ${input.servedModel} 的配比估算` : `Estimated for ${input.servedModel}`) : (zh(locale) ? '未指定承载模型' : 'Served model not recorded'),
      zh(locale) ? '区间取决于假设配比，不是厂商保证的 token 额度' : 'The range depends on the assumed mix and is not a vendor-guaranteed token allowance',
      zh(locale) ? '日期仅对应估算记录；证据缺失时方法链接不构成官方额度证据' : 'Date belongs only to the estimate record; a method link is not official quota evidence when evidence is absent',
    ],
  });
}
