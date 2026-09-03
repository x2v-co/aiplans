import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, CalendarDays, Database, RefreshCw } from 'lucide-react';
import SiteHeader from '@/components/SiteHeader';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatPrice } from '@/lib/currency';
import { getPriceIndexSnapshot } from '@/lib/api-price-index';
import { buildMetadata, jsonLd, SITE_NAME, SITE_URL, type Locale } from '@/lib/seo';

export const revalidate = 21600;

const title = {
  en: 'AI API Price Index: Models, Channels and Price Changes | aiplans.dev',
  zh: 'AI API 价格指数：模型、渠道与价格变化 | aiplans.dev',
};

const description = {
  en: 'A current, data-backed index of AI API token prices across models and providers, including the cheapest paid routes and recent price changes.',
  zh: '基于当前数据的 AI API token 价格指数，覆盖模型与供应渠道，并汇总最低付费路由及近期价格变化。',
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale: Locale = rawLocale === 'zh' ? 'zh' : 'en';
  return buildMetadata({ locale, path: '/reports/api-price-index', title, description });
}

function formatDate(value: Date | string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
    dateStyle: 'medium',
    timeZone: 'Asia/Singapore',
  }).format(new Date(value));
}

function formatUsd(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: value < 0.01 ? 4 : 2,
    maximumFractionDigits: 4,
  }).format(value);
}

export default async function ApiPriceIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale: Locale = rawLocale === 'zh' ? 'zh' : 'en';
  const snapshot = await getPriceIndexSnapshot();
  const dateModified = snapshot.verifiedAt ? new Date(snapshot.verifiedAt).toISOString() : undefined;
  const reportUrl = `${SITE_URL}/${locale}/reports/api-price-index`;
  const articleJsonLd = jsonLd({
    '@type': 'Article',
    headline: title[locale].replace(' | aiplans.dev', ''),
    description: description[locale],
    mainEntityOfPage: reportUrl,
    dateModified,
    author: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
    publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
  });
  const datasetJsonLd = jsonLd({
    '@type': 'Dataset',
    name: title[locale].replace(' | aiplans.dev', ''),
    description: description[locale],
    url: reportUrl,
    dateModified,
    creator: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
    includedInDataCatalog: { '@type': 'DataCatalog', name: SITE_NAME, url: SITE_URL },
    variableMeasured: ['Model', 'API provider', 'Input price per 1M tokens', 'Output price per 1M tokens'],
    measurementTechnique: 'Daily collection from provider pricing pages and verified API channels',
  });

  return (
    <div className="min-h-screen bg-zinc-50/60 dark:bg-zinc-950">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: articleJsonLd }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: datasetJsonLd }} />
      <SiteHeader locale={locale} />
      <main className="container mx-auto max-w-6xl px-4 py-10 md:py-14">
        <Link href={`/${locale}/guides`} className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-blue-600">
          <ArrowLeft className="h-4 w-4" />
          {locale === 'zh' ? '研究与指南' : 'Research and guides'}
        </Link>

        <header className="mt-7 max-w-4xl border-b pb-9">
          <p className="flex items-center gap-2 text-sm font-medium text-blue-600">
            <Database className="h-4 w-4" />
            {locale === 'zh' ? '市场数据报告' : 'Market data report'}
          </p>
          <h1 className="mt-3 text-3xl font-bold md:text-4xl">
            {locale === 'zh' ? 'AI API 价格指数' : 'AI API Price Index'}
          </h1>
          <p className="mt-4 text-base leading-7 text-zinc-600 dark:text-zinc-400">
            {locale === 'zh'
              ? '按统一口径汇总当前可用的 LLM API 渠道。价格保留供应商原始币种，并换算美元用于跨渠道排序；免费路由不参与最低付费价格榜。'
              : 'A consistent snapshot of currently available LLM API channels. Prices retain each provider’s billing currency and are normalized to USD for ranking; free routes are excluded from the lowest paid-price table.'}
          </p>
          {snapshot.verifiedAt && (
            <p className="mt-3 inline-flex items-center gap-1 text-xs text-zinc-500">
              <CalendarDays className="h-3.5 w-3.5" />
              {locale === 'zh' ? '最近数据核验：' : 'Latest data verification: '}
              {formatDate(snapshot.verifiedAt, locale)}
            </p>
          )}
        </header>

        <section className="grid grid-cols-1 gap-4 py-9 sm:grid-cols-3" aria-label={locale === 'zh' ? '数据覆盖' : 'Data coverage'}>
          {[
            { value: snapshot.modelCount, label: locale === 'zh' ? '个有价格模型' : 'priced models' },
            { value: snapshot.channelCount, label: locale === 'zh' ? '条可用渠道' : 'available channels' },
            { value: snapshot.providerCount, label: locale === 'zh' ? '家供应商' : 'providers' },
          ].map((stat) => (
            <div key={stat.label} className="border-l-2 border-blue-600 pl-4">
              <div className="text-3xl font-bold">{stat.value.toLocaleString()}</div>
              <div className="mt-1 text-sm text-zinc-500">{stat.label}</div>
            </div>
          ))}
        </section>

        <section className="border-t py-9" aria-labelledby="lowest-paid-prices">
          <div className="max-w-3xl">
            <h2 id="lowest-paid-prices" className="text-2xl font-semibold">
              {locale === 'zh' ? '最低付费输入价格' : 'Lowest paid input prices'}
            </h2>
            <p className="mt-3 leading-7 text-zinc-600 dark:text-zinc-400">
              {locale === 'zh'
                ? '每个主模型只保留当前最低价渠道。美元值仅用于排序，账单仍以供应商显示的原始币种为准。'
                : 'Each model identifier is represented by its lowest current channel. The USD value is only for ranking; billing remains in the provider’s displayed currency.'}
            </p>
          </div>
          <div className="mt-6 overflow-x-auto rounded-md border bg-white dark:bg-zinc-900">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{locale === 'zh' ? '模型' : 'Model'}</TableHead>
                  <TableHead>{locale === 'zh' ? '渠道' : 'Channel'}</TableHead>
                  <TableHead>{locale === 'zh' ? '输入 / 1M' : 'Input / 1M'}</TableHead>
                  <TableHead>{locale === 'zh' ? '输出 / 1M' : 'Output / 1M'}</TableHead>
                  <TableHead>{locale === 'zh' ? '美元换算' : 'USD normalized'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {snapshot.cheapestPaidModels.map((item) => (
                  <TableRow key={item.modelSlug}>
                    <TableCell className="font-medium">
                      <Link href={`/${locale}/models/${item.modelSlug}`} className="text-blue-600 hover:underline">
                        {item.modelName}
                      </Link>
                    </TableCell>
                    <TableCell>{item.providerName}</TableCell>
                    <TableCell>{formatPrice(item.inputPrice, item.currency, locale)}</TableCell>
                    <TableCell>{formatPrice(item.outputPrice, item.currency, locale)}</TableCell>
                    <TableCell>{formatUsd(item.inputUsd, locale)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>

        <section className="border-t py-9" aria-labelledby="recent-price-changes">
          <div className="max-w-3xl">
            <h2 id="recent-price-changes" className="flex items-center gap-2 text-2xl font-semibold">
              <RefreshCw className="h-5 w-5 text-emerald-600" />
              {locale === 'zh' ? '近期价格变化' : 'Recent price changes'}
            </h2>
            <p className="mt-3 leading-7 text-zinc-600 dark:text-zinc-400">
              {locale === 'zh'
                ? '以下为价格历史表中每个渠道最近一次显著价格变化。'
                : 'These records show the latest material change for each channel in the price history log.'}
            </p>
          </div>
          {snapshot.recentChanges.length > 0 ? (
            <div className="mt-6 overflow-x-auto rounded-md border bg-white dark:bg-zinc-900">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{locale === 'zh' ? '日期' : 'Date'}</TableHead>
                    <TableHead>{locale === 'zh' ? '模型' : 'Model'}</TableHead>
                    <TableHead>{locale === 'zh' ? '渠道' : 'Channel'}</TableHead>
                    <TableHead>{locale === 'zh' ? '输入价变化' : 'Input price change'}</TableHead>
                    <TableHead>{locale === 'zh' ? '幅度' : 'Change'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {snapshot.recentChanges.map((item, index) => (
                    <TableRow key={`${item.modelSlug}-${item.providerSlug}-${String(item.recordedAt)}-${index}`}>
                      <TableCell>{formatDate(item.recordedAt, locale)}</TableCell>
                      <TableCell>
                        <Link href={`/${locale}/models/${item.modelSlug}`} className="font-medium text-blue-600 hover:underline">
                          {item.modelName}
                        </Link>
                      </TableCell>
                      <TableCell>{item.providerName}</TableCell>
                      <TableCell>
                        {formatPrice(item.oldInputPrice, item.currency, locale)} {' -> '}
                        {formatPrice(item.newInputPrice, item.currency, locale)}
                      </TableCell>
                      <TableCell>
                        {item.changePercent == null ? '-' : (
                          <Badge variant="outline">{item.changePercent > 0 ? '+' : ''}{item.changePercent.toFixed(1)}%</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="mt-6 text-sm text-zinc-500">
              {locale === 'zh' ? '尚无显著价格变化记录。' : 'No material price changes have been recorded yet.'}
            </p>
          )}
        </section>

        <div className="flex flex-wrap gap-5 border-t pt-8 text-sm font-medium">
          <Link href={`/${locale}/api-pricing`} className="inline-flex items-center gap-1 text-blue-600 hover:underline">
            {locale === 'zh' ? '查看完整 API 价格表' : 'Browse the full API price table'} <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href={`/${locale}/methodology`} className="text-blue-600 hover:underline">
            {locale === 'zh' ? '阅读数据方法' : 'Read the methodology'}
          </Link>
        </div>
      </main>
    </div>
  );
}
