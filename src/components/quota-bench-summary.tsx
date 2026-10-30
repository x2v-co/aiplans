import { CodexModelMeasurements } from './codex-model-measurements';
import Link from 'next/link';
import { VolcengineModelMeasurements } from './volcengine-model-measurements';
import { QuotaBenchWindows } from './quota-bench-windows';
import { QuotaBenchUsd, QuotaBenchUsdHeadline } from './quota-bench-usd';
import dataset from '../../public/reports/quota-bench-2026-10.json';

export type BenchRecord = Omit<(typeof dataset.records)[number], 'controlTokens' | 'apiEquivalentUsd' | 'pricing' | 'estimateBasis' | 'tierVerification' | 'planSlug'> & {
  controlTokens: { input: number; cacheRead: number; cacheWrite: number; output: number } | null;
  apiEquivalentUsd: { low: number; mid: number; high: number; sample: number } | null;
  pricing: {
    model: string; variant: string; currency: string; unit: string;
    fastVariantRisk?: boolean;
    input: number; cacheRead: number; cacheWrite: number | null; output: number;
    source: string; verifiedAt: string; note: { zh: string; en: string };
  } | null;
  estimateBasis: {
    calls: number; batches: string[];
    tokens: { input: number; cacheRead: number; cacheWrite: number; output: number };
    totalTokens: number; usedDeltaPp: number; meterPrecisionPp: number;
    excluded: { batches: string[]; calls: number; totalTokens: number; reason: string };
  } | null;
  tierVerification: { source: string; note: string; confirmedAt?: string; priceUsdPerMonth?: number } | null;
  planSlug: string | null;
};

// The account owner confirmed Pro 200. The legacy chatgpt-pro slug is the
// historical $200 SKU; never attach this measurement to Pro 100 or Pro 500.
// Cursor's legacy plan tier is unverified; never attach its measurement to
// Ultra or any other specific tier's plan card.
export function benchmarkForPlan(planSlug: string): BenchRecord | undefined {
  const id = ['chatgpt-pro', 'chatgpt-pro-200'].includes(planSlug)
    ? 'codex-pro'
    : planSlug === 'seed-pro' ? 'volcengine-pro' : undefined;
  return dataset.records.find(record => record.id === id);
}

export function PlanBenchSummary({ record, locale }: { record: BenchRecord; locale: string }) {
  const zh = locale === 'zh';
  const fmt = (value: number) => value.toLocaleString(zh ? 'zh-CN' : 'en-US');
  const compact = (value: number) => new Intl.NumberFormat(zh ? 'zh-CN' : 'en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(value);
  const window = record.window === 'weekly' ? (zh ? '周' : 'week') : record.window === '5h' ? (zh ? '5 小时' : '5 hours') : (zh ? '月' : 'month');
  const benchTokens = record.tokens.input + record.tokens.cacheRead + record.tokens.output;
  const totalTokens = benchTokens + (record.controlTokens ? record.controlTokens.input + record.controlTokens.cacheRead + record.controlTokens.output : 0);
  return <div className="space-y-2 text-xs" data-quota-bench={record.id}>
    <QuotaBenchUsdHeadline record={record} locale={locale} compact />
    <p className="font-medium text-amber-800 dark:text-amber-300">{!record.tierVerified
      ? (zh ? '套餐档位未核验 · 仅供参考' : 'Plan tier unverified · reference only')
      : record.status === 'pending' ? (zh ? '实测待对账 · 暂不估算容量' : 'Measurement pending reconciliation · capacity withheld')
        : (zh ? '实测条件估算 · 低置信度' : 'Measured conditional estimate · low confidence')}</p>
    <details className="space-y-2">
      <summary className="cursor-pointer text-sm underline">{zh ? '方法说明' : 'Method'}</summary>
      {record.windowMeasurements && <QuotaBenchWindows windows={record.windowMeasurements} locale={locale} compact />}
      {!record.windowMeasurements && record.estimate && <p className="text-base font-semibold" title={`${fmt(record.estimate.low)}–${fmt(record.estimate.high)} tokens / ${window}`}>
        {compact(record.estimate.low)}–{compact(record.estimate.high)} tokens / {window}
      </p>}
      <p>{record.model} · <time dateTime={record.date}>{record.date}</time> · {record.calls} {zh ? '次调用' : 'calls'}</p>
      <p>{zh ? '实测用量' : 'Measured usage'}: {fmt(totalTokens)} tokens{record.controlTokens ? (zh ? '（含同账号控制会话）' : ' (including same-account controller)') : ''}</p>
      {!record.windowMeasurements && <p>{zh ? '已用额度' : 'Used allowance'}: {record.usedBefore}% → {record.usedAfter}%{record.estimateBasis ? (zh ? `（仅前 ${record.estimateBasis.calls} 次）` : ` (first ${record.estimateBasis.calls} calls only)`) : ''}</p>}
      <QuotaBenchUsd record={record} locale={locale} />
      <p className="text-zinc-500">{zh ? record.caveats.zh : record.caveats.en}</p>
      {record.id === 'volcengine-pro' && <VolcengineModelMeasurements locale={locale} />}
    </details>
    {record.id === 'codex-pro' && <CodexModelMeasurements locale={locale} />}
    <Link href={`/${locale}/quota-bench#${record.id}`} className="inline-block text-blue-600 underline">{zh ? '评测过程与计算依据 →' : 'Measurement process and calculations →'}</Link>
  </div>;
}
