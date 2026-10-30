import data from '../../public/reports/codex-models-2026-10-30.json';

export function CodexModelMeasurements({ locale }: { locale: string }) {
  const zh = locale === 'zh';
  const fmt = (n: number) => n.toLocaleString(zh ? 'zh-CN' : 'en-US');
  return <section className="space-y-2 border-t pt-3" aria-label={zh ? 'Codex 模型复测' : 'Codex model retest'}>
    <h4 className="font-semibold">{zh ? 'Astra / Sol 升级后复测 · Pro 200 · 10/30' : 'Astra / Sol post-upgrade retest · Pro 200 · 10/30'}</h4>
    <div className="overflow-x-auto"><table className="w-full text-left text-xs">
      <thead><tr>{(zh ? ['模型 / 成功次数', '实际 token 用量', '周容量（条件估计）'] : ['Model / successful calls', 'Measured tokens', 'Weekly capacity (conditional)']).map(s => <th key={s} className="p-2">{s}</th>)}</tr></thead>
      <tbody>{data.records.map(r => <tr key={r.model} className="border-t" data-measured-model={r.model}>
        <th scope="row" className="p-2 font-medium">{r.model}<span className="block font-normal">{r.calls}/{r.attempts} {zh ? '次成功' : 'successful'}</span></th>
        <td className="p-2">{fmt(r.totalTokens)}</td>
        <td className="p-2">{r.estimate ? <>{fmt(r.estimate.low)}–{fmt(r.estimate.high)}<span className="block text-zinc-500">{zh ? '仅采用 60 次主测' : '60-call main batch only'}</span></> : r.lowerBound ? <>{zh ? '条件下界 ≥ ' : 'Conditional lower bound ≥ '}{fmt(r.lowerBound.low)}<span className="block text-zinc-500">{zh ? '无有限上界，非完整容量' : 'No finite upper bound; not full capacity'}</span></> : (zh ? '待核验' : 'Pending')}</td>
      </tr>)}</tbody>
    </table></div>
    <p className="text-xs text-zinc-500">{zh ? '只返回周窗口，5 小时 / 月额度不可测。Sol 有 2 次容量错误，主测读数仅增加 1 个百分点且有控制会话增量；下界假设计量已结算、额外消耗非负及线性扣量。模型共用额度池，容量不能相加。升级幅度未独立核验。' : 'Only a weekly window was returned. Sol had two capacity errors; its main batch moved one percentage point with controller activity. The lower bound assumes settled linear metering and nonnegative extra consumption. Shared pool; capacities cannot be added. Upgrade magnitude is unverified.'}</p>
    <div className="flex flex-wrap gap-3 text-xs underline"><a href="/reports/codex-models-2026-10-30.md">{zh ? '复测过程与异常说明' : 'Retest methodology and anomalies (Chinese)'}</a><a href="/reports/codex-models-2026-10-30.json">{zh ? '窗口读数与逐次账本' : 'Window readings and per-call ledger'}</a></div>
  </section>;
}
