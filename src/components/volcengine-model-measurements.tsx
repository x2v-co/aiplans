import measurements from '../../public/reports/volcengine-models-2026-10-28.json';

export function VolcengineModelMeasurements({ locale }: { locale: string }) {
  const zh = locale === 'zh';
  const compact = (n: number) => new Intl.NumberFormat(zh ? 'zh-CN' : 'en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(n);
  return <section className="space-y-2 border-t pt-3" aria-label={zh ? '其他主力模型实测' : 'Other measured models'}>
    <h4 className="font-semibold">{zh ? '其他主力模型实测' : 'Other measured models'}</h4>
    <p className="text-xs text-zinc-500">{zh ? '同一套餐，按模型分别测量。以下为本次负载配比的条件区间（tokens），月额度为粗估。' : 'Same plan, measured separately per model. Conditional token ranges at each observed workload mix; monthly capacity is rough.'}</p>
    <div className="overflow-x-auto"><table className="w-full text-left text-xs">
      <thead><tr>{(zh ? ['模型 / 次数', '5 小时', '周', '月（粗估）'] : ['Model / calls', '5 hours', 'Week', 'Month (rough)']).map(label => <th className="p-2" key={label}>{label}</th>)}</tr></thead>
      <tbody>{measurements.records.map(record => <tr key={record.model} className="border-t" data-measured-model={record.model}>
        <th scope="row" className="p-2 font-medium">{record.model}<span className="block font-normal text-zinc-500">{record.calls} {zh ? '次' : 'calls'} · {record.mix.inputPct}% {zh ? '普通输入' : 'fresh input'}</span></th>
        {record.windows.map(window => <td key={window.window} className="p-2" title={`${window.low.toLocaleString('en-US')}–${window.high.toLocaleString('en-US')} tokens`}>
          {compact(window.low)}–{compact(window.high)}
        </td>)}
      </tr>)}</tbody>
    </table></div>
    <p className="text-xs text-zinc-500">{zh ? '区间只包含读数舍入误差；各模型实际输出比例不同，不能据此认定纯模型扣量系数。模型共用额度池，表中容量不能相加。' : 'Bounds cover meter rounding only. Output proportions differ, so these are not isolated model weights. Models share the allowance pool; capacities cannot be added.'}</p>
    <p className="text-xs text-zinc-500">{zh ? 'GLM-5.3-Flash 此处仅展示长输入主测（输入约 16.3 万 tokens／次）；前 4 次短输入试测另列在报告中，未混算。' : 'GLM-5.3-Flash shows only the long-input profile (~163K input tokens per call). The first four shorter pilot calls are documented separately and excluded.'}</p>
    <div className="flex flex-wrap gap-3 text-xs underline">
      <a href="/reports/volcengine-models-2026-10-28.md">{zh ? '多模型评测过程与配比' : 'Multi-model methodology and mix (Chinese)'}</a>
      <a href="/reports/volcengine-models-2026-10-28.json">{zh ? '三窗口读数与用量账本' : 'Window readings and usage ledger'}</a>
    </div>
  </section>;
}
