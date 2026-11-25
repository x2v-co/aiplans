"use client";

import { Fragment, useEffect, useRef, useState, type FormEvent, type MouseEvent } from 'react';
import type { CatalogChannel, CatalogPage, CatalogRow, ChannelPage, VariantPage } from '@/lib/api-pricing-catalog';
import { catalogQueryParams, parseCatalogRequest, CATALOG_PAGE_SIZE, CHANNEL_PAGE_SIZE, VARIANT_PAGE_SIZE, type CatalogQuery } from '@/lib/api-pricing-query';
import { useTranslations } from 'next-intl';
import { channelTermBadges, type ChannelTermsFields } from '@/lib/channel-terms';
import { LimitedTimeOfferMark } from '@/components/limited-time-offer';
import { CouponBadge } from '@/components/coupon-badge';
import type { CouponOffer } from '@/lib/coupon-format';
import { PRICE_UNIT_INFO } from '@/lib/currency';
import { outboundChannelDataset } from '@/lib/funnel-analytics';

const control = 'rounded border border-zinc-300 bg-white px-3 py-2 text-sm dark:bg-zinc-900';
// One locally scoped sheet replaces presentation attributes repeated in every
// SSR row. Keep shared interactive badge components unchanged on other pages.
const catalogStyles = `
.api-pricing-catalog table{width:100%;border-collapse:collapse;font-size:.875rem;line-height:1.25rem}
.api-pricing-catalog th,.api-pricing-catalog td{border-bottom:1px solid var(--border);padding:.75rem;text-align:left;vertical-align:top}
.api-pricing-catalog table a:not([class]){color:var(--color-blue-600);text-decoration:underline}
.api-pricing-catalog tbody>tr>td:first-child>a{font-weight:500}
.api-pricing-catalog tbody>tr>td:first-child>p{font-size:.75rem;line-height:1rem}
.api-pricing-catalog tbody>tr>td:first-child>p:first-of-type,.api-pricing-catalog .ap-provider>div:first-of-type,.api-pricing-catalog .ap-rates>div:last-child{color:var(--color-zinc-500);font-size:.75rem;line-height:1rem}
.api-pricing-catalog .ap-provider,.api-pricing-catalog .ap-rates{font-size:.875rem;line-height:1.25rem}
.api-pricing-catalog .ap-provider>:not(:last-child),.api-pricing-catalog .ap-rates>:not(:last-child){margin-bottom:.25rem}
.api-pricing-catalog .ap-rates span{white-space:nowrap;font-family:var(--font-geist-mono),monospace}
.api-pricing-catalog .ap-terms{margin-top:.25rem;display:flex;flex-wrap:wrap;gap:.25rem;white-space:normal}
.api-pricing-catalog .ap-terms>span{display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--border);border-radius:9999px;padding:.125rem .5rem;font-size:.75rem;line-height:1rem;font-weight:400;white-space:nowrap}
.api-pricing-catalog .ap-terms>.ap-training{font-weight:500;border-color:var(--color-amber-400);background:var(--color-amber-50);color:var(--color-amber-900)}
.api-pricing-catalog .ap-note{font-size:.75rem;line-height:1rem;color:var(--color-amber-800)}
.api-pricing-catalog summary{cursor:pointer;color:var(--color-blue-600)}
.dark .api-pricing-catalog .ap-terms>.ap-training{background:var(--color-amber-950);color:var(--color-amber-200)}
`;

/** Same evidence and translations as ChannelTermsBadges; static list styling. */
function CatalogTerms({ terms }: { terms: ChannelTermsFields }) {
  const t = useTranslations('channelTerms');
  const badges = channelTermBadges(terms);
  if (!badges.length) return null;
  return <div className="ap-terms">{badges.map(badge => badge.kind === 'training'
    ? <span key="training" className="ap-training" title={badge.note ?? undefined}>{t('training')}</span>
    : <span key="quota">{t('quota', { unit: t(`units.${badge.unit}`) })}</span>)}</div>;
}

type Coupons = Record<string, CouponOffer[]>;
type Envelope<T> = { page: T; couponByProvider: Coupons; requestedAt: string };

/** Only event handlers call load. Mounting/hydrating this component downloads no catalog. */
function useCatalogRequest<T>(onSuccess?: (params: URLSearchParams) => void) {
  const [result, setResult] = useState<Envelope<T> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const pending = useRef<AbortController | null>(null);
  const sequence = useRef(0);
  const failedParams = useRef<string | null>(null);
  useEffect(() => () => { sequence.current++; pending.current?.abort(); }, []);
  async function load(params: URLSearchParams) {
    const target = params.toString();
    const current = ++sequence.current;
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setLoading(true);
    setError(false);
    failedParams.current = null;
    try {
      const response = await fetch(`/api/pricing/catalog?${target}`, { signal: controller.signal, cache: 'no-store' });
      if (!response.ok) throw new Error('Catalog unavailable');
      const data = await response.json() as Envelope<T>;
      if (current === sequence.current) { setResult(data); onSuccess?.(new URLSearchParams(target)); return data; }
    } catch {
      if (current === sequence.current && !controller.signal.aborted) { failedParams.current = target; setError(true); }
    } finally {
      if (current === sequence.current) setLoading(false);
    }
    return null;
  }
  const retry = () => failedParams.current === null ? Promise.resolve(null) : load(new URLSearchParams(failedParams.current));
  return { result, loading, error, load, retry };
}

function Money({ value, currency }: { value: number | null | undefined; currency: string }) {
  // Significant digits preserve tiny positive token rates; the ISO code disambiguates CNY/JPY/USD.
  return <span>{value == null || !Number.isFinite(value) ? '—' :
    `${currency} ${value.toLocaleString('en-US', { maximumSignificantDigits: 10 })}`}</span>;
}

function Rates({ row, locale }: { row: Pick<CatalogChannel, 'input_price_per_1m' | 'output_price_per_1m' | 'cached_input_price_per_1m' | 'currency' | 'price_unit'>; locale: string }) {
  const zh = locale === 'zh';
  const unit = PRICE_UNIT_INFO[row.price_unit]?.label[zh ? 'zh' : 'en'] ?? row.price_unit;
  return <div className="ap-rates">
    <div>{zh ? '输入' : 'Input'}: <Money value={row.input_price_per_1m} currency={row.currency} /></div>
    <div>{zh ? '输出' : 'Output'}: <Money value={row.output_price_per_1m} currency={row.currency} /></div>
    <div>{zh ? '缓存读取' : 'Cache read'}: <Money value={row.cached_input_price_per_1m} currency={row.currency} /></div>
    <div>{unit || (zh ? '单位未提供' : 'Unit not supplied')}</div>
  </div>;
}

function Provider({ row, locale, coupons }: { row: CatalogChannel; locale: string; coupons: Coupons }) {
  const p = row.providers;
  return <div className="ap-provider">
    {p.href ? <a href={p.href} rel={p.rel} target="_blank"
      {...outboundChannelDataset({ channelSlug: p.slug, channelType: p.type, modelSlug: row.model_slug })}>{p.name}</a> : <span>{p.name}</span>}
    <div>{p.type} · {p.region ?? (locale === 'zh' ? '地区未知' : 'Region unknown')}
      {locale === 'zh' && p.china ? ' · 中国大陆支持地区已核对' : ''}</div>
    <CouponBadge coupons={coupons[p.slug] ?? []} locale={locale} placement="api-pricing" channelSlug={p.slug}
      channelType={p.type} modelSlug={row.model_slug} size="xs" align="end" />
  </div>;
}

function ErrorMessage({ locale }: { locale: string }) {
  return <p role="alert" className="my-3 text-amber-800">{locale === 'zh' ? '价格暂时无法加载。请重试，或打开模型详情。' : 'Prices could not load. Retry, or open the model detail page.'}</p>;
}

function Variants({ row, slug, locale, query }: { row: CatalogChannel; slug: string; locale: string; query: CatalogQuery }) {
  const request = useCatalogRequest<VariantPage>();
  const [open, setOpen] = useState(false);
  const zh = locale === 'zh';
  const load = (offset: number) => {
    const params = catalogQueryParams({ ...query, offset });
    params.set('mode', 'variants'); params.set('slug', slug); params.set('channelId', String(row.id));
    return request.load(params);
  };
  const page = request.result?.page;
  return <div className="mt-2">
    <button type="button" className={control} disabled={request.loading} aria-expanded={open} onClick={() => {
      setOpen(!open); if (!open && !page) void load(0);
    }}>{row.variantCount} {zh ? '个报价变体' : 'price variants'}</button>
    {request.loading && <p role="status">{zh ? '加载中…' : 'Loading…'}</p>}
    {request.error && <><ErrorMessage locale={locale} /><button type="button" className={control} onClick={() => void request.retry()}>{zh ? '重试' : 'Retry'}</button></>}
    {open && page && <div className="my-3 space-y-3">
      {page.rows.map(v => <div key={v.id} className="rounded border p-3">
        <p className="font-medium">{v.variant_name} {v.is_headline ? (zh ? '（默认）' : '(Default)') : ''}</p>
        <p className="text-xs">{v.variant_kind}</p>
        <Rates row={v} locale={locale} />
        {v.constraints_json && <p className="text-xs">{String(v.constraints_json.time_window ?? '')} · {String(v.constraints_json.peak_schedule ?? '')}</p>}
      </div>)}
      <p className="text-xs">{page.offset + 1}–{page.offset + page.rows.length} / {page.total}</p>
      <button type="button" className={control} disabled={request.loading || page.offset === 0} onClick={() => void load(Math.max(0, page.offset - VARIANT_PAGE_SIZE))}>{zh ? '上一页' : 'Previous'}</button>{' '}
      <button type="button" className={control} disabled={request.loading || page.nextOffset === null} onClick={() => void load(page.nextOffset!)}>{zh ? '下一页' : 'Next'}</button>
    </div>}
  </div>;
}

function Channels({ row, locale, query }: { row: CatalogRow; locale: string; query: CatalogQuery }) {
  const request = useCatalogRequest<ChannelPage>();
  const page = request.result?.page;
  const zh = locale === 'zh';
  const load = (offset: number) => {
    const params = catalogQueryParams({ ...query, offset });
    params.set('mode', 'channels'); params.set('slug', row.slug);
    return request.load(params);
  };
  return <details aria-describedby="api-pricing-channels-help" onToggle={event => { if (event.currentTarget.open && !request.result && !request.loading) void load(0); }}>
    <summary>{zh ? '查看匹配渠道' : 'Compare matching channels'} ({row.channelCount})</summary>
    <a href={`/${locale}/models/${encodeURIComponent(row.slug)}`}>{zh ? '模型详情与订阅套餐' : 'Model details and subscription plans'}</a>
    {request.loading && <p role="status">{zh ? '加载中…' : 'Loading…'}</p>}
    {request.error && <><ErrorMessage locale={locale} /><button type="button" className={control} onClick={() => void request.retry()}>{zh ? '重试' : 'Retry'}</button></>}
    {page && <div className="my-3 space-y-3" aria-busy={request.loading}>
      {page.rows.map(cp => <div key={cp.id} className="rounded border p-3">
        <a className="text-blue-600 underline" href={`/${locale}/models/${encodeURIComponent(cp.model_slug)}`}>{cp.model_slug}</a>
        <p className="text-xs">{cp.variant?.join(' · ')}</p>
        {cp.member_shutdown_date && <p className="text-xs">{zh ? '退役日期' : 'Retirement date'}: {cp.member_shutdown_date}</p>}
        <Provider row={cp} locale={locale} coupons={request.result!.couponByProvider} />
        <Rates row={cp} locale={locale} />
        <CatalogTerms terms={cp} />
        <LimitedTimeOfferMark row={cp} locale={locale} now={new Date(page.requestedAt)} />
        {cp.notes && <p className="text-xs text-amber-800">{cp.notes}</p>}
        {cp.variantCount > 0 && <Variants key={`${cp.id}-${page.requestedAt}`} row={cp} slug={row.slug} locale={locale} query={query} />}
      </div>)}
      <p className="text-xs">{page.offset + 1}–{page.offset + page.rows.length} / {page.total}</p>
      <button type="button" className={control} disabled={request.loading || page.offset === 0} onClick={() => void load(Math.max(0, page.offset - CHANNEL_PAGE_SIZE))}>{zh ? '上一页' : 'Previous'}</button>{' '}
      <button type="button" className={control} disabled={request.loading || page.nextOffset === null} onClick={() => void load(page.nextOffset!)}>{zh ? '下一页' : 'Next'}</button>
    </div>}
  </details>;
}

export default function ApiPricingView({ locale, initialPage, initialQuery, couponByProvider, requestedAt }: {
  locale: string; initialPage: CatalogPage; initialQuery: CatalogQuery; couponByProvider: Coupons; requestedAt: string;
}) {
  const zh = locale === 'zh';
  const [query, setQuery] = useState(initialQuery);
  const request = useCatalogRequest<CatalogPage>(params => setQuery(parseCatalogRequest(params).query));
  const page = request.result?.page ?? initialPage;
  const coupons = request.result?.couponByProvider ?? couponByProvider;
  const at = request.result?.requestedAt ?? requestedAt;
  const update = (next: CatalogQuery) => request.load(catalogQueryParams(next));
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(event.currentTarget)) if (typeof value === 'string') params.set(key, value);
    params.set('q', (params.get('q') ?? '').replace(/[\u0000-\u001f\u007f]/g, ''));
    params.set('locale', locale);
    params.set('offset', '0');
    void update(parseCatalogRequest(params).query);
  }
  const href = (offset: number) => `/${locale}/api-pricing?${catalogQueryParams({ ...query, offset })}`;
  const navigate = (event: MouseEvent<HTMLAnchorElement>, offset: number) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); void update({ ...query, offset });
  };
  return <section className="api-pricing-catalog" aria-label={zh ? 'API 价格目录' : 'API pricing catalog'}>
    <style>{catalogStyles}</style>
    <form action={`/${locale}/api-pricing`} method="get" onSubmit={submit} className="mb-5 flex flex-wrap items-end gap-3">
      <label>{zh ? '搜索模型或渠道' : 'Search models or channels'}<br /><input name="q" maxLength={128} defaultValue={initialQuery.q} className={control} /></label>
      <label>{zh ? '排序' : 'Sort'}<br /><select name="sort" defaultValue={initialQuery.sort} className={control}>
        {(['selected', 'price', 'name', 'elo', 'latest', 'context'] as const).map((value, i) => <option key={value} value={value}>{(zh ? ['精选模型', '输入价格', '名称', 'Arena 分数', '最新', '上下文'] : ['Selected models', 'Input price', 'Name', 'Arena score', 'Latest', 'Context'])[i]}</option>)}
      </select></label>
      <label>{zh ? '方向' : 'Order'}<br /><select name="order" defaultValue={initialQuery.order} className={control}><option value="desc">{zh ? '降序' : 'Descending'}</option><option value="asc">{zh ? '升序' : 'Ascending'}</option></select></label>
      <label>{zh ? '地区' : 'Region'}<br /><select name="region" defaultValue={initialQuery.region} className={control}>{['all', 'global', 'china'].map(v => <option key={v} value={v}>{zh ? ({ all: '全部', global: '国际', china: '中国' } as Record<string, string>)[v] : v}</option>)}</select></label>
      <label>{zh ? '渠道类型' : 'Channel type'}<br /><select name="channel" defaultValue={initialQuery.channel} className={control}>{['all', 'official', 'cloud', 'aggregator', 'reseller'].map(v => <option key={v} value={v}>{zh ? ({ all: '全部', official: '官方', cloud: '云厂商', aggregator: '聚合', reseller: '分销' } as Record<string, string>)[v] : v}</option>)}</select></label>
      {zh && <label><input type="checkbox" name="china" value="1" defaultChecked={initialQuery.china} /> 仅中国大陆可用</label>}
      <label><input type="checkbox" name="promo" value="1" defaultChecked={initialQuery.promo} /> {zh ? '限时优惠' : 'Limited-time offers'}</label>
      <button className={control} disabled={request.loading}>{zh ? '更新结果' : 'Update results'}</button>
      <a className="text-sm text-blue-600 underline" href={`/${locale}/api-pricing`}>{zh ? '重置' : 'Reset'}</a>
    </form>
    <p className="mb-3 text-sm text-zinc-500">{zh ? '精选模型优先采用现有审核名单，再按 Arena 分数和模型标识排序。报价须属于本模型且满足全部渠道筛选条件；仅有匹配成员时不显示本模型价格。地区筛选依据渠道证据，不采用生产商所在地。批量及变体请展开查看。跨币种价格排序按固定汇率折算美元，按百万 token 统一单位。' : 'Selected models uses the existing reviewed selection, then Arena score and model slug. Each quote belongs to the linked model and matches every channel filter. Matching siblings alone do not establish its price. Region filters use channel evidence, not producer location. Expand for batch and variants. Price sorting uses fixed exchange rates to USD per million tokens.'}</p>
    <p role="status" className="my-3">{request.loading ? (zh ? '加载中…' : 'Loading…') : `${page.total} ${zh ? '个模型组' : 'model groups'} · ${page.rows.length ? page.offset + 1 : 0}–${page.offset + page.rows.length}`}</p>
    {request.error && <><ErrorMessage locale={locale} /><button type="button" className={control} onClick={() => void request.retry()}>{zh ? '重试' : 'Retry'}</button></>}
    <p id="api-pricing-channels-help" className="my-2 text-xs text-zinc-500">{zh ? '逐条显示满足当前筛选条件的渠道及原模型标识、地区、批量与缓存价格。模型详情包含其他渠道。' : 'Channels match the current filters and identify their model, region, batch and cache pricing. Model details include other channels.'}</p>
    <div className="overflow-x-auto" aria-busy={request.loading}>
      <table>
        <thead><tr>{(zh ? ['模型', '示例渠道', '原币种价格', '对比'] : ['Model', 'Quoted channel', 'Native prices', 'Compare']).map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
        <tbody>{page.rows.map(row => <Fragment key={row.slug}><tr>
          <td><a href={`/${locale}/models/${encodeURIComponent(row.slug)}`}>{row.name}</a>
            <p>{row.producer} · {row.slug}</p>
            {!!row.context && <p>{zh ? '上下文' : 'Context'}: {row.context.toLocaleString('en-US')}</p>}
            {row.shutdown && <p>{zh ? '退役日期' : 'Retirement date'}: {row.shutdown}</p>}
          </td>
          <td>{row.quote ? <Provider row={row.quote} locale={locale} coupons={coupons} /> : '—'}</td>
          <td>{row.quote ? <><Rates row={row.quote} locale={locale} /><CatalogTerms terms={row.quote} /><LimitedTimeOfferMark row={row.quote} locale={locale} now={new Date(at)} />{row.quote.notes && <p className="ap-note">{row.quote.notes}</p>}</> : (zh ? '本模型暂无匹配报价；请展开查看匹配的成员报价' : 'No matching canonical quote; expand for matching member prices')}</td>
          <td><Channels key={`${row.slug}-${catalogQueryParams(query)}`} row={row} locale={locale} query={query} /></td>
        </tr></Fragment>)}</tbody>
      </table>
    </div>
    {!page.rows.length && <p className="my-6">{zh ? '没有匹配的模型。请调整筛选条件。' : 'No matching models. Try different filters.'}</p>}
    <nav className="my-5 flex gap-4" aria-label={zh ? '价格目录分页' : 'Catalog pagination'}>
      {page.offset > 0 && <a className={control} href={href(Math.max(0, page.offset - CATALOG_PAGE_SIZE))} onClick={e => navigate(e, Math.max(0, page.offset - CATALOG_PAGE_SIZE))}>{zh ? '上一页' : 'Previous'}</a>}
      {page.nextOffset !== null && <a className={control} href={href(page.nextOffset)} onClick={e => navigate(e, page.nextOffset!)}>{zh ? '下一页' : 'Next'}</a>}
    </nav>
  </section>;
}
