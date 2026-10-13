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
  latestGuideDate,
  getPricingGuideModels,
  isPricingGuideSlug,
} from '@/lib/pricing-guides';
import { breadcrumbList, buildMetadata, faqPage, jsonLd, SITE_NAME, SITE_URL, type Locale } from '@/lib/seo';

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
  const models = guide.priceTable === false ? [] : await getPricingGuideModels(guide);
  const latestVerified = models
    .map((model) => model.lastVerified)
    .filter(Boolean)
    .sort((left, right) => new Date(right!).getTime() - new Date(left!).getTime())[0] ?? null;
  const updatedLabel = latestVerified
    ? new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', { dateStyle: 'medium' }).format(new Date(latestVerified))
    : null;
  const faqs = (guide.faqs ?? []).map((faq) => ({
    question: faq.question[locale],
    answer: faq.answer[locale],
  }));
  const breadcrumbJsonLd = breadcrumbList([
    { name: SITE_NAME, url: `${SITE_URL}/${locale}` },
    { name: locale === 'zh' ? '价格指南' : 'Pricing guides', url: `${SITE_URL}/${locale}/guides` },
    { name: guide.title[locale], url: `${SITE_URL}/${locale}/guides/${slug}` },
  ]);
  const articleJsonLd = jsonLd({
    '@type': 'Article',
    headline: guide.title[locale],
    description: guide.description[locale],
    mainEntityOfPage: `${SITE_URL}/${locale}/guides/${slug}`,
    dateModified: latestGuideDate(guide.reviewedAt, latestVerified),
    inLanguage: locale === 'zh' ? 'zh-CN' : 'en',
    citation: guide.sources?.map((source) => source.url),
    author: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
    publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
  });

  return (
    <div className="min-h-screen bg-zinc-50/60 dark:bg-zinc-950">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: articleJsonLd }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />
      {faqs.length > 0 && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqPage(faqs) }} />
      )}
      <SiteHeader locale={locale} />
      <main className="container mx-auto max-w-6xl px-4 py-10 md:py-14">
        <Link href={`/${locale}/guides`} className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-blue-600">
          <ArrowLeft className="h-4 w-4" />
          {locale === 'zh' ? '全部指南' : 'All guides'}
        </Link>

        <header className="mt-7 max-w-4xl border-b pb-9">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">
              {guide.priceTable === false
                ? (locale === 'zh' ? '订阅套餐对比' : 'Subscription plan comparison')
                : (locale === 'zh' ? '实时价格研究' : 'Live pricing research')}
            </Badge>
            {updatedLabel && (
              <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                <Clock3 className="h-3.5 w-3.5" />
                {locale === 'zh' ? `所列渠道最近核验 ${updatedLabel}` : `Latest listed-channel verification ${updatedLabel}`}
              </span>
            )}
          </div>
          <h1 className="mt-4 text-3xl font-bold md:text-4xl">{guide.title[locale]}</h1>
          <p className="mt-4 text-base leading-7 text-zinc-600 dark:text-zinc-400">{guide.intro[locale]}</p>
        </header>

        <nav aria-label={locale === 'zh' ? '价格对比入口' : 'Pricing comparison links'} className="mt-7 flex flex-wrap gap-4 rounded-md border border-blue-200 bg-blue-50 p-5 dark:border-blue-900 dark:bg-blue-950/30">
          <Link href={`/${locale}/compare/models`} className="inline-flex items-center gap-2 font-semibold text-blue-700 hover:underline dark:text-blue-400">
            {locale === 'zh' ? '对比渠道' : 'Compare channels'} <ArrowRight className="h-4 w-4" />
          </Link>
          {guide.priceTable === false && (
            <Link href={`/${locale}/compare/plans`} className="inline-flex items-center gap-2 font-semibold text-blue-700 hover:underline dark:text-blue-400">
              {locale === 'zh' ? '对比订阅套餐' : 'Compare subscription plans'} <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </nav>

        {guide.priceTable !== false && (
          <section className="py-9" aria-labelledby="live-prices">
            <div className="max-w-3xl">
              <h2 id="live-prices" className="text-2xl font-semibold">
                {locale === 'zh' ? '当前 API 价格快照' : 'Current API price snapshot'}
              </h2>
              <p className="mt-3 leading-7 text-zinc-600 dark:text-zinc-400">
                {locale === 'zh'
                  ? '最多展示 12 个已追踪的语言模型，按美元换算后的最低输入单价选择渠道，不代表总成本最低。示例用量为 100 万输入加 25 万输出 token；不额外应用缓存、批处理或上下文档位调整，也不含工具等费用。不同处理模式的版本不可直接等同，输出价未知时不计算总额。'
                  : 'Up to 12 tracked language models are shown. Channels are selected by lowest input rate normalized to USD, not lowest total cost. Examples use 1M input plus 250K output tokens, without additional cache, batch or context-tier adjustments or tool fees. Processing-mode variants are not interchangeable; no total is shown when output pricing is unknown.'}
              </p>
            </div>

            <div className="mt-6 overflow-x-auto rounded-md border bg-white dark:bg-zinc-900">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{locale === 'zh' ? '模型' : 'Model'}</TableHead>
                    <TableHead>{locale === 'zh' ? '最低输入价渠道' : 'Lowest-input-rate channel'}</TableHead>
                    <TableHead>{locale === 'zh' ? '输入 / 1M' : 'Input / 1M'}</TableHead>
                    <TableHead>{locale === 'zh' ? '输出 / 1M' : 'Output / 1M'}</TableHead>
                    <TableHead>{locale === 'zh' ? '示例成本（USD）' : 'Example cost (USD)'}</TableHead>
                    <TableHead>{locale === 'zh' ? '渠道数' : 'Channels'}</TableHead>
                    <TableHead>{locale === 'zh' ? '该报价核验日期' : 'Selected price verified'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {models.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-zinc-500">
                        {locale === 'zh' ? '暂无可用的 token 报价，请核对官方来源。' : 'No token prices are currently available. Check the official sources.'}
                      </TableCell>
                    </TableRow>
                  )}
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
                      <TableCell className="font-medium">
                        {model.exampleCostUsd == null
                          ? (locale === 'zh' ? '无法估算' : 'Unavailable')
                          : formatUsd(model.exampleCostUsd, locale)}
                      </TableCell>
                      <TableCell>{model.channelCount}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {model.lastVerified
                          ? new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', { dateStyle: 'medium' }).format(new Date(model.lastVerified))
                          : (locale === 'zh' ? '未知' : 'Unknown')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        )}

        {guide.planTable && (
          <section className="py-9" aria-labelledby="plan-comparison">
            <h2 id="plan-comparison" className="text-2xl font-semibold">
              {locale === 'zh' ? '新旧订阅套餐对比' : 'New and legacy subscription plans'}
            </h2>
            <p className="mt-3 max-w-3xl leading-7 text-zinc-600 dark:text-zinc-400">
              {locale === 'zh'
                ? '静态月费对比，币种为 USD，不含税。新套餐倍数描述 Cursor/Grok 共享用量，不是第三方模型额度；旧个人套餐列出的金额为第三方 Other Models 内含用量。购买或切换前请复核官方来源。'
                : 'Static monthly prices in USD, excluding tax. New-plan multiples describe the shared Cursor/Grok pool, not a third-party allowance; legacy individual-plan amounts describe included Other Models usage. Recheck official sources before purchasing or switching.'}
            </p>
            <div className="mt-6 overflow-x-auto rounded-md border bg-white dark:bg-zinc-900">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{locale === 'zh' ? '套餐' : 'Plan'}</TableHead>
                    <TableHead>{locale === 'zh' ? '月费（USD）' : 'Monthly price (USD)'}</TableHead>
                    <TableHead>{locale === 'zh' ? '内含用量' : 'Included usage'}</TableHead>
                    <TableHead>{locale === 'zh' ? '第三方模型' : 'Third-party models'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {guide.planTable.map((row) => (
                    <TableRow key={row.plan.en}>
                      <TableCell className="font-medium">{row.plan[locale]}</TableCell>
                      <TableCell className="whitespace-nowrap">{row.monthlyPrice[locale]}</TableCell>
                      <TableCell>{row.includedUsage[locale]}</TableCell>
                      <TableCell>{row.thirdPartyModels[locale]}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        )}

        <div className="divide-y border-y">
          {guide.sections.map((section) => (
            <section key={section.heading.en} className="max-w-4xl py-8">
              <h2 className="text-xl font-semibold">{section.heading[locale]}</h2>
              <p className="mt-3 leading-7 text-zinc-600 dark:text-zinc-400">{section.body[locale]}</p>
            </section>
          ))}
        </div>

        <section className="py-9">
          <h2 className="text-xl font-semibold">{locale === 'zh' ? '如何使用这些数据' : 'How to use this data'}</h2>
          <ul className="mt-4 grid gap-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300 md:grid-cols-3">
            {[
              guide.priceTable === false
                ? (locale === 'zh' ? '按实际第三方模型支出与内含额度重新计算。' : 'Recalculate with actual third-party spending and included allowances.')
                : (locale === 'zh' ? '按实际输入与输出 token 比例重新计算。' : 'Recalculate with your real input/output token mix.'),
              guide.priceTable === false
                ? (locale === 'zh' ? '核对每周限额、税费和切换规则。' : 'Check weekly limits, taxes and switching rules.')
                : (locale === 'zh' ? '核对渠道地区、速率限制和支付方式。' : 'Check region, rate limits, and payment method.'),
              locale === 'zh' ? '购买或切换前复核官方来源。' : 'Recheck official sources before purchasing or switching.',
            ].map((item) => (
              <li key={item} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {faqs.length > 0 && (
          <section className="max-w-4xl border-t py-9" aria-labelledby="guide-faq">
            <h2 id="guide-faq" className="text-2xl font-semibold">{locale === 'zh' ? '常见问题' : 'Frequently asked questions'}</h2>
            <div className="mt-5 space-y-6">
              {faqs.map((faq, index) => (
                <div key={`${index}-${faq.question}`}>
                  <h3 className="font-semibold">{faq.question}</h3>
                  <p className="mt-2 leading-7 text-zinc-600 dark:text-zinc-400">{faq.answer}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {guide.sources && (
          <section className="border-t py-9" aria-labelledby="guide-sources">
            <h2 id="guide-sources" className="text-xl font-semibold">{locale === 'zh' ? '官方来源与核对日期' : 'Official sources and review date'}</h2>
            {guide.reviewedAt && (
              <p className="mt-3 text-sm text-zinc-500">
                {locale === 'zh' ? '本文计费规则核对日期：' : 'Billing guidance reviewed: '}
                <time dateTime={guide.reviewedAt}>{guide.reviewedAt}</time>
                {guide.priceTable !== false && (locale === 'zh' ? '。价格快照的核验日期单独列于表格中。' : '. Price verification dates are listed separately in the table.')}
              </p>
            )}
            <ul className="mt-4 space-y-3">
              {guide.sources.map((source) => (
                <li key={source.url}>
                  <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{source.label[locale]}</a>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="flex flex-wrap gap-4 border-t pt-8 text-sm font-medium">
          <Link href={`/${locale}/calculator`} className="text-blue-600 hover:underline">
            {locale === 'zh' ? '按实际用量计算 API 成本' : 'Calculate API cost for your workload'}
          </Link>
          <Link href={`/${locale}/methodology`} className="text-blue-600 hover:underline">
            {locale === 'zh' ? '价格数据来源与方法' : 'Pricing sources and methodology'}
          </Link>
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
