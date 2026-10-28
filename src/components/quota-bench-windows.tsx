export type WindowMeasurement = {
  window: string;
  usedBefore: number;
  usedAfter: number;
  estimate: { low: number; high: number; mid: number };
};

export function QuotaBenchWindows({ windows, locale, compact = false }: {
  windows: WindowMeasurement[]; locale: string; compact?: boolean;
}) {
  const zh = locale === 'zh';
  const fmt = (n: number) => new Intl.NumberFormat(zh ? 'zh-CN' : 'en-US', compact
    ? { notation: 'compact', maximumFractionDigits: 2 } : {}).format(n);
  return <div className="space-y-2" aria-label={zh ? '同时实测的额度窗口' : 'Simultaneously measured quota windows'}>
    {windows.map(w => <div key={w.window} className="space-y-1">
      <p className={compact ? 'text-base font-semibold' : 'font-medium'} title={`${w.estimate.low.toLocaleString('en-US')}–${w.estimate.high.toLocaleString('en-US')} tokens`}>
        {fmt(w.estimate.low)}–{fmt(w.estimate.high)} tokens / {w.window === '5h' ? (zh ? '5 小时' : '5 hours') : w.window === 'weekly' ? (zh ? '周' : 'week') : (zh ? '月（粗估）' : 'month (rough)')}
      </p>
      <p className="text-xs text-zinc-500">{zh ? '已用额度' : 'Used allowance'}: {w.usedBefore}% → {w.usedAfter}%</p>
    </div>)}
    <p className="text-xs text-zinc-500">{zh ? '三个窗口分别实测；区间仅包含读数舍入误差，并非统计置信区间。' : 'Each window measured directly. Ranges cover meter rounding only, not statistical confidence intervals.'}</p>
  </div>;
}
