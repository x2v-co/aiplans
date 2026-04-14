/**
 * Minimax China Plan Scraper — platform.minimaxi.com Token Plan page.
 *
 * Rewritten 2026-04-14: the old parser targeted a Lite/Pro/Team/Enterprise
 * layout that no longer matches MiniMax's pricing page. The new page presents
 * two product lines (标准版 + 极速版), each with three tiers (Starter/Plus/
 * Max or Plus/Max/Ultra), priced in monthly + annual columns.
 *
 * This parser extracts the 3 monthly + 3 annual prices from each line by
 * positional regex anchored on the unique tier-group markers, validates
 * each extracted number is in a sane range, and emits 6 ScrapedPlan rows
 * matching the slugs in the DB (minimax-standard-starter, etc.).
 *
 * Slugs intentionally match the fix-plans-audit.ts NEW_PLANS list so
 * upsertPlan updates the existing rows (source='manual' is preserved).
 */
import type { ScrapedPlan, PlanScraperResult } from '../utils/plan-validator';
import { fetchHTMLSmart } from './base-fetcher';

// MiniMax renamed the page from /pricing-coding-plan to /pricing-token-plan
// sometime before 2026-04. The old URL 404s.
const MINIMAX_CHINA_PLANS_URL = 'https://platform.minimaxi.com/docs/guides/pricing-token-plan';
const MINIMAX_CHINA_INVITE_LINK = 'https://platform.minimaxi.com/subscribe/coding-plan?code=GOCSHm96x2&source=link';

interface TierRef {
  slug: string;
  name: string;
  tier: 'free' | 'basic' | 'pro' | 'team' | 'enterprise';
}

const STANDARD_TIERS: TierRef[] = [
  { slug: 'minimax-standard-starter', name: 'MiniMax 标准版 Starter', tier: 'basic' },
  { slug: 'minimax-standard-plus',    name: 'MiniMax 标准版 Plus',    tier: 'pro' },
  { slug: 'minimax-standard-max',     name: 'MiniMax 标准版 Max',     tier: 'team' },
];

const HIGHSPEED_TIERS: TierRef[] = [
  { slug: 'minimax-highspeed-plus',   name: 'MiniMax 极速版 Plus',    tier: 'pro' },
  { slug: 'minimax-highspeed-max',    name: 'MiniMax 极速版 Max',     tier: 'team' },
  { slug: 'minimax-highspeed-ultra',  name: 'MiniMax 极速版 Ultra',   tier: 'enterprise' },
];

// Extract unique prices (in order of first appearance) matching ¥NN /<unit>
// from the raw HTML. Parsing raw HTML (not stripped text) is critical because
// MiniMax's Next.js page stores the annual-tab prices only in React hydration
// JSON embedded in <script> tags — stripping scripts wipes them out.
function extractUniquePrices(html: string, priceUnit: '月' | '年', min: number, max: number): number[] {
  const re = new RegExp(`¥\\s*(\\d{1,5})\\s*\\/${priceUnit}`, 'g');
  const seen = new Set<number>();
  const ordered: number[] = [];
  for (const m of html.matchAll(re)) {
    const v = parseInt(m[1], 10);
    if (v < min || v > max) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    ordered.push(v);
  }
  return ordered;
}

// Extract [standard, highspeed] price triples using positional logic:
// page renders 6 unique tiers in DOM order — 3 standard followed by 3
// high-speed (both for monthly and annual). We just take first 6 unique.
function extractTriples(
  html: string,
  priceUnit: '月' | '年',
  min: number,
  max: number,
): { standard: [number, number, number] | null; highspeed: [number, number, number] | null } {
  const unique = extractUniquePrices(html, priceUnit, min, max);
  if (unique.length < 6) return { standard: null, highspeed: null };
  return {
    standard: [unique[0], unique[1], unique[2]],
    highspeed: [unique[3], unique[4], unique[5]],
  };
}

async function scrapeMinimaxPlans(): Promise<PlanScraperResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const plans: ScrapedPlan[] = [];

  try {
    console.log('🔄 Fetching Minimax China subscription plans...');
    const result = await fetchHTMLSmart(MINIMAX_CHINA_PLANS_URL, { waitForTimeout: 3000 });
    if (!result.success || !result.data) {
      return {
        source: 'Minimax-Plans',
        success: false,
        plans: [],
        errors: [`Failed to fetch MiniMax plans page: ${result.error ?? 'no HTML returned'}`],
      };
    }
    console.log(`📦 fetched ${result.data.length} bytes, parsing raw HTML...`);

    // Parse raw HTML — MiniMax ships annual prices only in React hydration
    // JSON inside <script> tags, so we cannot strip them.
    const monthly = extractTriples(result.data, '月', 10, 2000);
    const annual  = extractTriples(result.data, '年', 100, 20000);

    const stdMonthly = monthly.standard;
    const stdAnnual  = annual.standard;

    if (!stdMonthly) errors.push('standard-tier monthly prices not found on Minimax page');
    if (!stdAnnual)  errors.push('standard-tier annual prices not found on Minimax page');

    if (stdMonthly && stdAnnual) {
      for (let i = 0; i < STANDARD_TIERS.length; i++) {
        const t = STANDARD_TIERS[i];
        plans.push({
          planName: t.name,
          planSlug: t.slug,
          priceMonthly: stdMonthly[i],
          priceYearly: stdAnnual[i],
          pricingModel: 'subscription',
          tier: t.tier,
          dailyMessageLimit: undefined,
          features: [],
          region: 'china',
          accessFromChina: true,
          paymentMethods: ['Alipay', 'WeChat Pay'],
          isOfficial: true,
          currency: 'CNY',
        });
      }
    }

    const hsMonthly = monthly.highspeed;
    const hsAnnual  = annual.highspeed;

    if (!hsMonthly) errors.push('highspeed-tier monthly prices not found on Minimax page');
    if (!hsAnnual)  errors.push('highspeed-tier annual prices not found on Minimax page');

    if (hsMonthly && hsAnnual) {
      for (let i = 0; i < HIGHSPEED_TIERS.length; i++) {
        const t = HIGHSPEED_TIERS[i];
        plans.push({
          planName: t.name,
          planSlug: t.slug,
          priceMonthly: hsMonthly[i],
          priceYearly: hsAnnual[i],
          pricingModel: 'subscription',
          tier: t.tier,
          dailyMessageLimit: undefined,
          features: [],
          region: 'china',
          accessFromChina: true,
          paymentMethods: ['Alipay', 'WeChat Pay'],
          isOfficial: true,
          currency: 'CNY',
        });
      }
    }

    console.log(`📦 Found ${plans.length} plans from Minimax China`);
    console.log(`🔗 Invite Link: ${MINIMAX_CHINA_INVITE_LINK}`);

    const duration = Date.now() - startTime;
    console.log(`✅ Minimax China plans scrape completed in ${duration}ms`);
    console.log(`   - Plans processed: ${plans.length}`);
    console.log(`   - Errors: ${errors.length}`);

    return {
      source: 'Minimax-Plans',
      success: errors.length === 0 && plans.length > 0,
      plans,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    console.error('❌ Minimax China plans scrape failed:', error);
    return {
      source: 'Minimax-Plans',
      success: false,
      plans: [],
      errors: [String(error)],
    };
  }
}

export { scrapeMinimaxPlans };

// CLI test
if (require.main === module) {
  scrapeMinimaxPlans().then(result => {
    console.log('\n📊 Scrape Result:');
    console.log(JSON.stringify(result, null, 2));
  });
}
