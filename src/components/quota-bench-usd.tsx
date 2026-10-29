import Link from 'next/link';
import { benchmarkForPlan, type BenchRecord } from './quota-bench-summary';

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

function windowUnit(record: BenchRecord, zh: boolean) {
  return record.window === 'weekly' ? (zh ? '周' : 'week') : record.window === '5h' ? (zh ? '5 小时' : '5 hours') : (zh ? '月池' : 'monthly pool');
}

export function QuotaBenchUsdHeadline({ record, locale, compact = false }: { record: BenchRecord; locale: string; compact?: boolean }) {
  if (!record.apiEquivalentUsd) return null;
  const zh = locale === 'zh';
  const { low, mid, high } = record.apiEquivalentUsd;
  const qualifier = [
    zh ? '有条件实测，不是官方额度或余额' : 'Conditional measurement, not an official allowance or credit',
    ...(!record.tierVerified ? [zh ? '套餐档位未核验' : 'plan tier unverified'] : []),
    ...(record.pricing?.variant === 'standard' && record.pricing.fastVariantRisk ? [zh ? '可能按 Fast 版计费' : 'may be billed as the Fast variant'] : []),
  ].join(zh ? '；' : '; ');
  return <div className="space-y-1">
    <p className="text-xs text-zinc-500">{zh ? 'token 折合（按公开 API 标准价）' : 'Token value at public API list price'}</p>
    <p className={compact ? 'text-2xl font-bold tabular-nums' : 'text-3xl font-bold tabular-nums'}>{`≈ ${usd.format(mid)}`} <span className="text-sm font-normal">/ {windowUnit(record, zh)}</span></p>
    <p className="text-xs text-zinc-500">{zh ? `区间 ${usd.format(low)}–${usd.format(high)}（读数舍入误差）` : `Range ${usd.format(low)}–${usd.format(high)} (meter rounding)`}</p>
    <p className="text-xs text-zinc-500">{qualifier}</p>
  </div>;
}

export function QuotaBenchBadge({ planSlug, locale }: { planSlug: string; locale: string }) {
  const record = benchmarkForPlan(planSlug);
  if (!record?.apiEquivalentUsd || !record.tierVerified) return null;
  const zh = locale === 'zh';
  const description = zh
    ? '有条件实测：样本 token 按公开 API 标准价折合的金额，不是官方额度或余额。点击查看方法。'
    : 'Conditional measurement: sample tokens valued at public API list price; not an official allowance or credit. Click for method.';
  return <Link href={`/${locale}/quota-bench#${record.id}`} className="inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-full border border-dashed border-zinc-300 px-2 py-0.5 text-[11px] text-zinc-600 hover:underline dark:border-zinc-700 dark:text-zinc-400" title={description} aria-label={description} data-quota-bench-badge={record.id}>{`${zh ? '实测' : 'Measured'} ≈ ${usd.format(record.apiEquivalentUsd.mid)} / ${windowUnit(record, zh)} ⓘ`}</Link>;
}

export function QuotaBenchUsd({ record, locale }: { record: BenchRecord; locale: string }) {
  if (!record.apiEquivalentUsd) return null;
  const zh = locale === 'zh';
  const preciseUsd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 6 });
  const fmt = (value: number) => value.toLocaleString('en-US');
  const { sample } = record.apiEquivalentUsd;
  const basis = record.estimateBasis;
  const pricing = record.pricing;
  const excludedBatches = basis?.excluded.batches.map(batch => Number(batch.split('-').pop())).join(zh ? '、' : ', ');
  return <div className="space-y-2 text-sm">
    <p>{basis ? (zh
      ? `推算样本：前 ${basis.calls} 轮 ${fmt(basis.totalTokens)} tokens ≈ ${preciseUsd.format(sample)}，额度 ${record.usedBefore}% → ${record.usedAfter}%；第 ${excludedBatches} 批 ${basis.excluded.calls} 轮 ${fmt(basis.excluded.totalTokens)} tokens 未计入`
      : `Estimate sample: first ${basis.calls} calls, ${fmt(basis.totalTokens)} tokens ≈ ${preciseUsd.format(sample)}, meter ${record.usedBefore}% → ${record.usedAfter}%; batch ${excludedBatches} (${basis.excluded.calls} calls, ${fmt(basis.excluded.totalTokens)} tokens) excluded`)
      : (zh ? `样本 token 折合 ${preciseUsd.format(sample)}` : `Sample tokens ≈ ${preciseUsd.format(sample)}`)}</p>
    {pricing && <>
      <p>{zh
        ? `价格：${pricing.model} 输入 ${preciseUsd.format(pricing.input)} / 缓存读取 ${preciseUsd.format(pricing.cacheRead)}${pricing.cacheWrite !== null ? ` / 缓存写入 ${preciseUsd.format(pricing.cacheWrite)}` : ''} / 输出 ${preciseUsd.format(pricing.output)} 每百万 tokens（USD），核验于 ${pricing.verifiedAt}`
        : `Prices: ${pricing.model} input ${preciseUsd.format(pricing.input)} / cache read ${preciseUsd.format(pricing.cacheRead)}${pricing.cacheWrite !== null ? ` / cache write ${preciseUsd.format(pricing.cacheWrite)}` : ''} / output ${preciseUsd.format(pricing.output)} per 1M tokens (USD), verified ${pricing.verifiedAt}`}
        {' '}<a className="underline" href={pricing.source}>{zh ? '价格来源' : 'Price source'}</a>
      </p>
      <p className="text-zinc-500">{pricing.note[zh ? 'zh' : 'en']}</p>
    </>}
  </div>;
}
