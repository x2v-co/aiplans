import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, GitCompareArrows, ReceiptText } from 'lucide-react';
import SiteHeader from '@/components/SiteHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getGroupedProducts, type GroupedProduct } from '@/lib/grouped-products';
import { getCheapestChannel, getCheapestOfficialChannel, usd } from '@/lib/channel-price-utils';
import { formatPrice, type CurrencyCode } from '@/lib/currency';
import { getProviderLogoSrc } from '@/lib/provider-branding';
import { formatModelName } from '@/lib/model-names';
import { buildMetadata, breadcrumbList, jsonLd, SITE_URL, type Locale } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return buildMetadata({
    locale: (locale === 'zh' ? 'zh' : 'en') as Locale,
    path: '/models',
    title: {
      en: 'General AI Model Catalog · GPT, Claude, Gemini, DeepSeek | aiplans.dev',
      zh: '通用大模型目录 · GPT、Claude、Gemini、DeepSeek | aiplans.dev',
    },
    description: {
      en: 'Browse general-purpose LLMs and reasoning models with provider, context window, benchmark signals, API channel coverage and lowest available API price.',
      zh: '浏览通用大模型与推理模型，包含供应商、上下文长度、benchmark 信号、API 渠道覆盖和最低可用 API 价格。',
    },
  });
}

function formatContext(ctx: number | null | undefined, locale: string): string {
  if (!ctx || ctx <= 0) return '—';
  if (ctx >= 1_000_000) {
    return `${(ctx / 1_000_000).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US', { maximumFractionDigits: 1 })}M`;
  }
  return `${Math.round(ctx / 1000).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US')}K`;
}

function lowestPriceLabel(model: GroupedProduct, locale: string): string {
  const cheapest = getCheapestChannel(model);
  if (!cheapest) return locale === 'zh' ? '暂无 API 价格' : 'No API price yet';
  return `${formatPrice(cheapest.input_price_per_1m, cheapest.currency || 'USD', locale)}/1M input`;
}

function savingsLabel(model: GroupedProduct, locale: string): string | null {
  const cheapest = getCheapestChannel(model);
  const official = getCheapestOfficialChannel(model);
  if (!cheapest || !official) return null;
  const cheapestUsd = usd(cheapest.input_price_per_1m, (cheapest.currency || 'USD') as CurrencyCode);
  const officialUsd = usd(official.input_price_per_1m, (official.currency || 'USD') as CurrencyCode);
  if (!cheapestUsd || !officialUsd || officialUsd <= cheapestUsd) return null;
  const pct = Math.round(((officialUsd - cheapestUsd) / officialUsd) * 100);
  return locale === 'zh' ? `较官方低 ${pct}%` : `${pct}% below official`;
}

function providerLogo(model: GroupedProduct): string | null {
  return getProviderLogoSrc(model.providers);
}

export default async function ModelsCatalogPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const isZh = locale === 'zh';
  const models = (await getGroupedProducts('llm'))
    .filter((model) => model.versions.length > 0 || model.benchmark_arena_elo != null)
    .sort((a, b) => {
      const aScore = a.benchmark_arena_elo ?? -1;
      const bScore = b.benchmark_arena_elo ?? -1;
      if (bScore !== aScore) return bScore - aScore;
      return b.versionCounts - a.versionCounts || a.name.localeCompare(b.name);
    });
  const featured = models.slice(0, 12);

  const crumbs = breadcrumbList([
    { name: isZh ? '首页' : 'Home', url: `${SITE_URL}/${locale}` },
    { name: isZh ? '通用大模型' : 'General LLMs', url: `${SITE_URL}/${locale}/models` },
  ]);
  const listJson = jsonLd({
    '@type': 'ItemList',
    name: isZh ? '通用大模型目录' : 'General AI model catalog',
    numberOfItems: models.length,
    itemListElement: featured.map((model, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: formatModelName(model.name),
      url: `${SITE_URL}/${locale}/models/${model.slug}`,
    })),
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: crumbs }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: listJson }} />
      <SiteHeader locale={locale} />
      <main className="container mx-auto px-4 py-14">
        <section className="mx-auto max-w-4xl text-center">
          <Badge variant="secondary" className="mb-4">{isZh ? '模型目录' : 'Model catalog'}</Badge>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            {isZh ? '通用大模型目录' : 'General AI model catalog'}
          </h1>
          <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            {isZh
              ? '浏览 GPT、Claude、Gemini、DeepSeek、Qwen 等通用 LLM 与推理模型。这里是目录入口；需要横向比较或找最低 API 价格时，再进入对比与价格页面。'
              : 'Browse general-purpose LLMs and reasoning models such as GPT, Claude, Gemini, DeepSeek and Qwen. This is the catalog entry; use compare and pricing pages when you need side-by-side analysis or the cheapest API channel.'}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href={`/${locale}/compare/models`}>
              <Button size="lg" className="gap-2">
                <GitCompareArrows className="h-4 w-4" />
                {isZh ? '对比通用模型' : 'Compare LLMs'}
              </Button>
            </Link>
            <Link href={`/${locale}/api-pricing`}>
              <Button size="lg" variant="outline" className="gap-2">
                <ReceiptText className="h-4 w-4" />
                {isZh ? '查看 API 价格' : 'API pricing'}
              </Button>
            </Link>
          </div>
        </section>

        <section className="mt-14 grid gap-4 sm:grid-cols-3">
          <Card><CardContent className="p-5"><div className="text-3xl font-bold">{models.length}</div><div className="mt-1 text-sm text-zinc-500">{isZh ? '可浏览模型' : 'cataloged models'}</div></CardContent></Card>
          <Card><CardContent className="p-5"><div className="text-3xl font-bold">{models.filter((model) => model.versions.length > 0).length}</div><div className="mt-1 text-sm text-zinc-500">{isZh ? '有 API 渠道价格' : 'with API channel prices'}</div></CardContent></Card>
          <Card><CardContent className="p-5"><div className="text-3xl font-bold">{models.filter((model) => model.benchmark_arena_elo != null).length}</div><div className="mt-1 text-sm text-zinc-500">{isZh ? '有 benchmark 信号' : 'with benchmark signals'}</div></CardContent></Card>
        </section>

        <section className="mt-12" aria-labelledby="general-models-heading">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 id="general-models-heading" className="text-2xl font-bold">{isZh ? '通用模型列表' : 'General model list'}</h2>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                {isZh ? '按 benchmark 信号、渠道覆盖和模型名称排序。点击任意模型查看完整渠道价格、套餐和详情。' : 'Sorted by benchmark signal, channel coverage and model name. Open any model for full channel pricing, plans and details.'}
              </p>
            </div>
            <Badge variant="outline">{models.length}</Badge>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {models.map((model) => {
              const logo = providerLogo(model);
              const savings = savingsLabel(model, locale);
              return (
                <Link key={model.slug} href={`/${locale}/models/${model.slug}`} className="group block h-full">
                  <Card className="h-full transition-colors hover:border-blue-300 hover:bg-blue-50/40 dark:hover:border-blue-800 dark:hover:bg-blue-950/20">
                    <CardContent className="flex h-full flex-col p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex min-w-0 items-center gap-3">
                          {/* Provider logos are user/content data and may be local ICOs or remote
                              vendor assets. Use a plain img here to avoid Next image optimizer
                              400s on production for otherwise-valid logo URLs. */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {logo && <img src={logo} alt="" width={36} height={36} className="h-9 w-9 shrink-0 rounded-lg object-contain" />}
                          <div className="min-w-0">
                            <h3 className="truncate text-lg font-semibold group-hover:text-blue-600">{formatModelName(model.name)}</h3>
                            <p className="truncate text-sm text-zinc-500">{model.providers?.name ?? (isZh ? '未知供应商' : 'Unknown provider')}</p>
                          </div>
                        </div>
                        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-zinc-400 transition-transform group-hover:translate-x-1 group-hover:text-blue-600" />
                      </div>

                      <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <div className="text-xs uppercase tracking-wide text-zinc-500">{isZh ? '上下文' : 'Context'}</div>
                          <div className="mt-1 font-medium">{formatContext(model.context_window, locale)}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-wide text-zinc-500">{isZh ? '渠道' : 'Channels'}</div>
                          <div className="mt-1 font-medium">{model.versionCounts}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-wide text-zinc-500">Benchmark</div>
                          <div className="mt-1 font-medium">{model.benchmark_arena_elo == null ? '—' : Math.round(model.benchmark_arena_elo).toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-wide text-zinc-500">{isZh ? '最低价' : 'Lowest price'}</div>
                          <div className="mt-1 font-medium">{lowestPriceLabel(model, locale)}</div>
                        </div>
                      </div>

                      <div className="mt-5 flex flex-wrap gap-2">
                        {model.hasGlobalVersion && <Badge variant="secondary">Global</Badge>}
                        {model.hasChinaVersion && <Badge variant="secondary">China</Badge>}
                        {savings && <Badge variant="outline">{savings}</Badge>}
                        {model.variantTags?.slice(0, 2).map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>)}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
