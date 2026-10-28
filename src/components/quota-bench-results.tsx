import Link from 'next/link';
import dataset from '../../public/reports/quota-bench-2026-10.json';

export function QuotaBenchResults({ locale, compact = false }: { locale: string; compact?: boolean }) {
  const zh = locale === 'zh';
  const fmt = (value: number) => value.toLocaleString(zh ? 'zh-CN' : 'en-US');
  return <section className="space-y-4 rounded-lg border p-4" aria-label={zh ? '额度实测数据' : 'Measured quota data'}>
    <h2 className="text-lg font-semibold">{zh ? '额度实测数据 · 2026-10' : 'Measured quota data · 2026-10'}</h2>
    <p className="text-sm text-zinc-500">{zh ? '实测记录与条件估算，不是官方承诺额度。保持原始窗口，不自动折算月额度。' : 'Observations and conditional estimates, not official allowances. Native windows only; no automatic monthly projections.'}</p>
    {compact ? <Link className="underline" href={`/${locale}/quota-bench`}>{zh ? '查看 Codex、火山与 Cursor 的实测数据和报告' : 'View Codex, Volcengine and Cursor measurements and reports'}</Link> : <>
      {dataset.records.map(record => <article key={record.id} id={record.id} className="scroll-mt-20 space-y-3 border-t pt-4">
        <h3 className="font-semibold">{record.plan} · {record.model}</h3>
        <p className="text-sm">{record.status === 'pending' ? (zh ? '待核对 · 暂不发布容量' : 'Pending reconciliation · capacity withheld') : (zh ? '条件估算 · 低置信度' : 'Conditional estimate · low confidence')} · <time dateTime={record.date}>{record.date}</time></p>
        <p className="text-sm">{zh ? '原始窗口' : 'Native window'}: {record.window} · {record.calls} {zh ? '轮' : 'calls'} · {zh ? '已用比例' : 'Used'} {record.usedBefore}% → {record.usedAfter}%</p>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm">
          <caption className="sr-only">{record.plan} token usage</caption>
          <thead><tr>{(zh ? ['来源', '普通输入', '缓存读取', '输出'] : ['Source', 'Fresh input', 'Cache read', 'Output']).map(x => <th key={x} className="p-2">{x}</th>)}</tr></thead>
          <tbody><tr><td className="p-2">Bench</td><td className="p-2">{fmt(record.tokens.input)}</td><td className="p-2">{fmt(record.tokens.cacheRead)}</td><td className="p-2">{fmt(record.tokens.output)}</td></tr>
          {record.controlTokens && <tr><td className="p-2">{zh ? '同账号控制会话' : 'Same-account controller'}</td><td className="p-2">{fmt(record.controlTokens.input)}</td><td className="p-2">{fmt(record.controlTokens.cacheRead)}</td><td className="p-2">{fmt(record.controlTokens.output)}</td></tr>}</tbody>
        </table></div>
        <p className="text-sm">{zh ? '缓存写入均为 0；未标定写入权重。输出包含 reasoning，未重复相加。' : 'Cache writes were zero; write weights are uncalibrated. Output includes reasoning without double-counting.'}</p>
        {record.estimate && <p className="font-medium">{zh ? '同负载配比条件区间' : 'Conditional range at the observed mix'}: {fmt(record.estimate.low)}–{fmt(record.estimate.high)} tokens / {record.window}</p>}
        {record.apiEquivalentUsd && <p className="text-sm">{zh ? '标准 API 标价等价价值（不是余额）' : 'Standard API list-value equivalent (not credit)'}: ${fmt(record.apiEquivalentUsd.mid)} / {record.window}</p>}
        <p className="text-sm text-amber-800 dark:text-amber-300">{zh ? record.caveats.zh : record.caveats.en}</p>
      </article>)}
      <div className="flex flex-wrap gap-4 text-sm underline">
        <a href="/reports/quota-bench-2026-10.md">{zh ? '完整实测报告' : 'Full report (Chinese)'}</a>
        <a href="/reports/quota-bench-2026-10.json">{zh ? '结构化数据 JSON' : 'Structured data JSON'}</a>
        <a href="/reports/quota-bench-2026-10-ledger.json">{zh ? '脱敏用量账本 JSON' : 'Sanitized usage ledger JSON'}</a>
      </div>
    </>}
  </section>;
}
