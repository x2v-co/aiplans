/**
 * Print the GA4 weekly closed-loop queries.
 *
 * Usage: npm run report:funnel
 * Paste each JSON body into the GA4 Query Explorer for the existing property.
 * Does not call Google and does not read the database.
 */
import { FUNNEL_CUSTOM_DIMENSIONS } from '../src/config/analytics-events';
import { buildFunnelWeeklyQueries } from '../src/lib/funnel-weekly-query';

const report = buildFunnelWeeklyQueries();

const sections: Array<[string, unknown]> = [
  ['阶段合计（用 totalUsers 算比率）', report.totals],
  ['按页面分组 × 来源', report.byPageAndTraffic],
  ['按页面分组 × 渠道', report.byChannel],
  ['回访间隔 × 是否曾出站', report.returns],
];

console.log(`周报区间（UTC，已结束的周一至周日）：${report.range.startDate} ~ ${report.range.endDate}`);
console.log(`事件：${report.eventNames.join('、')}`);
console.log('');
console.log('比率（同一区间的 totalUsers，不是严格先后漏斗）：');
console.log('- 比较率 = funnel_compare 用户 / funnel_landing 用户');
console.log('- 出站率 = funnel_outbound_click 用户 / funnel_compare 用户');
console.log('- 回访率 = funnel_return_visit 用户 / funnel_landing 用户');
console.log('- 出站后回访 = prior_outbound 为 yes 的回访用户');
console.log('');
console.log('自定义维度（GA4 管理 → 自定义定义 → 事件级，注册后才有拆分；不改数据库）：');
console.log(FUNNEL_CUSTOM_DIMENSIONS.join(', '));
console.log('');

for (const [title, body] of sections) {
  console.log(`## ${title}`);
  console.log(JSON.stringify(body, null, 2));
  console.log('');
}
