/**
 * Volcengine (字节跳动 Seed / 火山方舟) Plan Scraper — DISABLED 2026-04-14.
 *
 * Why disabled:
 * - The docs URL (www.volcengine.com/docs/82379/1925114) has quota
 *   descriptions but no prices — actual prices live in a separate activity
 *   page that renders them via an async JSON API call, so they're not
 *   present in the rendered HTML even with Playwright hydration.
 * - The activity page (www.volcengine.com/activity/codingplan) also ships
 *   without price numbers in any <script> JSON — the Vue component fetches
 *   them after mount, and tests showed 0 occurrences of `¥NN /月` in 7MB
 *   of rendered HTML.
 * - seed-lite (¥40/mo) and seed-pro (¥200/mo) are tracked as source='manual'
 *   via fix-plans-audit.ts with ground truth from the official 火山方舟
 *   Coding Plan activity page.
 *
 * To re-enable: either find and call the Volcengine JSON pricing API
 * directly, or switch to Playwright page.evaluate + waitForSelector on a
 * specific pricing element once rendered.
 */
import type { PlanScraperResult } from '../utils/plan-validator';

export async function scrapeVolcenginePlans(): Promise<PlanScraperResult> {
  console.log('🔄 Volcengine Seed plan scraper disabled — prices not in rendered HTML.');
  return {
    source: 'Volcengine-Plans',
    success: true,
    plans: [],
  };
}

if (require.main === module) {
  scrapeVolcenginePlans().then(r => console.log(JSON.stringify(r, null, 2)));
}
