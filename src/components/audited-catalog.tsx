import Link from 'next/link';
import type { AiCatalogItem } from '@/lib/ai-vertical-catalog';
import { labelNonLlmPriceKey } from '@/lib/non-llm-price-labels';
import { formatCurrencyAmount } from '@/lib/currency';

export function auditedPrice(item: AiCatalogItem, locale: string): string {
  if (item.priceStatus === 'not-public') return locale === 'zh' ? '未公开价格' : 'Price not public';
  if (item.priceStatus !== 'priced') return locale === 'zh' ? '待核验' : 'Needs verification';
  if (item.kind === 'decision-model') return item.pricing;
  if (item.pricePerUnit == null) return '—';
  const money = (value: number) => formatCurrencyAmount(value.toFixed(2), item.currency);
  const range = item.pricePerUnitHigh == null ? '' : `–${money(item.pricePerUnitHigh)}`;
  const zh = locale === 'zh';
  const units: Partial<Record<NonNullable<AiCatalogItem['billingUnit']>, string>> = {
    per_song: zh ? '首' : 'song',
    per_minute: zh ? '分钟' : 'minute',
    per_second: zh ? '秒' : 'second',
    per_token: 'token',
    per_1m_tokens: item.kind === 'video-model'
      ? (zh ? '百万视频输出 tokens' : '1M video output tokens')
      : (zh ? '百万 tokens' : '1M tokens'),
  };
  const unit = item.billingUnit && units[item.billingUnit];
  if (!unit) return item.pricing || '—';
  const headline = `${item.approximatePrice ? '≈' : ''}${money(item.pricePerUnit)}${range} / ${unit}`;
  const rate = item.videoTokensPerSecond;
  if (item.kind !== 'video-model' || item.billingUnit !== 'per_1m_tokens' ||
      rate == null || !Number.isFinite(rate) || rate <= 0 || !item.resolutionTier) return headline;
  const estimated = money(item.pricePerUnit * rate / 1_000_000);
  const context = `${zh ? '推算' : 'estimated'}, ${item.resolutionTier}, ${rate.toLocaleString('en-US')} tokens/s`;
  return `${headline}; ≈${estimated} / ${zh ? '秒' : 'second'} (${context})`;
}

export function AuditedPricingFacts({ item, locale }: { item: AiCatalogItem; locale: string }) {
  const zh = locale === 'zh';
  const money = (value: number | null | undefined) => value == null ? '—' : formatCurrencyAmount(value, item.currency);
  const priced = item.priceStatus === 'priced';
  return <section className="mt-8 rounded-xl border p-6">
    <h2 className="text-xl font-bold">{zh ? '价格与核验' : 'Pricing and verification'}</h2>
    <p className="mt-3">{auditedPrice(item, locale)}</p>
    {item.usageRates?.length ? <dl className="mt-4 grid gap-3 sm:grid-cols-2">
      {item.usageRates.map(rate => <div key={`${rate.priceKind}/${rate.unit}`}>
        <dt>{labelNonLlmPriceKey(rate.priceKind, locale)}</dt>
        <dd>{priced && Number.isFinite(rate.price) ? `${rate.approximate ? '≈' : ''}${formatCurrencyAmount(rate.price, item.currency)} / ${labelNonLlmPriceKey(rate.unit, locale)}` : (zh ? '待核验' : 'Needs verification')}</dd>
      </div>)}
    </dl> : null}
    <dl className="mt-4 grid gap-3 sm:grid-cols-2">
      {item.kind === 'decision-model' && <>
        <div><dt>{zh ? '每百万输入 token' : 'Per 1M input tokens'}</dt><dd>{money(item.inputPricePer1M)}</dd></div>
        <div><dt>{zh ? '每百万输出 token' : 'Per 1M output tokens'}</dt><dd>{money(item.outputPricePer1M)}</dd></div>
        <div><dt>{zh ? '每百万次任务' : 'Per 1M tasks'}</dt><dd>{money(item.pricePer1MTasks)}</dd></div>
        <div><dt>{zh ? '上下文' : 'Context'}</dt><dd>{item.contextWindowLabel ?? '—'}</dd></div>
      </>}
      <div><dt>{zh ? '价格状态' : 'Price status'}</dt><dd>{item.priceStatus === 'needs-verification' ? (zh ? '待核验' : 'Needs verification') : item.priceStatus === 'priced' ? (zh ? '已标价' : 'Priced') : item.priceStatus === 'not-public' ? (zh ? '未公开价格' : 'Price not public') : item.priceStatus ?? '—'}</dd></div>
      <div><dt>{zh ? '核验日期' : 'Verified'}</dt><dd>{item.verifiedAt ?? '—'}</dd></div>
    </dl>
    {item.notes && <p className="mt-3 text-sm">{item.notes}</p>}
    {item.needsVerification?.map(note => <p className="mt-2 text-sm" key={note}>{zh ? '待核验' : 'Needs verification'}: {note}</p>)}
  </section>;
}

export function DecisionModelCatalog({ items, locale }: { items: AiCatalogItem[]; locale: string }) {
  const zh = locale === 'zh';
  const money = (item: AiCatalogItem, price: number | null | undefined) => price == null ? '—' : formatCurrencyAmount(price, item.currency);
  return <div className="mt-8 overflow-x-auto rounded-xl border"><table className="w-full text-left text-sm">
    <thead><tr>{[zh ? '模型' : 'Model', zh ? '$/百万输入 token' : '$/M input tokens', zh ? '$/百万输出 token' : '$/M output tokens', zh ? '$/百万次任务' : '$/1M tasks', zh ? '状态 / 核验' : 'Status / verification', zh ? '来源' : 'Sources'].map(h => <th key={h} className="p-4">{h}</th>)}</tr></thead>
    <tbody>{items.map(item => <tr key={item.slug} className="border-t align-top">
      <td className="p-4"><Link className="text-blue-600 underline" href={`/${locale}/decision-models/${item.slug}`}>{item.name}</Link><p>{item.provider}</p>{item.contextWindowLabel && <p>{item.contextWindowLabel}{item.status === 'preview' && ` · ${zh ? '公开预览' : 'Public preview'}`}</p>}</td>
      <td className="p-4">{money(item, item.inputPricePer1M)}</td><td className="p-4">{money(item, item.outputPricePer1M)}</td><td className="p-4">{money(item, item.pricePer1MTasks)}</td>
      <td className="p-4">{item.priceStatus === 'priced' ? (zh ? '已标价' : 'Priced') : (zh ? '待核验' : 'Needs verification')}<p>{item.verifiedAt}</p><p>{item.notes}</p></td>
      <td className="p-4">{item.sourceUrls?.map(source => <a key={source.url} className="block text-blue-600 underline" href={source.url} target="_blank" rel="noreferrer">{source.label}</a>) ?? '—'}</td>
    </tr>)}</tbody>
  </table><p className="p-4 text-sm">{zh ? '— 表示未知；审计未提供每百万次任务的价格，不能从 token 价格推算。' : '— means unknown. The audit supplies no per-million-task prices; token prices cannot determine task prices.'}</p></div>;
}
