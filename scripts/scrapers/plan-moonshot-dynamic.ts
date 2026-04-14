/**
 * Moonshot (Kimi) Plan Scraper — DISABLED 2026-04-14.
 *
 * Why disabled:
 * - Moonshot rebranded its developer platform from platform.moonshot.cn to
 *   platform.kimi.com. The old pricing URL 404s.
 * - The new platform.kimi.com/docs/pricing/chat-v1 URL is API per-token
 *   pricing, not subscription plans. Kimi+ subscription tiers live on a
 *   different (auth-walled) member center page that's not publicly
 *   scrapable.
 * - All 5 Kimi+ subscription tiers (kimi-free, kimi-basic, kimi-pro,
 *   kimi-team, kimi-enterprise) are already curated as source='manual' in
 *   the DB. They refresh via fix-plans-audit.ts when needed.
 *
 * This stub returns an empty-but-successful result so the scraper runner
 * doesn't log a failure and so the log-only cleanupOutdatedPlans doesn't
 * warn about Kimi+ plans going stale every run.
 */
import type { PlanScraperResult } from '../utils/plan-validator';

export async function scrapeMoonshotPlans(): Promise<PlanScraperResult> {
  console.log('🔄 Moonshot Kimi plan scraper disabled — plans tracked as source=manual.');
  return {
    source: 'Moonshot-Plans',
    success: true,
    plans: [],
  };
}

if (require.main === module) {
  scrapeMoonshotPlans().then(r => console.log(JSON.stringify(r, null, 2)));
}
