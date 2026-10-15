import Link from 'next/link';
import en from '../../messages/en.json';
import zh from '../../messages/zh.json';
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
  return <div className="mt-8 grid gap-6 lg:grid-cols-2">{items.map(item => <article key={item.slug} className="rounded-xl border p-5">
    <h2 className="text-2xl font-bold"><Link className="text-blue-600 underline" href={`/${locale}/${item.kind}s/${item.slug}`}>{item.name}</Link></h2>
    <p className="mt-2">{item.provider} · {item.status}</p>
    <NonLlmFacts item={item} locale={locale} />
  </article>)}</div>;
}
