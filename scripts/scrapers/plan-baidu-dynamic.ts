/**
 * Baidu ERNIE Plan Scraper — DISABLED 2026-04-14.
 *
 * Why disabled:
 * - Baidu announced on 2025-02-13 that ALL ERNIE consumer subscription plans
 *   would become free effective 2025-04-01. The product that this scraper
 *   used to track (ernie-monthly / ernie-annual / ernie-pro / ernie-team)
 *   no longer exists.
 * - The previous scrape target `console.bce.baidu.com/qianfan/resource/
 *   subscribe` requires authentication — Playwright gets the login page,
 *   not pricing content.
 * - "百度千帆代码助手" / qianfan-coding-plan is actually Alibaba's 阿里云
 *   百炼 Coding Plan misattributed to Baidu in the legacy schema. That
 *   product's Lite tier was discontinued on 2026-04-13.
 *
 * Kept in DB as source='manual' with one `ernie-free` placeholder for the
 * now-free consumer product. Remove the scraper entirely if/when the
 * index-plans-dynamic.ts runner is cleaned up.
 */
import type { PlanScraperResult } from '../utils/plan-validator';

export async function scrapeBaiduPlans(): Promise<PlanScraperResult> {
  console.log('🔄 Baidu ERNIE plan scraper disabled — product went fully free 2025-04-01.');
  return {
    source: 'Baidu-Plans',
    success: true,
    plans: [],
  };
}

if (require.main === module) {
  scrapeBaiduPlans().then(r => console.log(JSON.stringify(r, null, 2)));
}
