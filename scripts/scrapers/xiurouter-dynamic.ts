/**
 * XiuRouter API scraper — https://router.xiu.ai
 *
 * Public, unauthenticated, new-api/one-api style pricing endpoint:
 *   GET https://router.xiu.ai/api/pricing
 *
 * Billing math (verified against the site's own pricing JS, assets/queries-*.js,
 * and cross-checked against every row's reference_price on 2026-09-10):
 *   input USD/1M  = model_ratio * 2 * group_ratio
 *   output        = input * completion_ratio
 *   cache read    = input * cache_ratio
 *
 * Self-service groups are the keys of `usable_group` ("benefit" Value/福利档
 * and "max" Managed/满血档). `enable_groups` can additionally list partner
 * groups (`*-partner`, `ccmax-蒸馏`) which are not publicly self-service and
 * have no `group_ratio` entry — they must never carry a published price.
 *
 * The channel headline is the max/Managed (满血档) rate whenever the model is
 * enabled there: full-speed unthrottled capacity is what buyers should plan
 * around, whereas the cheaper benefit/Value (福利档) tier is a capacity-
 * limited discount tier with no service-quality guarantee. Models not on max
 * fall back to the cheapest self-service group that is enabled. The Value
 * alternative and the row pricing_version are preserved in `notes`.
 * (`reference_price` is the upstream list price shown for comparison only —
 * it is a XiuRouter input, never a XiuRouter billed price.)
 *
 * NO FALLBACK DATA — fails loud when the endpoint shape changes.
 */

import type { ScrapedPrice, ScraperResult } from '../utils/validator';
import { validatePrice } from '../utils/validator';

const XIUROUTER_PRICING_API = 'https://router.xiu.ai/api/pricing';
const XIUROUTER_PRICING_PAGE = 'https://router.xiu.ai/en/pricing';

/** one-api convention: ratio 1 bills $2 per 1M input tokens */
const USD_PER_RATIO_UNIT = 2;

/**
 * Headline preference: max (full-speed quality tier) first, with the cheaper
 * tiers kept as fallback for models only listed there.
 */
const HEADLINE_GROUP_ORDER = ['max', 'default', 'benefit'];

/**
 * Display order for non-headline tiers in notes: cheapest first.
 */
const NOTE_GROUP_ORDER = ['benefit', 'default', 'max'];
const GROUP_LABELS: Record<string, string> = {
  benefit: 'benefit/Value',
  default: 'default/Standard',
  max: 'max/Managed',
};

/**
 * XiuRouter model_name → canonical planprice model slug. Only token-billed
 * LLM rows that already exist in the models table are mapped; the channel
 * pipeline cannot create products for an aggregator.
 *
 * Deliberately excluded (logged, not priced):
 * - gpt-image-1.5, gpt-image-2 — image generation, per-call product
 * - codex-auto-review — internal routing helper, vendor_id absent
 * - gpt-5.3-codex-spark — iFlyTek-hosted (vendor_id 7) Spark variant, not
 *   the canonical OpenAI gpt-5.3-codex and no matching model row
 * - claude-opus-4-5-20251101, claude-sonnet-4-5-20250929 — pinned-date
 *   snapshots billed at upstream list; the bare aliases below are the
 *   current pooled routes at XiuRouter's own price, so mapping both would
 *   collide on one slug with contradictory prices
 */
const MODEL_SLUGS: Record<string, string> = {
  'deepseek-v4-flash': 'deepseek-v4-flash',
  'deepseek-v4-pro': 'deepseek-v4-pro',
  'gpt-5.4': 'gpt-5.4',
  'gpt-5.5': 'gpt-5.5',
  'gpt-5.6-luna': 'gpt-5.6-luna',
  'gpt-5.6-terra': 'gpt-5.6-terra',
  'gpt-5.6-sol': 'gpt-5.6-sol',
  'gpt-6-astra': 'gpt-6-astra',
  'claude-sonnet-4-5': 'claude-sonnet-4.5',
  'claude-sonnet-4-6': 'claude-sonnet-4.6',
  'claude-sonnet-5': 'claude-sonnet-5',
  'claude-opus-4-5': 'claude-opus-4.5',
  'claude-opus-4-6': 'claude-opus-4.6',
  'claude-opus-4-7': 'claude-opus-4.7',
  'claude-opus-4-8': 'claude-opus-4.8',
  'claude-opus-5': 'claude-opus-5',
  'claude-haiku-4-5': 'claude-haiku-4-5',
  'claude-fable-5': 'claude-fable-5',
  'claude-fable-5-1': 'claude-fable-5.1',
  'gemini-3.1-pro-preview': 'gemini-3.1-pro',
  'gemini-3.5-flash': 'gemini-3.5-flash',
  'gemini-3.6-flash': 'gemini-3.6-flash',
  'gemini-flash-latest': 'gemini-flash',
  'grok-4.5': 'grok-4.5',
  'grok-4.6': 'grok-4.6',
};

/** Fail loud if a silent payload change shrinks the catalog below this. */
const MIN_PRICES = 20;

interface XiuRouterRow {
  model_name: string;
  vendor_id?: number;
  quota_type?: number; // 0 = token ratio, 1 = fixed per-call
  model_ratio?: number;
  completion_ratio?: number;
  cache_ratio?: number;
  create_cache_ratio?: number;
  enable_groups?: string[];
  supported_endpoint_types?: string[];
  pricing_version?: string;
  billing_mode?: string;
  billing_expr?: string;
}

interface XiuRouterPricing {
  success?: boolean;
  data?: XiuRouterRow[];
  group_ratio?: Record<string, number>;
  usable_group?: Record<string, string>;
  pricing_version?: string;
}

interface TierPrice {
  group: string;
  multiplier: number;
  input: number;
  output: number;
  cacheRead: number | null;
}

function round6(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

/** Compact money for notes: 5.750001 → "5.75", 0.00252 stays "0.0025". */
function money(value: number): string {
  return value.toFixed(4).replace(/\.?0+$/, '');
}

function selfServiceGroups(payload: XiuRouterPricing): string[] {
  const usable = payload.usable_group ? Object.keys(payload.usable_group) : [];
  return usable
    .filter(group => Number.isFinite(payload.group_ratio?.[group]))
    .sort((a, b) => {
      const rankA = NOTE_GROUP_ORDER.indexOf(a);
      const rankB = NOTE_GROUP_ORDER.indexOf(b);
      return (rankA === -1 ? Number.MAX_SAFE_INTEGER : rankA)
        - (rankB === -1 ? Number.MAX_SAFE_INTEGER : rankB)
        || a.localeCompare(b);
    });
}

/** Full-speed tier preferred; cheaper tiers only when the model lacks it. */
function pickHeadline(tiers: TierPrice[]): TierPrice {
  const ranked = [...tiers].sort((a, b) => {
    const rankA = HEADLINE_GROUP_ORDER.indexOf(a.group);
    const rankB = HEADLINE_GROUP_ORDER.indexOf(b.group);
    return (rankA === -1 ? Number.MAX_SAFE_INTEGER : rankA)
      - (rankB === -1 ? Number.MAX_SAFE_INTEGER : rankB);
  });
  return ranked[0];
}

function tierPrices(row: XiuRouterRow, group: string, multiplier: number): TierPrice | null {
  if (typeof row.model_ratio !== 'number' || !Number.isFinite(row.model_ratio) || row.model_ratio <= 0) {
    return null;
  }
  const input = row.model_ratio * USD_PER_RATIO_UNIT * multiplier;
  const completion = typeof row.completion_ratio === 'number' && Number.isFinite(row.completion_ratio)
    ? row.completion_ratio
    : 1;
  const output = input * completion;
  const cacheRead = typeof row.cache_ratio === 'number' && Number.isFinite(row.cache_ratio) && row.cache_ratio > 0
    ? input * row.cache_ratio
    : null;
  return {
    group,
    multiplier,
    input: round6(input),
    output: round6(output),
    cacheRead: cacheRead === null ? null : round6(cacheRead),
  };
}

/**
 * tiered_expr models double their rates past a context threshold
 * (e.g. gpt-5.6-terra/sol at 272k input tokens). Surface the boundary in
 * notes so the headline number is not mistaken for an all-context price.
 */
function longContextNote(row: XiuRouterRow): string | null {
  if (row.billing_mode !== 'tiered_expr' || typeof row.billing_expr !== 'string') return null;
  const match = row.billing_expr.match(/len\s*(?:<=|<)\s*(\d+)/);
  if (!match) return 'long-context tier has higher rates past the context threshold';
  const tokens = Number(match[1]);
  if (!Number.isFinite(tokens) || tokens <= 0) return null;
  return `standard tier applies to <=${(tokens / 1000).toLocaleString('en-US')}k input tokens, long-context tier roughly doubles rates`;
}

function buildNotes(row: XiuRouterRow, tiers: TierPrice[], headline: TierPrice, globalVersion?: string): string {
  const parts: string[] = [];
  parts.push(`XiuRouter ${GROUP_LABELS[headline.group] ?? headline.group} tier (group_ratio ${headline.multiplier})`);

  const others = tiers.filter(tier => tier.group !== headline.group);
  if (others.length > 0) {
    // tiers are cheapest-first, so any alternative to a max headline is cheaper
    const label = headline.group === 'max' ? 'cheaper self-service tier' : 'other self-service tier';
    const alt = others
      .map(tier => `${GROUP_LABELS[tier.group] ?? tier.group} $${money(tier.input)}/$${money(tier.output)} per 1M`)
      .join(', ');
    parts.push(`${label}: ${alt}`);
  }

  const tiered = longContextNote(row);
  if (tiered) parts.push(tiered);

  const version = (row.pricing_version || globalVersion || '').slice(0, 12);
  if (version) parts.push(`pricing_version ${version}`);
  parts.push(XIUROUTER_PRICING_PAGE);
  return parts.join('; ');
}

export async function scrapeXiuRouterDynamic(): Promise<ScraperResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const prices: ScrapedPrice[] = [];
  const skipped: string[] = [];

  try {
    console.log('🔄 Fetching XiuRouter pricing...');

    const response = await fetch(XIUROUTER_PRICING_API, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const payload = await response.json() as XiuRouterPricing;
    if (payload.success !== true || !Array.isArray(payload.data)) {
      throw new Error('pricing endpoint returned success=false or no data array');
    }

    const groups = selfServiceGroups(payload);
    if (groups.length === 0) {
      throw new Error('no self-service groups with group_ratio found (usable_group/group_ratio changed)');
    }

    console.log(`📦 Found ${payload.data.length} rows, self-service groups: ${groups.join(', ')}`);

    for (const row of payload.data) {
      try {
        const name = row.model_name;
        if (typeof name !== 'string' || name.length === 0) {
          errors.push('row missing model_name');
          continue;
        }

        // quota_type 1 = fixed price per call (image models etc.), not per-token LLM pricing
        if (row.quota_type === 1) {
          skipped.push(`${name}: per-call (quota_type=1)`);
          continue;
        }
        if (typeof row.vendor_id !== 'number' || (row.supported_endpoint_types ?? []).includes('image-generation')
            || name.startsWith('gpt-image')) {
          skipped.push(`${name}: non-LLM/image or internal model`);
          continue;
        }

        const slug = MODEL_SLUGS[name];
        if (!slug) {
          skipped.push(`${name}: no canonical model mapping`);
          continue;
        }

        const enabledGroups = groups.filter(group => (row.enable_groups ?? []).includes(group));
        if (enabledGroups.length === 0) {
          skipped.push(`${name}: not enabled for any self-service group`);
          continue;
        }

        const tiers = enabledGroups
          .map(group => tierPrices(row, group, payload.group_ratio![group]))
          .filter((tier): tier is TierPrice => tier !== null);
        if (tiers.length === 0) {
          errors.push(`could not compute any valid tier price for ${name}`);
          continue;
        }

        // headline = full-speed max tier where available, benefit fallback otherwise
        const headline = pickHeadline(tiers);
        if (!validatePrice(headline.input) || !validatePrice(headline.output)) {
          errors.push(`invalid headline price for ${name}: $${headline.input}/$${headline.output}`);
          continue;
        }
        if (headline.output < headline.input) {
          errors.push(`output < input for ${name}: $${headline.output} < $${headline.input}`);
          continue;
        }

        prices.push({
          modelName: slug,
          modelSlug: slug,
          inputPricePer1M: headline.input,
          outputPricePer1M: headline.output,
          cachedInputPricePer1M: headline.cacheRead ?? undefined,
          isAvailable: true,
          currency: 'USD',
          notes: buildNotes(row, tiers, headline, payload.pricing_version),
        });
      } catch (error) {
        errors.push(`Error processing ${row.model_name}: ${String(error)}`);
      }
    }

    if (skipped.length > 0) {
      console.log(`⏭  Skipped ${skipped.length} rows:`);
      for (const reason of skipped) console.log(`    - ${reason}`);
    }

    if (prices.length < MIN_PRICES) {
      errors.push(`only ${prices.length} mapped prices (minimum ${MIN_PRICES}) — catalog or mapping changed`);
    }

    const duration = Date.now() - startTime;
    console.log(`✅ XiuRouter scrape completed in ${duration}ms`);
    console.log(`   - Models priced: ${prices.length}`);
    console.log(`   - Rows skipped: ${skipped.length}`);
    console.log(`   - Errors: ${errors.length}`);

    return {
      source: 'XiuRouter',
      success: errors.length === 0 && prices.length > 0,
      prices,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    console.error('❌ XiuRouter scrape failed:', error);
    return {
      source: 'XiuRouter',
      success: false,
      prices: [],
      errors: [String(error)],
    };
  }
}

// CLI test
if (require.main === module) {
  scrapeXiuRouterDynamic().then(result => {
    console.log('\n📊 Scrape Result:');
    console.log(JSON.stringify({
      source: result.source,
      success: result.success,
      errors: result.errors,
      prices: result.prices,
    }, null, 2));
  });
}
