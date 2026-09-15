import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import SiteHeader from '@/components/SiteHeader';
import type { AiVerticalKind } from '@/lib/ai-verticals';
import { verticalPageCopy } from '@/lib/ai-verticals';
import { catalogForKind, isRigorousModelKind, type AiCatalogItem } from '@/lib/ai-vertical-catalog';
import { jsonLd, SITE_URL } from '@/lib/seo';

const CTA_LINKS: Record<AiVerticalKind, { primary: string; secondary: string }> = {
  agent: { primary: '/plans', secondary: '/compare/models' },
  'creative-plan': { primary: '/plans', secondary: '/video-models' },
  'video-model': { primary: '/api-pricing', secondary: '/creative-plans' },
  'music-model': { primary: '/creative-plans', secondary: '/video-models' },
  'world-model': { primary: '/video-models', secondary: '/compare/models' },
};

function detailHrefForItem(locale: string, kind: AiVerticalKind, item: AiCatalogItem): string | null {
  if (!item.slug) return null;
  if (kind === 'video-model') return `/${locale}/video-models/${item.slug}`;
  if (kind === 'music-model') return `/${locale}/music-models/${item.slug}`;
  if (kind === 'world-model') return `/${locale}/world-models/${item.slug}`;
  return null;
}

function findExampleHref(locale: string, kind: AiVerticalKind, catalog: AiCatalogItem[], provider: string, name: string): string | null {
  const normalizedProvider = provider.toLowerCase();
  const normalizedName = name.toLowerCase();
  const item = catalog.find((entry) =>
    entry.slug &&
    (entry.provider.toLowerCase() === normalizedProvider || normalizedProvider.includes(entry.provider.toLowerCase())) &&
    (entry.name.toLowerCase() === normalizedName || normalizedName.includes(entry.name.toLowerCase()) || entry.name.toLowerCase().includes(normalizedName))
  );
  return item ? detailHrefForItem(locale, kind, item) : null;
}

export default function VerticalLandingPage({
  locale,
  kind,
  initialCatalog,
}: {
  locale: string;
  kind: AiVerticalKind;
  initialCatalog?: AiCatalogItem[];
}) {
  const copy = verticalPageCopy(kind, locale);
  const links = CTA_LINKS[kind];
  const catalog = initialCatalog ?? catalogForKind(kind);
  const rigorousModelCatalog = isRigorousModelKind(kind);
  const catalogJson = jsonLd({
    '@type': 'ItemList',
    name: copy.title,
    numberOfItems: catalog.length,
    itemListElement: catalog.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      description: item.bestFor,
      url: `${SITE_URL}/${locale}/${kind === 'agent' ? 'agents' : `${kind}s`}`,
    })),
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: catalogJson }} />
      <SiteHeader locale={locale} />
      <main className="container mx-auto px-4 py-14">
        <section className="mx-auto max-w-4xl text-center">
          <Badge variant="secondary" className="mb-4">{copy.eyebrow}</Badge>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{copy.title}</h1>
          <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            {copy.description}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href={`/${locale}${links.primary}`}>
              <Button size="lg" className="gap-2">
                {copy.primaryCta}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href={`/${locale}${links.secondary}`}>
              <Button size="lg" variant="outline">{copy.secondaryCta}</Button>
            </Link>
          </div>
        </section>

        <section className="mt-16" aria-labelledby={`${kind}-cards-heading`}>
          <div className="mb-8 max-w-3xl">
            <h2 id={`${kind}-cards-heading`} className="text-2xl font-bold">{copy.cardsTitle}</h2>
            <p className="mt-3 leading-7 text-zinc-600 dark:text-zinc-400">{copy.cardsDescription}</p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {copy.cards.map((card) => {
              const Icon = card.icon;
              return (
                <Card key={card.title} className="h-full">
                  <CardContent className="flex h-full flex-col p-6">
                    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-bold">{card.title}</h3>
                    <p className="mt-3 flex-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{card.description}</p>
                    <div className="mt-5 flex flex-wrap gap-2">
                      {card.tags.map((tag) => (
                        <Badge key={tag} variant="outline">{tag}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <section className="mt-16" aria-labelledby={`${kind}-examples-heading`}>
          <div className="mb-6 flex items-center justify-between gap-4">
            <h2 id={`${kind}-examples-heading`} className="text-2xl font-bold">{copy.examplesTitle}</h2>
            <Badge variant="outline">{copy.examples.length}</Badge>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {copy.examples.map((example) => {
              const href = findExampleHref(locale, kind, catalog, example.provider, example.name);
              const card = (
                <Card key={`${example.provider}-${example.name}`} className="h-full transition-colors hover:border-blue-300 hover:bg-blue-50/40 dark:hover:border-blue-800 dark:hover:bg-blue-950/20">
                  <CardContent className="flex h-full flex-col p-5">
                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{example.provider}</p>
                    <h3 className="mt-1 text-lg font-bold">{example.name}</h3>
                    <p className="mt-3 flex-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{example.note}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {example.tags.map((tag) => (
                        <Badge key={tag} variant="secondary">{tag}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
              return href ? <Link key={`${example.provider}-${example.name}`} href={href} className="block h-full">{card}</Link> : card;
            })}
          </div>
        </section>

        {catalog.length > 0 && (
          <section className="mt-16" aria-labelledby={`${kind}-catalog-heading`}>
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <h2 id={`${kind}-catalog-heading`} className="text-2xl font-bold">
                  {locale === 'zh' ? '目录追踪' : 'Catalog tracker'}
                </h2>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  {rigorousModelCatalog
                    ? locale === 'zh'
                      ? '每条模型记录都标注输入/输出模态、访问方式、计价单位、价格置信度、官方来源和最后核验日期。'
                      : 'Each model row tracks modalities, access paths, pricing unit, price confidence, official sources and last verification date.'
                    : locale === 'zh'
                      ? 'V1 先追踪公开产品、单位和能力；精确价格经验证后进入套餐和 usage_prices 表。'
                      : 'V1 tracks public products, units and capabilities. Verified exact prices will move into plans and usage_prices.'}
                </p>
              </div>
              <Badge variant="outline">{catalog.length}</Badge>
            </div>
            <div className="overflow-hidden rounded-xl border bg-white dark:bg-zinc-950">
              <div className="grid grid-cols-12 gap-3 border-b bg-zinc-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
                <div className="col-span-4">{locale === 'zh' ? '产品' : 'Product'}</div>
                <div className="col-span-2 hidden sm:block">{locale === 'zh' ? '状态' : 'Status'}</div>
                <div className="col-span-3 hidden md:block">{locale === 'zh' ? '计价 / 访问' : 'Pricing / Access'}</div>
                <div className="col-span-8 sm:col-span-6 md:col-span-3">
                  {rigorousModelCatalog ? (locale === 'zh' ? '模态 / 来源' : 'Modalities / Source') : (locale === 'zh' ? '适合场景' : 'Best for')}
                </div>
              </div>
              {catalog.map((item) => {
                const detailHref = detailHrefForItem(locale, kind, item);
                return (
                <div key={`${item.provider}-${item.name}`} className="group relative grid grid-cols-12 gap-3 border-b px-4 py-4 transition-colors last:border-b-0 hover:bg-blue-50/50 dark:hover:bg-blue-950/20">
                  {detailHref && (
                    <Link href={detailHref} className="absolute inset-0 z-0" aria-label={`${locale === 'zh' ? '查看详情' : 'View details'}: ${item.name}`} />
                  )}
                  <div className="relative z-10 col-span-4 min-w-0 pointer-events-none">
                    <div className="truncate font-semibold">
                      {item.name}
                    </div>
                    <div className="truncate text-sm text-zinc-500">{item.provider}</div>
                    <div className="mt-2 flex flex-wrap gap-1 md:hidden">
                      {item.capabilities.slice(0, 2).map((capability) => (
                        <Badge key={capability} variant="outline">{capability}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className="relative z-10 col-span-2 hidden sm:block pointer-events-none">
                    <Badge variant={item.status === 'available' ? 'secondary' : 'outline'} className={item.status === 'discontinued' ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300' : undefined}>{item.status}</Badge>
                  </div>
                  <div className="relative z-10 col-span-3 hidden md:block text-sm text-zinc-600 dark:text-zinc-400 pointer-events-none">
                    <div>{item.pricingUnit ?? item.unit}</div>
                    <div className="mt-1 text-xs text-zinc-500">{item.pricing}</div>
                    {rigorousModelCatalog && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        <Badge variant="outline">{item.pricingConfidence}</Badge>
                        {item.access?.slice(0, 2).map((access) => (
                          <Badge key={access} variant="secondary">{access}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="pointer-events-none relative z-10 col-span-8 text-sm leading-6 text-zinc-600 sm:col-span-6 md:col-span-3 dark:text-zinc-400">
                    {rigorousModelCatalog ? (
                      <>
                        <div>
                          {(item.inputModalities ?? []).join(', ')} → {(item.outputModalities ?? []).join(', ')}
                        </div>
                        <div className="mt-1 text-xs text-zinc-500">
                          {locale === 'zh' ? '核验' : 'Verified'}: {item.lastVerified}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {item.sourceUrls?.slice(0, 2).map((source) => (
                            <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="pointer-events-auto relative z-20">
                              <Badge variant="outline">{source.publisher}</Badge>
                            </a>
                          ))}
                        </div>
                      </>
                    ) : (
                      <>
                        {item.bestFor}
                        <div className="mt-2 hidden flex-wrap gap-1 md:flex">
                          {item.capabilities.slice(0, 3).map((capability) => (
                            <Badge key={capability} variant="outline">{capability}</Badge>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          </section>
        )}

        <section className="mt-16 grid gap-6 lg:grid-cols-[1fr_0.8fr]">
          <Card>
            <CardContent className="p-6">
              <h2 className="text-2xl font-bold">{copy.metricsTitle}</h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {copy.metrics.map((metric) => (
                  <div key={metric} className="flex gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span>{metric}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card className="border-blue-200 bg-blue-50/60 dark:border-blue-900 dark:bg-blue-950/20">
            <CardContent className="p-6">
              <h2 className="text-2xl font-bold">{copy.noteTitle}</h2>
              <p className="mt-4 leading-7 text-zinc-700 dark:text-zinc-300">{copy.note}</p>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
