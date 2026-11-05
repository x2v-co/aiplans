'use client';
import { useState } from 'react';
import { feeMultiple, leaderboard, LEADER_MIXES, WEEKS_PER_MONTH, type LeaderMix, type LeaderSort, type LeaderWindow } from '@/lib/quota-leaderboard';

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const x = (n: number) => `${n >= 10 ? Math.round(n) : n.toFixed(1)}×`;

const T = {
  zh: {
    windows: { '5h': '5 小时', week: '周', month: '月' } as Record<LeaderWindow, string>,
    mixes: { output: '输出为主', agentic: 'Agent · 缓存读为主', input: '普通输入为主', mixed: '混合配比（未拆分）' } as Record<LeaderMix, string>,
    sortBy: '排序', byMultiple: '月费倍数', byUsd: '绝对金额',
    cols: ['套餐', '模型', '月费倍数', 'API 折合金额', '窗口', '日期', '置信度'],
    rough: '粗估 · 周×4.35', unverified: '档位未核验', low: '低', none: '本窗口暂无实测',
    noMultiple5h: '5 小时窗口不按月费折算倍数，只比绝对金额。',
    noMultiple: '—',
    details: '方法',
    basis: `口径：月费倍数 = 该窗口 API 折合金额 ÷ 该窗口对应费用。月榜按月费；周榜按「月费 ÷ ${WEEKS_PER_MONTH}」（一年 52.14 周 ÷ 12 个月）。月榜中 X Ultra、Codex Pro 200、Claude Pro 都只有周额度实测，月额度 = 周额度 × ${WEEKS_PER_MONTH} 推算，标「粗估」，未实测月度重置；因此月费倍数 = 周费倍数。档位未核验的套餐不算倍数。`,
    disclaimer: '有条件实测 · 非官方额度 · 样本少；金额按公开 API 标价折算，不是账单或余额。不同负载配比分开排名，不混排。',
  },
  en: {
    windows: { '5h': '5 hours', week: 'Week', month: 'Month' } as Record<LeaderWindow, string>,
    mixes: { output: 'Output-heavy', agentic: 'Agentic · cache-read heavy', input: 'Fresh-input heavy', mixed: 'Mixed (not split)' } as Record<LeaderMix, string>,
    sortBy: 'Sort by', byMultiple: 'Fee multiple', byUsd: 'Absolute value',
    cols: ['Plan', 'Model', 'Fee multiple', 'API value', 'Window', 'Date', 'Confidence'],
    rough: 'rough · week×4.35', unverified: 'tier unverified', low: 'low', none: 'No measurement for this window yet',
    noMultiple5h: 'Five-hour windows are not converted to a fee multiple; compare absolute value only.',
    noMultiple: '—',
    details: 'Method',
    basis: `Basis: fee multiple = API value for the window ÷ the fee for that window. Monthly board uses the monthly fee; weekly board uses monthly fee ÷ ${WEEKS_PER_MONTH} (52.14 weeks ÷ 12 months). X Ultra, Codex Pro 200 and Claude Pro are measured weekly only; their monthly value = weekly × ${WEEKS_PER_MONTH}, marked "rough" (no monthly reset was measured), so the monthly multiple equals the weekly multiple. Unverified tiers get no multiple.`,
    disclaimer: 'Conditional measurement · not an official allowance · small sample. Values use public API list prices, not bills or credits. Workload mixes are ranked separately, never mixed.',
  },
};

export function QuotaLeaderboard({ locale }: { locale: string }) {
  const zh = locale === 'zh';
  const t = zh ? T.zh : T.en;
  const [window, setWindow] = useState<LeaderWindow>('month');
  const [sort, setSort] = useState<LeaderSort>('multiple');
  const btn = (active: boolean) => `rounded-md border px-3 py-1 text-sm ${active ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900' : 'border-zinc-300 dark:border-zinc-700'}`;
  const groups = LEADER_MIXES.map(mix => ({ mix, rows: leaderboard(window, mix, sort) })).filter(g => g.rows.length);
  return <section className="space-y-4 rounded-lg border p-4" aria-label={zh ? '额度排行' : 'Quota leaderboard'} data-testid="quota-leaderboard">
    <div className="flex flex-wrap items-center gap-2" role="tablist">
      {(['5h', 'week', 'month'] as const).map(w => <button key={w} type="button" role="tab" aria-selected={window === w} className={btn(window === w)} onClick={() => setWindow(w)}>{t.windows[w]}</button>)}
      <span className="ml-auto text-xs text-zinc-500">{t.sortBy}</span>
      <button type="button" className={btn(sort === 'multiple')} aria-pressed={sort === 'multiple'} onClick={() => setSort('multiple')} disabled={window === '5h'}>{t.byMultiple}</button>
      <button type="button" className={btn(sort === 'usd' || window === '5h')} aria-pressed={sort === 'usd'} onClick={() => setSort('usd')}>{t.byUsd}</button>
    </div>
    {window === '5h' && <p className="text-xs text-zinc-500">{t.noMultiple5h}</p>}
    {groups.length === 0 && <p className="text-sm text-zinc-500">{t.none}</p>}
    {groups.map(({ mix, rows }) => <div key={mix} className="space-y-1">
      <h3 className="text-sm font-semibold">{t.mixes[mix]}</h3>
      <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm">
        <thead><tr className="text-xs text-zinc-500">{t.cols.map(c => <th key={c} className="p-2 font-normal">{c}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => {
          const m = feeMultiple(r);
          return <tr key={r.id} className="border-t align-top" data-row={r.id}>
            <td className="p-2"><span className="mr-1 text-zinc-400">{i + 1}.</span>{r.plan}
              {r.rough && <span className="ml-1 rounded bg-amber-100 px-1 text-[11px] text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">{t.rough}</span>}
              {!r.tierVerified && <span className="ml-1 rounded bg-amber-100 px-1 text-[11px] text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">{t.unverified}</span>}
            </td>
            <td className="p-2 text-xs">{r.model}</td>
            <td className="p-2 text-lg font-bold tabular-nums">{m ? <>{x(m.mid)}<span className="block text-[11px] font-normal text-zinc-500">{x(m.low)}–{x(m.high)}</span></> : t.noMultiple}</td>
            <td className="p-2 tabular-nums">≈ {usd.format(r.usd.mid)}<span className="block text-[11px] text-zinc-500">{usd.format(r.usd.low)}–{usd.format(r.usd.high)}</span></td>
            <td className="p-2">{t.windows[r.window]}</td>
            <td className="p-2"><time dateTime={r.date}>{r.date}</time></td>
            <td className="p-2">{t.low} · <a className="underline" href={r.anchor.startsWith('/') ? `/${locale}${r.anchor}` : r.anchor}>{t.details}</a></td>
          </tr>;
        })}</tbody>
      </table></div>
    </div>)}
    <p className="text-xs text-zinc-500">{t.basis}</p>
    <p className="text-xs font-medium text-amber-800 dark:text-amber-300">{t.disclaimer}</p>
  </section>;
}
