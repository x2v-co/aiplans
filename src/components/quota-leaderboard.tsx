'use client';
import { useState } from 'react';
import { feeMultiple, leaderboardOrdersMatch, QUOTA_LEADER_ROWS, rankLeaderboard, WEEKS_PER_MONTH, type LeaderDirection, type LeaderMix, type LeaderRow, type LeaderSort, type LeaderWindow } from '@/lib/quota-leaderboard';

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const times = (n: number) => `${n >= 10 ? Math.round(n) : n.toFixed(1)}×`;

const T = {
  zh: {
    windows: { '5h': '5 小时', week: '周', month: '月' } as Record<LeaderWindow, string>,
    mixes: { output: '输出为主', agentic: 'Agent', input: '输入为主', mixed: '混合' } as Record<LeaderMix, string>,
    mixTitle: { output: '输出为主', agentic: 'Agent · 缓存读为主', input: '普通输入为主', mixed: '混合配比，未按输入输出拆开' } as Record<LeaderMix, string>,
    sortBy: '排序', byMultiple: '月费倍数', byUsd: '绝对金额',
    directionLabel: '方向', highToLow: '从高到低', lowToHigh: '从低到高',
    windowLabel: '额度窗口', sortedBy: '全表名次按', sameOrder: '两种指标名次相同。',
    rankedCount: (n: number) => `共 ${n} 名`,
    leader: (plan: string) => `第 1 名 ${plan}`,
    unranked: '不参与当前名次',
    cols: { rank: '名次', plan: '套餐', mix: '负载', model: '模型', multiple: '月费倍数', usd: 'API 折合金额', date: '日期', confidence: '置信度' },
    rough: '粗估', weeklyProjection: '粗估 · 周×4.35', unverified: '档位未核验', low: '低', none: '本窗口暂无实测',
    noMultiple5h: '5 小时窗口不按月费折算倍数，只比绝对金额。',
    noMultiple: '—',
    details: '方法',
    volcengine: '火山方舟 Pro：¥200/月，按固定展示汇率 ¥6.90/$ 折合约 $29/月；kimi-k3 按 Kimi 国际 API 标准价（输入 $3/M、输出 $15/M）估值。三个窗口分别实测，月窗口为粗估；区间仅含读数舍入误差，非账单或余额。',
    valuation: '火山估值口径与来源',
    basis: `口径：月费倍数 = 该窗口 API 折合金额 ÷ 该窗口对应费用。月榜按月费；周榜按「月费 ÷ ${WEEKS_PER_MONTH}」（一年 52.14 周 ÷ 12 个月）。月榜中 X Ultra、Codex Pro 200、Claude Pro 都只有周额度实测，月额度 = 周额度 × ${WEEKS_PER_MONTH} 推算，标「粗估」，未实测月度重置；因此这些套餐的月费倍数 = 周费倍数。全表按所选指标和方向排成一张名次，默认从高到低；负载配比只作标签。没有月费倍数的行不进入倍数名次，也不编造倍数。旧套餐 Cursor Ultra 按三池分列，月费 $200，榜上倍数只算池①。① Cursor Models：约 $3,022/月，composer-2.5 条件估算、样本未完成，标粗估；倍数 = 该池 ÷ $200。② Other Models：Cursor 论坛工作人员曾写 Ultra 内含 $400（按 API 标价），是 Pro $20 的 20×，即月费的 2×（https://forum.cursor.com/t/usage-limits-in-teams-vs-individual/167937 、https://forum.cursor.com/t/how-much-usage-is-available-on-the-200-subscription/163309）。当前文档 https://cursor.com/docs/account/pricing/legacy-cursor-plans 只列两池、未写美元数；论坛有人说曾降到约 $100。官方曾公开 ≈ $400（=月费×2），以账号仪表盘为准。此 $400 不是实测折合，不另算倍数。③ Grok Bot：老板确认旧 Ultra 有独立池。公开 legacy 页写 Grok/X 不在旧套餐；X Subscription 的共享周池才含 Grok Bot（新 Ultra 约 $1,500/周，不是同一池）。切换前估算约 10 亿 token/周（区间 6–18 亿），未折美元，不计倍数。来源 projects/aiplans/research/2026-10-19-grokbot-old-ultra-baseline.md（2026-10-20 定稿）。公开文档对 Grok Bot 与 legacy Ultra 的对应仍不完整。`,
    disclaimer: '有条件实测 · 非官方额度 · 样本少；金额按公开 API 标价折算，不是账单或余额。同一窗口按所选指标排成一张名次表。',
  },
  en: {
    windows: { '5h': '5 hours', week: 'Week', month: 'Month' } as Record<LeaderWindow, string>,
    mixes: { output: 'Output-heavy', agentic: 'Agentic', input: 'Input-heavy', mixed: 'Mixed' } as Record<LeaderMix, string>,
    mixTitle: { output: 'Output-heavy', agentic: 'Agentic · cache-read heavy', input: 'Fresh-input heavy', mixed: 'Mixed workload, not split' } as Record<LeaderMix, string>,
    sortBy: 'Sort by', byMultiple: 'Fee multiple', byUsd: 'Absolute value',
    directionLabel: 'Direction', highToLow: 'High to low', lowToHigh: 'Low to high',
    windowLabel: 'Quota window', sortedBy: 'Ranked by ', sameOrder: 'Both metrics give the same ranks.',
    rankedCount: (n: number) => `${n} ranked`,
    leader: (plan: string) => `#1 ${plan}`,
    unranked: 'Not ranked on this metric',
    cols: { rank: 'Rank', plan: 'Plan', mix: 'Workload', model: 'Model', multiple: 'Fee multiple', usd: 'API value', date: 'Date', confidence: 'Confidence' },
    rough: 'rough', weeklyProjection: 'rough · week×4.35', unverified: 'tier unverified', low: 'low', none: 'No measurement for this window yet',
    noMultiple5h: 'Five-hour windows are not converted to a fee multiple; compare absolute value only.',
    noMultiple: '—',
    details: 'Method',
    volcengine: 'Volcengine Pro: CNY 200/month, about $29/month at the fixed display assumption of CNY 6.90/USD; kimi-k3 valued at Kimi international standard API prices ($3/M input, $15/M output). All three windows measured separately; month is rough. Bounds cover meter rounding only; not a bill or balance.',
    valuation: 'Volcengine valuation and sources',
    basis: `Basis: fee multiple = API value for the window ÷ the fee for that window. Monthly board uses the monthly fee; weekly board uses monthly fee ÷ ${WEEKS_PER_MONTH} (52.14 weeks ÷ 12 months). X Ultra, Codex Pro 200 and Claude Pro are measured weekly only; their monthly value = weekly × ${WEEKS_PER_MONTH}, marked "rough" (no monthly reset was measured), so those monthly multiples equal the weekly multiples. One list for the selected metric and direction, high to low by default; workload mix is only a label. Rows with no fee multiple stay out of the multiple ranking, and no multiple is invented. Legacy Cursor Ultra is kept as three pools, with a $200 monthly fee. The leaderboard multiple uses pool 1 only. (1) Cursor Models: about $3,022/month, composer-2.5, a conditional rough estimate with an incomplete sample; multiple = that pool ÷ $200. (2) Other Models: a Cursor forum staff post listed Ultra at $400 of included usage at API price, 20× Pro’s $20, which is 2× the $200 fee (https://forum.cursor.com/t/usage-limits-in-teams-vs-individual/167937 and https://forum.cursor.com/t/how-much-usage-is-available-on-the-200-subscription/163309). The current doc https://cursor.com/docs/account/pricing/legacy-cursor-plans lists two pools and no dollar amounts; forum reports say it later fell to about $100. The published figure remains about $400 (2× the fee); check the account dashboard. That $400 is not a measured API value and gets no extra multiple. (3) Grok Bot: the owner confirms a separate legacy Ultra pool. The public legacy page says Grok/X are not included; The X Subscription’s shared weekly pool is what includes Grok Bot (new Ultra about $1,500/week, a different pool). Before the switch the estimate was about 1 billion tokens/week (range 600 million–1.8 billion), not converted to USD and with no fee multiple. Source: projects/aiplans/research/2026-10-19-grokbot-old-ultra-baseline.md (finalized 2026-10-20). Public docs still do not fully map Grok Bot onto legacy Ultra.`,
    disclaimer: 'Conditional measurement · not an official allowance · small sample. Values use public API list prices, not bills or credits. Each window is one list ranked by the selected metric.',
  },
};

function RankMark({ n }: { n: number }) {
  const top = n <= 3;
  return <span className={top
    ? 'inline-flex min-w-8 items-center justify-center rounded-md bg-zinc-900 px-1.5 py-0.5 text-sm font-bold tabular-nums text-white dark:bg-zinc-100 dark:text-zinc-900'
    : 'inline-flex min-w-8 items-center justify-center text-sm font-semibold tabular-nums text-zinc-500'}>#{n}</span>;
}

export function QuotaLeaderboard({ locale, rows = QUOTA_LEADER_ROWS }: { locale: string; rows?: readonly LeaderRow[] }) {
  const zh = locale === 'zh';
  const t = zh ? T.zh : T.en;
  const [window, setWindow] = useState<LeaderWindow>('month');
  const [sort, setSort] = useState<LeaderSort>('multiple');
  const [direction, setDirection] = useState<LeaderDirection>('desc');
  const effectiveSort: LeaderSort = window === '5h' ? 'usd' : sort;
  const arrow = direction === 'desc' ? '↓' : '↑';
  const btn = (active: boolean) => `rounded-md border px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-40 ${active ? 'border-zinc-900 bg-zinc-900 font-semibold text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900' : 'border-zinc-300 dark:border-zinc-700'}`;
  const { ranked, unverified } = rankLeaderboard(window, effectiveSort, rows, direction);
  const sameOrder = leaderboardOrdersMatch(window, rows);
  const columns = [
    { key: 'rank', label: t.cols.rank },
    { key: 'plan', label: t.cols.plan },
    { key: 'mix', label: t.cols.mix },
    { key: 'model', label: t.cols.model },
    { key: 'multiple', label: t.cols.multiple, sort: 'multiple' as const },
    { key: 'usd', label: t.cols.usd, sort: 'usd' as const },
    { key: 'date', label: t.cols.date },
    { key: 'confidence', label: t.cols.confidence },
  ];
  const metricCell = (metric: LeaderSort) => effectiveSort === metric ? 'p-2 text-lg font-bold tabular-nums' : 'p-2 tabular-nums text-zinc-600 dark:text-zinc-400';
  const renderRow = (r: LeaderRow, rank: number | null) => {
    const multiple = feeMultiple(r);
    return <tr key={r.id} className="border-t align-top" data-row={r.id} data-rank={rank ?? undefined} data-mix={r.mix} data-unranked={rank === null ? 'true' : undefined}>
      <td className="p-2">{rank === null ? <span className="text-zinc-400">{t.noMultiple}</span> : <RankMark n={rank} />}</td>
      <td className="p-2">{r.plan}
        {r.rough && <span className="ml-1 whitespace-nowrap rounded bg-amber-100 px-1 text-[11px] text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">{r.derivedFromWeek ? t.weeklyProjection : t.rough}</span>}
        {!r.tierVerified && <span className="ml-1 whitespace-nowrap rounded bg-amber-100 px-1 text-[11px] text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">{t.unverified}</span>}
      </td>
      <td className="p-2"><span title={t.mixTitle[r.mix]} className="whitespace-nowrap rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">{t.mixes[r.mix]}</span></td>
      <td className="p-2 text-xs">{r.model}</td>
      <td className={`${metricCell('multiple')} whitespace-nowrap`}>{multiple ? <>{times(multiple.mid)}<span className="block text-[11px] font-normal text-zinc-500">{times(multiple.low)}–{times(multiple.high)}</span></> : t.noMultiple}</td>
      <td className={`${metricCell('usd')} whitespace-nowrap`}>≈ {usd.format(r.usd.mid)}<span className="block text-[11px] font-normal text-zinc-500">{usd.format(r.usd.low)}–{usd.format(r.usd.high)}</span></td>
      <td className="whitespace-nowrap p-2"><time dateTime={r.date}>{r.date}</time></td>
      <td className="whitespace-nowrap p-2">{t.low} · <a className="underline" href={r.anchor.startsWith('/') ? `/${locale}${r.anchor}` : r.anchor}>{t.details}</a></td>
    </tr>;
  };
  return <section className="space-y-4 rounded-lg border p-4" aria-label={zh ? '额度排行' : 'Quota leaderboard'} data-testid="quota-leaderboard" data-sort={effectiveSort} data-direction={direction}>
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex gap-2" role="group" aria-label={t.windowLabel}>
        {(['5h', 'week', 'month'] as const).map(w => <button key={w} type="button" aria-pressed={window === w} className={btn(window === w)} onClick={() => setWindow(w)}>{t.windows[w]}</button>)}
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t.sortBy}>
          <span className="text-xs text-zinc-500">{t.sortBy}</span>
          <button type="button" className={btn(effectiveSort === 'multiple')} aria-pressed={effectiveSort === 'multiple'} onClick={() => setSort('multiple')} disabled={window === '5h'}>{t.byMultiple}</button>
          <button type="button" className={btn(effectiveSort === 'usd')} aria-pressed={effectiveSort === 'usd'} onClick={() => setSort('usd')}>{t.byUsd}</button>
        </div>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t.directionLabel}>
          <button type="button" className={btn(direction === 'desc')} aria-pressed={direction === 'desc'} onClick={() => setDirection('desc')}>{t.highToLow}</button>
          <button type="button" className={btn(direction === 'asc')} aria-pressed={direction === 'asc'} onClick={() => setDirection('asc')}>{t.lowToHigh}</button>
        </div>
      </div>
    </div>
    <p role="status" aria-live="polite" className="text-sm" data-testid="quota-sort-status">
      {t.sortedBy}<strong>{effectiveSort === 'multiple' ? t.byMultiple : t.byUsd} {arrow}</strong>
      <span> · {t.rankedCount(ranked.length)}</span>
      {ranked[0] && <span data-testid="quota-leader"> · {t.leader(ranked[0].plan)}</span>}
      {sameOrder && <span className="ml-2 text-zinc-500" data-testid="quota-same-order">{t.sameOrder}</span>}
    </p>
    {window === '5h' && <p className="text-xs text-zinc-500">{t.noMultiple5h}</p>}
    {ranked.length === 0 && unverified.length === 0 && <p className="text-sm text-zinc-500">{t.none}</p>}
    {(ranked.length > 0 || unverified.length > 0) && <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm">
      <thead><tr className="text-xs text-zinc-500">{columns.map(column => <th key={column.key} scope="col" aria-sort={column.sort && column.sort === effectiveSort ? (direction === 'desc' ? 'descending' : 'ascending') : undefined} className="whitespace-nowrap p-2 font-normal">{column.label}{column.sort === effectiveSort ? ` ${arrow}` : ''}</th>)}</tr></thead>
      <tbody>{ranked.map((row, index) => renderRow(row, index + 1))}</tbody>
      {unverified.length > 0 && <tbody data-testid="quota-unranked">
        <tr><td colSpan={columns.length} className="border-t bg-zinc-50 p-2 text-xs font-medium text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">{t.unranked}</td></tr>
        {unverified.map(row => renderRow(row, null))}
      </tbody>}
    </table></div>}
    <p className="text-xs text-zinc-500">{t.basis}</p>
    <p className="text-xs text-zinc-500">{t.volcengine} <a className="underline" href="/reports/volcengine-api-valuation-2026-11-05.md">{t.valuation}</a></p>
    <p className="text-xs font-medium text-amber-800 dark:text-amber-300">{t.disclaimer}</p>
  </section>;
}
