import Link from 'next/link';
import en from '../../messages/en.json';
import zh from '../../messages/zh.json';
import { CatalogProviderLogo } from '@/components/catalog-provider-logo';
import type { AiCatalogItem } from '@/lib/ai-vertical-catalog';

export function nonLlmCopy(locale: string) {
  return locale === 'zh' ? zh.nonLlmModels : en.nonLlmModels;
}

export function NonLlmFacts({ item, locale }: { item: AiCatalogItem; locale: string }) {
  const t = nonLlmCopy(locale);
  const label = (key: string) => t[key as keyof typeof t] ?? key;
  const priced = item.priceStatus === 'priced';
  return <section className="mt-6 space-y-3 rounded-xl border p-5">
    <h2 className="text-xl font-bold">{t.pricing}</h2>
    {item.usageRates?.length ? <dl className="grid gap-3 sm:grid-cols-2">
      {item.usageRates.map(rate => <div key={`${rate.priceKind}/${rate.unit}`}>
        <dt>{label(rate.priceKind)}</dt>
        <dd>{priced && Number.isFinite(rate.price) ? `${rate.approximate ? '≈' : ''}$${rate.price} / ${label(rate.unit)}` : t.needsVerification}</dd>
      </div>)}
    </dl> : <p>{priced ? item.pricing : t.needsVerification}</p>}
    <dl className="grid gap-3 sm:grid-cols-2">
      {item.pricingChannel && <div><dt>{t.channel}</dt><dd>{item.pricingChannel}</dd></div>}
      <div><dt>{t.verified}</dt><dd>{item.verifiedAt ?? '—'}</dd></div>
      {item.releasedAt && <div><dt>{t.released}</dt><dd>{item.releasedAt}</dd></div>}
      {item.deprecatedAt && <div><dt>{t.deprecated}</dt><dd>{item.deprecatedAt}</dd></div>}
      {item.shutdownDate && <div><dt>{t.shutdown}</dt><dd>{item.shutdownDate}</dd></div>}
      {item.replacementModel && <div><dt>{t.successor}</dt><dd>{item.replacementModel}</dd></div>}
    </dl>
    {item.slug === 'moondream-cloud' && <p>{t.visionNote}</p>}
    {item.notes && <p>{item.notes}</p>}
    {item.needsVerification?.map(note => <p key={note}>{t.needsVerification}: {note}</p>)}
    <div>{item.sourceUrls?.map(source => <a className="mr-4 text-blue-600 underline" key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.label}</a>)}</div>
  </section>;
}

export function NonLlmCatalog({ items, locale }: { items: AiCatalogItem[]; locale: string }) {
  const t = nonLlmCopy(locale);
  const label = (key: string) => t[key as keyof typeof t] ?? key;
  return <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{items.map(item => {
    const priced = item.priceStatus === 'priced';
    const rates = (item.usageRates ?? []).filter(rate => Number.isFinite(rate.price)).slice(0, 3);
    return <Link key={item.slug} href={`/${locale}/${item.kind}s/${item.slug}`} className="group block h-full min-w-0">
      <article className="flex h-full flex-col rounded-xl border bg-white p-5 transition-colors hover:border-blue-300 hover:bg-blue-50/40 dark:bg-zinc-950 dark:hover:border-blue-800 dark:hover:bg-blue-950/20">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <CatalogProviderLogo item={item} size={36} />
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold group-hover:text-blue-600">{item.name}</h2>
              <p className="truncate text-sm text-zinc-500">{item.provider}</p>
            </div>
          </div>
          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${item.status === 'available' ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300' : 'border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400'}`}>{item.status}</span>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          {priced && rates.length ? rates.map(rate => <div key={`${rate.priceKind}/${rate.unit}`} className="min-w-0">
            <dt className="truncate text-xs text-zinc-500">{label(rate.priceKind)}</dt>
            <dd className="truncate font-medium">{rate.approximate ? '≈' : ''}${rate.price} <span className="font-normal text-zinc-500">/ {label(rate.unit)}</span></dd>
          </div>) : <div className="col-span-2"><dt className="text-xs text-zinc-500">{t.pricing}</dt><dd className="line-clamp-2">{priced ? item.pricing : t.needsVerification}</dd></div>}
        </dl>
        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-4 text-xs text-zinc-500">
          {item.pricingChannel && <span>{t.channel}: {item.pricingChannel}</span>}
          <span>{t.verified}: {item.verifiedAt ?? '—'}</span>
        </div>
      </article>
    </Link>;
  })}</div>;
}
