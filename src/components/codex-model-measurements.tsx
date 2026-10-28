import data from '../../public/reports/codex-models-2026-10-28.json';

export function CodexModelMeasurements({ locale }: { locale: string }) {
  const zh = locale === 'zh';
  const fmt = (n: number) => n.toLocaleString(zh ? 'zh-CN' : 'en-US');
  return <section className="space-y-2 border-t pt-3" aria-label={zh ? 'Codex 模型复测' : 'Codex model retest'}>
    <h4 className="font-semibold">{zh ? 'Astra / Sol 复测 · Pro 200' : 'Astra / Sol retest · Pro 200'}</h4>
    <div className="overflow-x-auto"><table className="w-full text-left text-xs">
      <thead><tr>{(zh ? ['模型 / 成功次数', '实际 token 用量', '周容量（条件估计）'] : ['Model / successful calls', 'Measured tokens', 'Weekly capacity (conditional)']).map(s => <th key={s} className="p-2">{s}</th>)}</tr></thead>
      <tbody>{data.records.map(r => <tr key={r.model} className="border-t" data-measured-model={r.model}>
        <th scope="row" className="p-2 font-medium">{r.model}<span className="block font-normal">{r.calls} {zh ? '次' : 'calls'}</span></th>
        <td className="p-2">{fmt(r.totalTokens)}</td>
        <td className="p-2">{r.estimate ? <>{fmt(r.estimate.low)}–{fmt(r.estimate.high)}<span className="block text-zinc-500">{zh ? '仅采用 28 次主测' : '28-call main batch only'}</span></> : (zh ? '待核验：读数突变，暂不估算' : 'Pending: inconsistent readings; estimate withheld')}</td>
      </tr>)}</tbody>
    </table></div>
    <p className="text-xs text-zinc-500">{zh ? '只返回周窗口，5 小时 / 月额度不可测。Sol 的 token 用量已实测，但末批读数 92% → 94% → 0%，重置时间变化，且有控制会话消耗。模型共用额度池，容量不能相加。' : 'Only a weekly window was returned; 5-hour/monthly capacity is unavailable. Sol tokens were measured, but final readings changed 92% → 94% → 0% with a changed reset time and controller activity. Shared pool; capacities cannot be added.'}</p>
    <div className="flex flex-wrap gap-3 text-xs underline"><a href="/reports/codex-models-2026-10-28.md">{zh ? '复测过程与异常说明' : 'Retest methodology and anomalies (Chinese)'}</a><a href="/reports/codex-models-2026-10-28.json">{zh ? '窗口读数与逐次账本' : 'Window readings and per-call ledger'}</a></div>
  </section>;
}
