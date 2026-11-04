import Link from 'next/link';
import type { AiCatalogItem } from '@/lib/ai-vertical-catalog';
import { labelNonLlmPriceKey } from '@/lib/non-llm-price-labels';
import { formatCurrencyAmount } from '@/lib/currency';
import { catalogBillingUnit } from '@/lib/catalog-billing-unit';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { CatalogProviderLogo } from '@/components/catalog-provider-logo';

export function auditedPrice(item: AiCatalogItem, locale: string): string {
  if (item.priceStatus === 'not-public') return locale === 'zh' ? '未公开价格' : 'Price not public';
  if (item.priceStatus !== 'priced') return locale === 'zh' ? '待核验' : 'Needs verification';
  if (['decision-model', 'embedding-model'].includes(item.kind)) return item.pricing;
  if (item.pricePerUnit == null) return '—';
  const money = (value: number) => formatCurrencyAmount(value.toLocaleString('en-US', {
    useGrouping: false, minimumFractionDigits: 2, maximumFractionDigits: 4,
  }), item.currency);
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
  const billingUnit = catalogBillingUnit(item);
  const unit = billingUnit && units[billingUnit];
  if (!unit) return item.pricing || '—';
  const headline = `${item.approximatePrice ? '≈' : ''}${money(item.pricePerUnit)}${range} / ${unit}`;
  const rate = item.videoTokensPerSecond;
  if (item.kind !== 'video-model' || billingUnit !== 'per_1m_tokens' ||
      rate == null || !Number.isFinite(rate) || rate <= 0 || !item.resolutionTier) return headline;
  const estimated = formatCurrencyAmount((item.pricePerUnit * rate / 1_000_000).toFixed(2), item.currency);
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
  return <><DecisionModelCards items={items} locale={locale} /><div className="mt-8 overflow-x-auto rounded-xl border"><table className="w-full text-left text-sm">
    <thead><tr>{[zh ? '模型' : 'Model', zh ? '每百万输入 token（原币种）' : 'Per 1M input tokens (native currency)', zh ? '每百万输出 token（原币种）' : 'Per 1M output tokens (native currency)', zh ? '每百万次任务（原币种）' : 'Per 1M tasks (native currency)', zh ? '状态 / 核验' : 'Status / verification', zh ? '来源' : 'Sources'].map(h => <th key={h} className="p-4">{h}</th>)}</tr></thead>
    <tbody>{items.map(item => <tr key={item.slug} className="border-t align-top">
      <td className="p-4"><Link className="text-blue-600 underline" href={`/${locale}/decision-models/${item.slug}`}>{item.name}</Link><p>{item.provider}</p>{item.contextWindowLabel && <p>{item.contextWindowLabel}{item.status === 'preview' && ` · ${zh ? '公开预览' : 'Public preview'}`}</p>}</td>
      <td className="p-4">{money(item, item.inputPricePer1M)}</td><td className="p-4">{money(item, item.outputPricePer1M)}</td><td className="p-4">{money(item, item.pricePer1MTasks)}</td>
      <td className="p-4">{item.priceStatus === 'priced' ? (zh ? '已标价' : 'Priced') : (zh ? '待核验' : 'Needs verification')}<p>{item.verifiedAt}</p><p>{item.notes}</p></td>
      <td className="p-4">{item.sourceUrls?.map(source => <a key={source.url} className="block text-blue-600 underline" href={source.url} target="_blank" rel="noreferrer">{source.label}</a>) ?? '—'}</td>
    </tr>)}</tbody>
  </table><p className="p-4 text-sm">{zh ? '— 表示未知；审计未提供每百万次任务的价格，不能从 token 价格推算。' : '— means unknown. The audit supplies no per-million-task prices; token prices cannot determine task prices.'}</p></div></>;
}

/** Card view shared with the other vertical pages (Card + provider logo); the table below stays the source of exact prices. */
export function DecisionModelCards({ items, locale }: { items: AiCatalogItem[]; locale: string }) {
  const zh = locale === 'zh';
  return <section className="mt-8" aria-labelledby="decision-model-cards-heading" data-testid="decision-model-cards">
    <h2 id="decision-model-cards-heading" className="text-2xl font-bold">{zh ? '模型卡片' : 'Model cards'}</h2>
    <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">{items.filter(item => item.slug).map(item =>
      <Link key={item.slug} href={`/${locale}/decision-models/${item.slug}`} className="block h-full">
        <Card className="h-full transition-colors hover:border-blue-300 hover:bg-blue-50/40 dark:hover:border-blue-800 dark:hover:bg-blue-950/20">
          <CardContent className="flex h-full flex-col p-5">
            <div className="flex items-center gap-2"><CatalogProviderLogo item={item} size={24} className="rounded-md" />
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{item.provider}</p></div>
            <h3 className="mt-2 text-lg font-bold">{item.name}</h3>
            <p className="mt-3 flex-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{auditedPrice(item, locale)}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant="secondary">{item.priceStatus === 'priced' ? (zh ? '已标价' : 'Priced') : (zh ? '待核验' : 'Needs verification')}</Badge>
              {item.status === 'preview' && <Badge variant="outline">{zh ? '公开预览' : 'Public preview'}</Badge>}
              {item.contextWindowLabel && <Badge variant="outline">{item.contextWindowLabel}</Badge>}
            </div>
          </CardContent>
        </Card>
      </Link>)}</div>
  </section>;
}

/** Embeddings have modality-specific input rates; no output-token price is inferred. */
export function EmbeddingModelCatalog({ items, locale }: { items: AiCatalogItem[]; locale: string }) {
  const zh = locale === 'zh';
  return <div className="mt-8 overflow-x-auto rounded-xl border"><table className="w-full text-left text-sm">
    <thead><tr>{[zh ? '模型' : 'Model', zh ? '价格' : 'Pricing', zh ? '状态 / 核验' : 'Status / verification', zh ? '来源' : 'Sources'].map(h => <th key={h} className="p-4">{h}</th>)}</tr></thead>
    <tbody>{items.map(item => <tr key={item.slug} className="border-t align-top">
      <td className="p-4"><Link className="text-blue-600 underline" href={`/${locale}/embedding-models/${item.slug}`}>{item.name}</Link><p>{item.provider}</p></td>
      <td className="p-4">{item.pricing}<p>{item.notes}</p></td>
      <td className="p-4">{item.shutdownDate ? (zh ? '已下线' : 'Shut down') : item.status}<p>{item.verifiedAt}</p></td>
      <td className="p-4">{item.sourceUrls?.map(source => <a key={source.url} className="block text-blue-600 underline" href={source.url} target="_blank" rel="noreferrer">{source.label}</a>)}</td>
    </tr>)}</tbody>
  </table></div>;
}
