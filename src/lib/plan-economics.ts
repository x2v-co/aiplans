/**
 * What a subscription plan costs per unit of the usage it actually meters.
 *
 * The tempting version of this module converts everything to $/1M tokens so
 * plans line up against API rate cards. We do not do that, because of what the
 * data says: of 54 plans, exactly one publishes a token figure (a one-off
 * 1M-token trial grant), while the rest meter credits, requests or messages.
 * Turning "10,000 credits/week" into tokens needs a credits-per-token rate no
 * vendor publishes, so every such number would be invented. Instead each plan
 * is priced in its own published unit — $/1,000 credits, $/1,000 requests —
 * which is a figure the reader can verify against the vendor's page.
 *
 * Three states must reach the UI distinctly, and conflating any two of them
 * undoes the research behind them:
 *
 *   quotas IS NULL  → nobody has looked (vendor page is auth-walled)
 *   quotas = []     → researched; the vendor publishes no allowance at all
 *   quotas = [...]  → verifiable figures
 *
 * "No rate available" is therefore never a single blank cell. `planEconomics`
 * returns which of the three it is, and the caller renders each differently.
 */
import type { CurrencyCode } from './currency';
import { convertToUSD } from './currency-conversion';

export type QuotaUnit = 'token' | 'credit' | 'request' | 'message' | 'prompt' | 'relative';
export type QuotaPeriod = '5h' | 'day' | 'week' | 'month' | 'total';

/** One row of `plans.quotas`, as written by scripts/fix-plan-quotas.ts. */
export type Quota = {
  amount?: number;
  unit: QuotaUnit;
  period?: QuotaPeriod;
  /** Slug of the tier this figure was computed from, when the vendor published
   *  a multiple instead of an absolute. */
  derived_from?: string;
  multiplier?: number;
  note?: string;
};

/** Every unit except `relative` carries an absolute amount. */
export type AbsoluteUnit = Exclude<QuotaUnit, 'relative'>;

/** Only the plan fields that bear on economics. */
export type EconomicPlan = {
  slug: string;
  price: number | null;
  currency: string | null;
  price_unit: string | null;
  is_contact_sales: boolean | null;
  /** Non-null only for one-off packs; a `total` quota is unusable without it. */
  pack_validity_days: number | null;
  /** null, [], or the figures. The three states drive the whole module. */
  quotas: Quota[] | null;
};

const DAYS_PER_MONTH = 30;

/** Days each window covers, for normalizing to a common 30-day basis. */
const PERIOD_DAYS: Record<Exclude<QuotaPeriod, 'total'>, number> = {
  '5h': 5 / 24,
  day: 1,
  week: 7,
  month: DAYS_PER_MONTH,
};

/**
 * How many units a rate is quoted per. Tokens go per-million to match rate
 * cards; the rest go per-thousand, which keeps GLM's 10,000 credits/week at a
 * readable $1.18 rather than $0.00118.
 */
const RATE_PER: Record<AbsoluteUnit, number> = {
  token: 1_000_000,
  credit: 1_000,
  request: 1_000,
  message: 1_000,
  prompt: 1_000,
};

/**
 * Which unit to price a plan in when it meters several. Tokens first because
 * they are the only unit comparable to an API rate card; `prompt` last because
 * vendors use it loosely.
 */
const UNIT_PRIORITY: AbsoluteUnit[] = ['token', 'credit', 'request', 'message', 'prompt'];

function isAbsolute(q: Quota): q is Quota & { amount: number; unit: AbsoluteUnit } {
  return q.unit !== 'relative' && typeof q.amount === 'number' && q.amount > 0;
}

/** Price normalized to a 30-day window, in USD. */
function monthlyPriceUSD(plan: EconomicPlan): number | null {
  if (plan.price == null || plan.price <= 0) return null;
  const usd = convertToUSD(plan.price, (plan.currency ?? 'USD') as CurrencyCode);
  if (plan.price_unit === 'per_year') return (usd / 365) * DAYS_PER_MONTH;
  if (plan.price_unit === 'per_pack' && plan.pack_validity_days && plan.pack_validity_days > 0) {
    return (usd / plan.pack_validity_days) * DAYS_PER_MONTH;
  }
  return usd;
}

/**
 * A quota's allowance over a 30-day window, or null when the window is unknown.
 *
 * A `total` quota is a one-off grant, not a recurring allowance. Spreading it
 * over 30 days is only legitimate when the vendor states a validity to spread
 * it across — Aliyun's 1M free tokens expire in 90 days whether used or not, so
 * reading them as monthly would overstate them threefold.
 */
function amountPer30Days(q: Quota & { amount: number }, plan: EconomicPlan): number | null {
  if (q.period === 'total' || q.period == null) {
    const validity = plan.pack_validity_days;
    if (!validity || validity <= 0) return null;
    return (q.amount / validity) * DAYS_PER_MONTH;
  }
  return (q.amount / PERIOD_DAYS[q.period]) * DAYS_PER_MONTH;
}

export type EffectiveRate = {
  /** USD per `RATE_PER[unit]` units, over a 30-day window. */
  valueUSD: number;
  unit: AbsoluteUnit;
  /** 1_000 or 1_000_000 — what `valueUSD` is quoted per. */
  per: number;
  /** Allowance over 30 days, after normalizing the vendor's window. */
  unitsPer30Days: number;
  /** The vendor's own figure, so the UI can cite it verbatim. */
  basis: { amount: number; unit: AbsoluteUnit; period: QuotaPeriod };
  /** True when the amount is arithmetic on a published multiple (GLM Pro's
   *  60,000 is "6x Lite" applied to Lite's stated 10,000) rather than a figure
   *  the vendor printed. Sound, but the UI should say so. */
  isDerived: boolean;
  /** The vendor's caveat, when the metered quota is narrower than the plan.
   *  Le Chat's 150/day covers Flash answers only, so a bare $/1,000 messages
   *  would misdescribe the plan. Render this wherever the rate is rendered. */
  caveat?: string;
};

/** A vendor-published "Nx the usage of <other tier>" claim. */
export type UsageRatio = {
  multiplier: number;
  /** Slug the multiple is quoted against. */
  baselineSlug: string;
  /** How much more the plan costs than its baseline; null if either price is
   *  missing, or if the baseline is free (dividing by zero says nothing). */
  priceMultiple: number | null;
  /** usage multiple ÷ price multiple. Above 1 means more usage per dollar than
   *  the baseline. Null whenever `priceMultiple` is. */
  valuePerDollar: number | null;
  note?: string;
};

export type PlanEconomics =
  /** quotas IS NULL — not researched. Say so; do not imply "unlimited". */
  | { state: 'unresearched' }
  /** quotas = [] — page read, vendor publishes no allowance. */
  | { state: 'none_published' }
  /** Price is hidden behind a sales conversation, so no rate exists. */
  | { state: 'contact_sales' }
  /** Free tier: a rate of zero is arithmetically true and tells the reader
   *  nothing, so report the allowance without a price per unit. */
  | { state: 'free'; allowances: EffectiveRate['basis'][] }
  /** At least one figure, but nothing divisible into a rate — a one-off grant
   *  with no validity, or only relative claims with no priced baseline. */
  | { state: 'not_derivable'; ratios: UsageRatio[]; allowances: EffectiveRate['basis'][] }
  /** A verifiable rate. `ratios` may also be present (Le Chat publishes both). */
  | { state: 'rate'; rate: EffectiveRate; ratios: UsageRatio[] };

/**
 * Picks the quota that actually binds usage, within one unit.
 *
 * Vendors stack windows: Aliyun Bailian Coding Pro publishes 6,000 requests/5h
 * AND 45,000/week AND 90,000/month. These are nested ceilings, not an additive
 * budget — over 30 days the 5-hour cap allows 1,080,000 requests, the weekly cap
 * 192,857, and the monthly cap 90,000. Only the smallest can actually be spent,
 * so summing them overstates the allowance twelvefold and picking the first one
 * listed is a coin flip. The minimum is the honest denominator.
 */
function bindingQuota(
  quotas: (Quota & { amount: number; unit: AbsoluteUnit })[],
  plan: EconomicPlan,
): { quota: Quota & { amount: number; unit: AbsoluteUnit }; per30Days: number } | null {
  let best: { quota: (typeof quotas)[number]; per30Days: number } | null = null;
  for (const quota of quotas) {
    const per30Days = amountPer30Days(quota, plan);
    if (per30Days == null) continue;
    if (!best || per30Days < best.per30Days) best = { quota, per30Days };
  }
  return best;
}

/**
 * Resolves the vendor's relative claims into value-per-dollar comparisons.
 * `lookup` supplies sibling plans by slug; without the baseline's price a
 * multiple stays a bare multiple, which is still worth showing.
 */
function resolveRatios(
  plan: EconomicPlan,
  quotas: Quota[],
  lookup?: (slug: string) => EconomicPlan | undefined,
): UsageRatio[] {
  const ratios: UsageRatio[] = [];
  for (const q of quotas) {
    if (q.unit !== 'relative' || !q.multiplier || !q.derived_from) continue;

    const own = monthlyPriceUSD(plan);
    const baseline = lookup?.(q.derived_from);
    const basePrice = baseline ? monthlyPriceUSD(baseline) : null;

    // A free baseline makes the price multiple infinite, not large: Le Chat Pro
    // is "6x free" and free costs nothing, so there is no ratio to state.
    const priceMultiple = own != null && basePrice != null && basePrice > 0 ? own / basePrice : null;

    ratios.push({
      multiplier: q.multiplier,
      baselineSlug: q.derived_from,
      priceMultiple,
      valuePerDollar: priceMultiple != null ? q.multiplier / priceMultiple : null,
      note: q.note,
    });
  }
  return ratios;
}

/**
 * The one entry point. `lookup` is optional and only affects `ratios`; pass a
 * map over the same provider's plans to turn "20x Pro" into a value comparison.
 */
export function planEconomics(
  plan: EconomicPlan,
  lookup?: (slug: string) => EconomicPlan | undefined,
): PlanEconomics {
  if (plan.quotas == null) return { state: 'unresearched' };
  if (plan.quotas.length === 0) return { state: 'none_published' };

  const absolutes = plan.quotas.filter(isAbsolute);
  const allowances = absolutes
    .filter((q) => q.period != null)
    .map((q) => ({ amount: q.amount, unit: q.unit, period: q.period as QuotaPeriod }));
  const ratios = resolveRatios(plan, plan.quotas, lookup);

  // Checked before price: an enterprise tier can publish real allowances while
  // keeping its price behind a sales call, and the allowances are still worth
  // showing even though no rate can be computed.
  if (plan.is_contact_sales) return { state: 'contact_sales' };

  const price = monthlyPriceUSD(plan);
  if (price == null) return { state: 'free', allowances };

  for (const unit of UNIT_PRIORITY) {
    const sameUnit = absolutes.filter((q) => q.unit === unit);
    if (sameUnit.length === 0) continue;
    const binding = bindingQuota(sameUnit, plan);
    if (!binding) continue;

    const per = RATE_PER[unit];
    return {
      state: 'rate',
      rate: {
        valueUSD: price / (binding.per30Days / per),
        unit,
        per,
        unitsPer30Days: binding.per30Days,
        basis: {
          amount: binding.quota.amount,
          unit,
          period: binding.quota.period ?? 'total',
        },
        isDerived: binding.quota.derived_from != null,
        caveat: binding.quota.note,
      },
      ratios,
    };
  }

  return { state: 'not_derivable', ratios, allowances };
}

/**
 * Compares two plans that meter the same unit — the cross-region case this was
 * built for: GLM Coding Lite is ¥118/month in China and $18/month on z.ai for
 * an identical 10,000 credits/week.
 *
 * Returns null when the units differ, because $/1,000 credits and $/1,000
 * requests are not the same quantity and ranking them together is meaningless.
 */
export function compareRates(
  a: EffectiveRate,
  b: EffectiveRate,
): { cheaper: 'a' | 'b' | 'equal'; savingsPercent: number } | null {
  if (a.unit !== b.unit) return null;
  if (a.valueUSD <= 0 || b.valueUSD <= 0) return null;
  const [lo, hi] = a.valueUSD <= b.valueUSD ? [a.valueUSD, b.valueUSD] : [b.valueUSD, a.valueUSD];
  return {
    cheaper: a.valueUSD === b.valueUSD ? 'equal' : a.valueUSD < b.valueUSD ? 'a' : 'b',
    savingsPercent: ((hi - lo) / hi) * 100,
  };
}

/**
 * Compares a plan's rate against an API rate card. Only defined for token
 * quotas: credits and requests have no published token equivalence, so a
 * "cheaper than the API" claim built on them would be an invention.
 */
export function comparedToApiRate(
  rate: EffectiveRate,
  apiPricePer1mUSD: number | null,
): { savingsPercent: number } | null {
  if (rate.unit !== 'token') return null;
  if (apiPricePer1mUSD == null || apiPricePer1mUSD <= 0) return null;
  return { savingsPercent: ((apiPricePer1mUSD - rate.valueUSD) / apiPricePer1mUSD) * 100 };
}

const UNIT_LABEL: Record<AbsoluteUnit, { en: string; zh: string }> = {
  token: { en: 'tokens', zh: 'tokens' },
  credit: { en: 'credits', zh: '积分' },
  request: { en: 'requests', zh: '次请求' },
  message: { en: 'messages', zh: '条消息' },
  prompt: { en: 'prompts', zh: '次提问' },
};

const PERIOD_LABEL: Record<QuotaPeriod, { en: string; zh: string }> = {
  '5h': { en: 'per 5 hours', zh: '每 5 小时' },
  day: { en: 'per day', zh: '每天' },
  week: { en: 'per week', zh: '每周' },
  month: { en: 'per month', zh: '每月' },
  total: { en: 'one-off', zh: '一次性' },
};

/**
 * Formats a rate, keeping enough significant figures to stay useful below a
 * cent since these routinely land at $0.0043.
 *
 * Deliberately NOT exported. A bare rate string is the one thing a caller must
 * never be able to render on its own: Le Chat Pro's $3.62 per 1,000 messages
 * counts only Flash answers, so the number without its caveat misdescribes the
 * plan. `describeEconomics` is the only way out of this module, and it returns
 * the rate and its caveat in the same object.
 */
function formatRate(rate: EffectiveRate, locale: string): string {
  const digits = rate.valueUSD < 0.01 ? 4 : rate.valueUSD < 1 ? 3 : 2;
  const amount = rate.valueUSD.toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  const per = rate.per === 1_000_000 ? '1M' : '1K';
  const unit = UNIT_LABEL[rate.unit][locale === 'zh' ? 'zh' : 'en'];
  return locale === 'zh'
    ? `$${amount} / ${per} ${unit}·月`
    : `$${amount} / ${per} ${unit} per month`;
}

function formatAllowance(basis: EffectiveRate['basis'], locale: string): string {
  const zh = locale === 'zh';
  const unit = UNIT_LABEL[basis.unit][zh ? 'zh' : 'en'];
  const period = PERIOD_LABEL[basis.period][zh ? 'zh' : 'en'];
  const amount = basis.amount.toLocaleString(zh ? 'zh-CN' : 'en-US');
  return zh ? `${amount} ${unit}／${period}` : `${amount} ${unit} ${period}`;
}

function formatRatio(r: UsageRatio, locale: string): string {
  const zh = locale === 'zh';
  const head = zh
    ? `${r.multiplier}× ${r.baselineSlug} 的用量`
    : `${r.multiplier}x the usage of ${r.baselineSlug}`;
  if (r.valuePerDollar == null) {
    // Almost always a free baseline: "6x free" cannot become a value ratio
    // because the baseline costs nothing. Say why rather than showing nothing.
    return zh
      ? `${head}（基准档免费，无法折算每美元价值）`
      : `${head} (baseline is free, so no value-per-dollar figure)`;
  }
  const value = r.valuePerDollar.toFixed(2);
  const price = r.priceMultiple?.toFixed(1) ?? '?';
  return zh
    ? `${head}，价格 ${price}×，每美元用量 ${value}×`
    : `${head}, at ${price}x the price — ${value}x usage per dollar`;
}

/**
 * Everything the UI is allowed to show about a plan's economics, as one value.
 *
 * The union mirrors `PlanEconomics` but carries display strings, and it is the
 * module's only rendering entry point. Crucially the `rate` variant holds
 * `caveat` alongside `rate`, so a component cannot destructure the number and
 * quietly drop the qualification — the two arrive together or not at all.
 */
export type EconomicsDisplay =
  /** Nothing to price. `tone` tells the UI how to style it: `missing` is a
   *  research gap on our side, `absent` is a fact about the vendor. */
  | { kind: 'note'; tone: 'missing' | 'absent'; text: string }
  /** A free tier: its allowance, with no rate (a $0.00 rate is uninformative). */
  | { kind: 'allowances'; label: string; items: string[] }
  /** Only relative claims — no absolute allowance to divide a price by. */
  | { kind: 'ratios'; label: string; items: string[] }
  | {
      kind: 'rate';
      rate: string;
      /** The vendor's own figure, e.g. "10,000 credits per week". */
      basis: string;
      /** Present when the metered quota is narrower than the plan. Render it. */
      caveat?: string;
      /** Present when the amount is arithmetic on a published multiple. */
      derived?: string;
      ratios: string[];
    };

export function describeEconomics(e: PlanEconomics, locale: string = 'en'): EconomicsDisplay {
  const zh = locale === 'zh';

  switch (e.state) {
    case 'unresearched':
      return {
        kind: 'note',
        tone: 'missing',
        text: zh ? '额度待采集' : 'Allowance not yet collected',
      };
    case 'none_published':
      return {
        kind: 'note',
        tone: 'absent',
        text: zh ? '厂商未公布用量额度' : 'Vendor publishes no usage allowance',
      };
    case 'contact_sales':
      return {
        kind: 'note',
        tone: 'absent',
        text: zh ? '价格需联系销售，无法折算单价' : 'Price on request — no unit rate',
      };
    case 'free':
      return {
        kind: 'allowances',
        label: zh ? '免费额度' : 'Free allowance',
        items: e.allowances.map((a) => formatAllowance(a, locale)),
      };
    case 'not_derivable':
      return {
        kind: 'ratios',
        label: zh ? '厂商只公布相对倍率' : 'Vendor publishes only a relative multiple',
        items: [
          ...e.ratios.map((r) => formatRatio(r, locale)),
          ...e.allowances.map((a) => formatAllowance(a, locale)),
        ],
      };
    case 'rate':
      return {
        kind: 'rate',
        rate: formatRate(e.rate, locale),
        basis: formatAllowance(e.rate.basis, locale),
        caveat: e.rate.caveat,
        derived: e.rate.isDerived
          ? zh
            ? '由厂商公布的倍率推算'
            : 'computed from a published multiple'
          : undefined,
        ratios: e.ratios.map((r) => formatRatio(r, locale)),
      };
  }
}

