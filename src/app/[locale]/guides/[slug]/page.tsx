import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, CheckCircle2, Clock3 } from 'lucide-react';
import SiteHeader from '@/components/SiteHeader';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatPrice, type CurrencyCode } from '@/lib/currency';
import {
  PRICING_GUIDES,
  getPricingGuideModels,
  isPricingGuideSlug,
} from '@/lib/pricing-guides';
import { buildMetadata, jsonLd, SITE_NAME, SITE_URL, type Locale } from '@/lib/seo';

export const revalidate = 21600;

function formatUsd(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: value < 0.01 ? 4 : 2,
    maximumFractionDigits: 4,
  }).format(value);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params;
  if (!isPricingGuideSlug(slug)) return {};
  const locale: Locale = rawLocale === 'zh' ? 'zh' : 'en';
  const guide = PRICING_GUIDES[slug];
  return buildMetadata({
    locale,
    path: `/guides/${slug}`,
    title: { en: `${guide.title.en} | aiplans.dev`, zh: `${guide.title.zh} | aiplans.dev` },
    description: guide.description,
  });
}

export default async function PricingGuidePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: rawLocale, slug } = await params;
  if (!isPricingGuideSlug(slug)) notFound();
  const locale: Locale = rawLocale === 'zh' ? 'zh' : 'en';
  const guide = PRICING_GUIDES[slug];
  const models = await getPricingGuideModels(guide);
  const latestVerified = models
    .map((model) => model.lastVerified)
    .filter(Boolean)
    .sort((left, right) => new Date(right!).getTime() - new Date(left!).getTime())[0] ?? null;
  const updatedLabel = latestVerified
    ? new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', { dateStyle: 'medium' }).format(new Date(latestVerified))
    : null;
  const articleJsonLd = jsonLd({
    '@type': 'Article',
    headline: guide.title[locale],
    description: guide.description[locale],
    mainEntityOfPage: `${SITE_URL}/${locale}/guides/${slug}`,
    dateModified: latestVerified ? new Date(latestVerified).toISOString() : undefined,
    author: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
    publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
  });

  return (
    <div className="min-h-screen bg-zinc-50/60 dark:bg-zinc-950">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: articleJsonLd }} />
      <SiteHeader locale={locale} />
      <main className="container mx-auto max-w-6xl px-4 py-10 md:py-14">
        <Link href={`/${locale}/guides`} className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-blue-600">
          <ArrowLeft className="h-4 w-4" />
          {locale === 'zh' ? '全部指南' : 'All guides'}
        </Link>

        <header className="mt-7 max-w-4xl border-b pb-9">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{locale === 'zh' ? '实时价格研究' : 'Live pricing research'}</Badge>
            {updatedLabel && (
              <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                <Clock3 className="h-3.5 w-3.5" />
                {locale === 'zh' ? `数据核验 ${updatedLabel}` : `Data verified ${updatedLabel}`}
              </span>
            )}
          </div>
          <h1 className="mt-4 text-3xl font-bold md:text-4xl">{guide.title[locale]}</h1>
          <p className="mt-4 text-base leading-7 text-zinc-600 dark:text-zinc-400">{guide.intro[locale]}</p>
        </header>

        <section className="py-9" aria-labelledby="live-prices">
          <div className="max-w-3xl">
            <h2 id="live-prices" className="text-2xl font-semibold">
              {locale === 'zh' ? '当前 API 价格快照' : 'Current API price snapshot'}
            </h2>
            <p className="mt-3 leading-7 text-zinc-600 dark:text-zinc-400">
              {locale === 'zh'
                ? '最低价按当前汇率统一换算为美元后选择。示例成本使用 100 万输入 token 加 25 万输出 token，不含缓存、批处理折扣或额外费用。'
                : 'The lowest channel is selected after normalizing currencies to USD. Example cost uses 1M input plus 250K output tokens and excludes caching, batch discounts, and ancillary fees.'}
            </p>
          </div>

          <div className="mt-6 overflow-x-auto rounded-md border bg-white dark:bg-zinc-900">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{locale === 'zh' ? '模型' : 'Model'}</TableHead>
                  <TableHead>{locale === 'zh' ? '最低渠道' : 'Lowest channel'}</TableHead>
                  <TableHead>{locale === 'zh' ? '输入 / 1M' : 'Input / 1M'}</TableHead>
                  <TableHead>{locale === 'zh' ? '输出 / 1M' : 'Output / 1M'}</TableHead>
                  <TableHead>{locale === 'zh' ? '示例成本' : 'Example cost'}</TableHead>
                  <TableHead>{locale === 'zh' ? '渠道数' : 'Channels'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {models.map((model) => (
                  <TableRow key={model.slug}>
                    <TableCell className="font-medium">
                      <Link href={`/${locale}/models/${model.slug}`} className="text-blue-600 hover:underline">
                        {model.name}
                      </Link>
                    </TableCell>
                    <TableCell>{model.cheapest.providerName}</TableCell>
                    <TableCell>{formatPrice(model.cheapest.inputPrice, model.cheapest.currency as CurrencyCode, locale)}</TableCell>
                    <TableCell>
                      {model.cheapest.outputPrice == null
                        ? '-'
                        : formatPrice(model.cheapest.outputPrice, model.cheapest.currency as CurrencyCode, locale)}
                    </TableCell>
                    <TableCell className="font-medium">{formatUsd(model.exampleCostUsd, locale)}</TableCell>
                    <TableCell>{model.channelCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>

        <div className="grid border-y md:grid-cols-2 md:divide-x">
          {guide.sections.map((section) => (
            <section key={section.heading.en} className="py-8 md:px-8 first:pl-0 last:pr-0">
              <h2 className="text-xl font-semibold">{section.heading[locale]}</h2>
              <p className="mt-3 leading-7 text-zinc-600 dark:text-zinc-400">{section.body[locale]}</p>
            </section>
          ))}
        </div>

        <section className="py-9">
          <h2 className="text-xl font-semibold">{locale === 'zh' ? '如何使用这些数据' : 'How to use this data'}</h2>
          <ul className="mt-4 grid gap-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300 md:grid-cols-3">
            {[
              locale === 'zh' ? '按实际输入与输出 token 比例重新计算。' : 'Recalculate with your real input/output token mix.',
              locale === 'zh' ? '核对渠道地区、速率限制和支付方式。' : 'Check region, rate limits, and payment method.',
              locale === 'zh' ? '购买前打开模型详情中的来源链接复核。' : 'Verify the linked source before purchasing.',
            ].map((item) => (
              <li key={item} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <div className="flex flex-wrap gap-4 border-t pt-8 text-sm font-medium">
          <Link href={`/${locale}/api-pricing`} className="inline-flex items-center gap-1 text-blue-600 hover:underline">
            {locale === 'zh' ? '浏览全部 API 价格' : 'Browse all API prices'} <ArrowRight className="h-4 w-4" />
          </Link>
          {guide.providerSlugs.map((providerSlug) => (
            <Link key={providerSlug} href={`/${locale}/plans/${providerSlug}`} className="text-blue-600 hover:underline">
              {locale === 'zh' ? `${providerSlug} 套餐` : `${providerSlug} plans`}
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
