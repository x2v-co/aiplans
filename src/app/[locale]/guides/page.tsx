import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BarChart3 } from 'lucide-react';
import SiteHeader from '@/components/SiteHeader';
import { buildMetadata, type Locale } from '@/lib/seo';
import { PRICING_GUIDES, PRICING_GUIDE_SLUGS } from '@/lib/pricing-guides';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale: Locale = rawLocale === 'zh' ? 'zh' : 'en';
  return buildMetadata({
    locale,
    path: '/guides',
    title: {
      en: 'AI API Pricing Guides and Research | aiplans.dev',
      zh: 'AI API 价格指南与研究 | aiplans.dev',
    },
    description: {
      en: 'Data-backed guides to AI API token pricing, subscription plans, provider channels, and workload costs.',
      zh: '基于实时数据的 AI API token 价格、订阅套餐、供应渠道和工作负载成本指南。',
    },
  });
}

export default async function GuidesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale: Locale = rawLocale === 'zh' ? 'zh' : 'en';

  return (
    <div className="min-h-screen bg-zinc-50/60 dark:bg-zinc-950">
      <SiteHeader locale={locale} />
      <main className="container mx-auto max-w-5xl px-4 py-12 md:py-16">
        <header className="border-b pb-9">
          <p className="flex items-center gap-2 text-sm font-medium text-blue-600">
            <BarChart3 className="h-4 w-4" />
            {locale === 'zh' ? '研究与指南' : 'Research and guides'}
          </p>
          <h1 className="mt-3 text-3xl font-bold md:text-4xl">
            {locale === 'zh' ? 'AI 价格研究' : 'AI pricing research'}
          </h1>
          <p className="mt-4 max-w-3xl leading-7 text-zinc-600 dark:text-zinc-400">
            {locale === 'zh'
              ? '把实时价格表转化为可执行的选型信息。每份指南都明确区分 API 与订阅、官方与第三方渠道，并给出可复算的 token 用量示例。'
              : 'Turn live price tables into purchasing decisions. Each guide separates APIs from subscriptions, official routes from third-party channels, and includes a reproducible token workload example.'}
          </p>
        </header>

        <section className="grid gap-4 py-9 md:grid-cols-2">
          {PRICING_GUIDE_SLUGS.map((slug) => {
            const guide = PRICING_GUIDES[slug];
            return (
              <article key={slug} className="rounded-md border bg-white p-6 dark:bg-zinc-900">
                <h2 className="text-lg font-semibold">{guide.title[locale]}</h2>
                <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                  {guide.description[locale]}
                </p>
                <Link
                  href={`/${locale}/guides/${slug}`}
                  className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
                >
                  {locale === 'zh' ? '阅读指南' : 'Read guide'}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </article>
            );
          })}
        </section>

        <section className="border-t py-9">
          <h2 className="text-xl font-semibold">
            {locale === 'zh' ? '全市场价格指数' : 'Market-wide price index'}
          </h2>
          <p className="mt-3 max-w-3xl leading-7 text-zinc-600 dark:text-zinc-400">
            {locale === 'zh'
              ? '查看全站模型、渠道、币种换算和近期价格变化的汇总快照。'
              : 'See the market snapshot across models, channels, normalized currencies, and recent price changes.'}
          </p>
          <Link
            href={`/${locale}/reports/api-price-index`}
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
          >
            {locale === 'zh' ? '打开 API Price Index' : 'Open the API Price Index'}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      </main>
    </div>
  );
}
