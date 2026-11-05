/**
 * x2v first-party estimate of the X Subscription Ultra weekly pool, valued at API list price.
 * Estimate only (not an official figure, not a bill). Plus/Premium/Super are intentionally not
 * converted: the official tier multiples have not been independently verified by x2v.
 */
export const X_ULTRA_QUOTA_DATE = '2026-11-05';
export const X_ULTRA_QUOTA_SOURCE = 'https://docs.x.ai/x-subscription/usage-limits';

export function xUltraQuotaCopy(locale: string) {
  const zh = locale === 'zh';
  return {
    heading: zh ? 'x2v 实测：X Subscription Ultra 周额度约值多少（估算）' : 'x2v measurement: what the X Subscription Ultra weekly pool is worth (estimate)',
    verifiedAt: zh ? '测量日期' : 'Measured',
    headline: zh
      ? 'x2v 实测约 $1,500/周（Ultra），误差约 ±25%，按 API 标价折算。这是估算，不是官方数字。'
      : 'x2v measured roughly $1,500/week (Ultra), about ±25%, valued at API list price. This is an estimate, not an official figure.',
    notes: zh ? [
      '方法：2026-11-04 至 11-05 用 Cursor CLI 调用 grok-4.7-medium 共 58 次，按 Cursor 公布标价（输入 $2/M、缓存读 $0.5/M、输出 $6/M）自算成本约 $5.4，对照周额度百分比的变化拟合，得 1% ≈ $15（约 $12.6–19.2）。',
      '周额度由 Grok、Grok Bot 与 Cursor 共享，Grok Bot 没有单独额度。',
      '真实值可能偏高：成本按标价自算而非账单，超时或中断的调用未计入；用量面板只显示到 0.1%。',
      'Plus、Premium、Super 不给折算值：官方倍率尚未经 x2v 核实。',
    ] : [
      'Method: 58 Cursor CLI calls to grok-4.7-medium on 2026-11-04 to 11-05. Cost was self-computed at Cursor’s published list price (input $2/M, cache read $0.5/M, output $6/M), about $5.4, and fitted against changes in the weekly usage percentage: 1% ≈ $15 (about $12.6–19.2).',
      'The weekly pool is shared by Grok, Grok Bot and Cursor; Grok Bot has no separate allowance.',
      'The true value may be higher: cost is computed from list prices rather than a bill, timed-out or interrupted calls are not counted, and the usage meter only shows 0.1% steps.',
      'No value is given for Plus, Premium or Super: x2v has not verified the official tier multiples.',
    ],
    source: zh ? 'xAI 官方每周用量说明' : 'xAI weekly usage limits',
  };
}
