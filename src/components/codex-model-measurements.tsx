import data from '../../public/reports/codex-models-2026-10-30.json';
import {
  CODEX_QUOTA_DATE, CODEX_QUOTA_REPORT, CODEX_QUOTA_LEDGER, CODEX_QUOTA_HISTORY,
  codexQuotaCopy, codexQuotaCaveats, codexQuotaModel,
} from '@/lib/codex-pro200';

export function CodexModelMeasurements({ locale, modelSlug }: { locale: string; modelSlug?: string }) {
  const zh = locale === 'zh';
  const copy = codexQuotaCopy(locale);
  const fmt = (n: number) => n.toLocaleString(zh ? 'zh-CN' : 'en-US');
  return <section className="space-y-2 border-t pt-3" aria-label={zh ? 'Codex 模型复测' : 'Codex model retest'}>
    <h4 className="font-semibold">{copy.heading}</h4>
    <p className="text-xs">{copy.verifiedAt}: <time dateTime={CODEX_QUOTA_DATE}>{CODEX_QUOTA_DATE}</time></p>
    <div className="overflow-x-auto"><table className="w-full text-left text-xs">
      <thead><tr>{(zh ? ['模型 / 成功次数', '实际 token 用量', '周容量（条件估计）'] : ['Model / successful calls', 'Measured tokens', 'Weekly capacity (conditional)']).map(s => <th key={s} className="p-2">{s}</th>)}</tr></thead>
      <tbody>{data.records.filter(r => !modelSlug || r.model === codexQuotaModel(modelSlug)).map(r => <tr key={r.model} className="border-t" data-measured-model={r.model}>
        <th scope="row" className="p-2 font-medium">{r.model}<span className="block font-normal">{r.calls}/{r.attempts} {zh ? '次成功' : 'successful'}</span></th>
        <td className="p-2">{fmt(r.totalTokens)}</td>
        <td className="p-2" title={r.estimate ? `${fmt(r.estimate.low)}–${fmt(r.estimate.high)}; ${fmt(r.estimate.mid)}` : undefined}>{r.model === 'gpt-6.1-sol' ? copy.solCapacity : copy.astraCapacity}</td>
      </tr>)}</tbody>
    </table></div>
    {codexQuotaCaveats(locale).map(note => <p key={note} className="text-xs text-zinc-500">{note}</p>)}
    <div className="flex flex-wrap gap-3 text-xs underline">
      <a href={CODEX_QUOTA_REPORT}>{copy.report}</a>
      <a href={CODEX_QUOTA_LEDGER}>{copy.ledger}</a>
      <a href={CODEX_QUOTA_HISTORY}>{copy.history}</a>
    </div>
  </section>;
}
