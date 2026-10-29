import type { BenchRecord } from './quota-bench-summary';

export function QuotaBenchUsd({ record, locale }: { record: BenchRecord; locale: string }) {
  if (!record.apiEquivalentUsd) return null;
  const zh = locale === 'zh';
  const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  const preciseUsd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 6 });
  const fmt = (value: number) => value.toLocaleString('en-US');
  const window = record.window === 'weekly' ? (zh ? '周' : 'week') : record.window === '5h' ? (zh ? '5 小时' : '5 hours') : (zh ? '月' : 'month');
  const { low, mid, high, sample } = record.apiEquivalentUsd;
  const basis = record.estimateBasis;
  const pricing = record.pricing;
  const excludedBatches = basis?.excluded.batches.map(batch => Number(batch.split('-').pop())).join(zh ? '、' : ', ');
  return <div className="space-y-2 text-sm">
    <p className="font-medium">{zh
      ? `token 折合金额（按公开标准价，不是余额）: ${usd.format(low)}–${usd.format(high)} / ${window}（中值约 ${usd.format(mid)}）`
      : `Token value at public list price (not credit): ${usd.format(low)}–${usd.format(high)} / ${window} (mid ≈ ${usd.format(mid)})`}</p>
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
