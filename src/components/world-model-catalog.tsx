import Image from 'next/image';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { WORLD_MODEL_RESEARCH_NOTES, type AiCatalogItem } from '@/lib/ai-vertical-catalog';
import { formatWorldMoney, worldModelLabels, worldModelMinuteCost, worldModelPrice, worldModelsByCostPerMinute } from '@/lib/world-model-pricing';
import { getVerticalProviderLogo } from '@/lib/vertical-provider-logos';

export function WorldModelWarnings({ item, locale }: { item: AiCatalogItem; locale: string }) {
  if (!item.needsVerification?.length) return null;
  return (
    <div className="mt-3 text-sm text-amber-800 dark:text-amber-300">
      <p className="font-semibold">{worldModelLabels(locale).warnings}</p>
      <ul className="mt-1 list-disc space-y-1 pl-5">
        {item.needsVerification.map((warning) => <li key={warning}>{warning}</li>)}
      </ul>
    </div>
  );
}

function PriceStatus({ item, locale }: { item: AiCatalogItem; locale: string }) {
  return <Badge variant="outline">{item.priceStatus ? worldModelLabels(locale)[item.priceStatus] : '—'}</Badge>;
}

function realtimeLabel(item: AiCatalogItem, locale: string): string {
  return item.realtime == null ? '—' : worldModelLabels(locale)[item.realtime ? 'yes' : 'no'];
}

export function WorldModelCatalog({ items, locale }: { items: AiCatalogItem[]; locale: string }) {
  const labels = worldModelLabels(locale);
  const costs = worldModelsByCostPerMinute(items);
  return (
    <>
      <div className="overflow-x-auto rounded-xl border bg-white dark:bg-zinc-950">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-zinc-50 dark:bg-zinc-900">
            <tr>{[labels.product, labels.priceStatus, labels.price, labels.cost, labels.resolution, labels.fps, labels.realtime, labels.license, labels.verified, labels.sources].map((label) => (
              <th key={label} scope="col" className="whitespace-nowrap px-4 py-3 font-semibold">{label}</th>
            ))}</tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const logo = item.providerLogoUrl ?? getVerticalProviderLogo(item.providerSlug);
              return (
              <tr key={item.slug} className="border-b align-top last:border-b-0">
                <th scope="row" className="min-w-72 px-4 py-4 font-normal">
                  <Link href={`/${locale}/world-models/${item.slug}`} className="flex items-center gap-2 font-semibold text-blue-600 hover:underline">
                    {logo && <Image src={logo} alt="" width={28} height={28} className="h-7 w-7 rounded-md object-contain" />}
                    {item.name}
                  </Link>
                  <p className="mt-1 text-zinc-500">{item.provider} · {item.status}</p>
                  <p className="mt-2">{item.pricing}</p>
                  {item.accessNote && <p className="mt-1 text-zinc-500">{item.accessNote}</p>}
                  <WorldModelWarnings item={item} locale={locale} />
                </th>
                <td className="px-4 py-4"><PriceStatus item={item} locale={locale} /></td>
                <td className="whitespace-nowrap px-4 py-4">{worldModelPrice(item, locale)}</td>
                <td className="whitespace-nowrap px-4 py-4">{worldModelMinuteCost(item, locale)}</td>
                <td className="px-4 py-4">{item.resolutionTier ?? '—'}</td>
                <td className="px-4 py-4">{item.fps ?? '—'}</td>
                <td className="px-4 py-4">{realtimeLabel(item, locale)}</td>
                <td className="min-w-40 px-4 py-4">{item.license ?? '—'}</td>
                <td className="whitespace-nowrap px-4 py-4">{item.verifiedAt ?? '—'}</td>
                <td className="px-4 py-4">{item.sourceUrls?.map((source) => (
                  <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="mb-2 block text-blue-600 hover:underline">{source.publisher}</a>
                )) ?? '—'}</td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <aside className="mt-6 rounded-xl border p-5" aria-label={labels.research}>
        <h3 className="text-lg font-bold">{labels.research}</h3>
        <ul className="mt-3 space-y-2 text-sm">
          {WORLD_MODEL_RESEARCH_NOTES.map((note) => (
            <li key={note.name}>
              <a href={note.url} target="_blank" rel="noreferrer" className="font-semibold text-blue-600 hover:underline">{note.name}</a>
              {' · '}{locale === 'zh' ? note.descriptionZh : note.description}
            </li>
          ))}
        </ul>
      </aside>
      <section className="mt-10" aria-labelledby="world-model-minute-cost-heading">
        <h3 id="world-model-minute-cost-heading" className="text-2xl font-bold">{labels.cost}</h3>
        <p className="mt-2 text-sm text-zinc-500">{labels.costNote}</p>
        <ol className="mt-4 space-y-2">
          {costs.map((item) => (
            <li key={item.slug} className="flex justify-between gap-4 rounded-lg border p-4">
              <Link href={`/${locale}/world-models/${item.slug}`} className="text-blue-600 hover:underline">{item.name}</Link>
              <span>{worldModelMinuteCost(item, locale)} / {locale === 'zh' ? '分钟' : 'minute'}</span>
            </li>
          ))}
        </ol>
        {costs.length === 0 && <p className="mt-4">—</p>}
      </section>
    </>
  );
}

export function WorldModelFacts({ item, locale }: { item: AiCatalogItem; locale: string }) {
  const labels = worldModelLabels(locale);
  const fields = [
    [labels.billingUnit, item.billingUnit ? labels[item.billingUnit] : '—'],
    [labels.price, worldModelPrice(item, locale)], [labels.currency, item.currency ?? '—'],
    [labels.cost, worldModelMinuteCost(item, locale)], [labels.resolution, item.resolutionTier ?? '—'],
    [labels.fps, item.fps ?? '—'], [labels.realtime, realtimeLabel(item, locale)],
    [labels.session, item.maxSessionLen ?? '—'], [labels.memory, item.memoryHorizon ?? '—'],
    [labels.output, item.outputType?.map((output) => labels[output]).join(', ') || '—'],
    [labels.access, item.accessNote ?? '—'], [labels.license, item.license ?? '—'],
    [labels.hardware, item.selfHostHw ?? '—'], [labels.verified, item.verifiedAt ?? '—'],
  ];
  return (
    <section className="mt-10 rounded-xl border p-6" aria-label={labels.priceStatus}>
      <h2 className="mb-5 text-2xl font-bold">{labels.priceStatus} <PriceStatus item={item} locale={locale} /></h2>
      <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map(([label, value]) => (
          <div key={label}><dt className="text-sm text-zinc-500">{label}</dt><dd className="mt-1 font-medium">{value}</dd></div>
        ))}
      </dl>
      <WorldModelWarnings item={item} locale={locale} />
      {!!item.benchmarkSummaries?.length && (
        <div className="mt-5 flex flex-wrap gap-2">
          {item.benchmarkSummaries.map((summary) => (
            <Badge key={`${summary.benchmarkSlug}-${summary.taskName}-${summary.metricName}`} variant="secondary">
              {summary.benchmarkName} · {summary.taskName} · {summary.metricName}: {summary.value}{summary.unit === 'percent' ? '%' : ` ${summary.unit ?? ''}`}
            </Badge>
          ))}
        </div>
      )}
    </section>
  );
}

export function WorldModelTiers({ item, locale }: { item: AiCatalogItem; locale: string }) {
  const labels = worldModelLabels(locale);
  return (
    <section className="mt-10 rounded-xl border p-6">
      <h2 className="text-2xl font-bold">{labels.tiers}</h2>
      {item.planTiers?.length ? (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {item.planTiers.map((tier) => (
            <div key={tier.name} className="rounded-lg border p-4 text-sm">
              <h3 className="font-semibold">{tier.name}</h3>
              <p className="mt-2">{formatWorldMoney(tier.price, tier.currency, locale)}</p>
              <p className="mt-2">{labels.credits}: {tier.credits?.toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US') ?? '—'}</p>
              {tier.note && <p className="mt-2 text-zinc-500">{tier.note}</p>}
            </div>
          ))}
        </div>
      ) : <p className="mt-5">—</p>}
    </section>
  );
}
