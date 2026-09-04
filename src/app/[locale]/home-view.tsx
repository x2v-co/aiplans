'use client';

import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, BarChart3, BookOpen, GitCompare, DollarSign, Globe, HelpCircle, Sparkles } from "lucide-react";
import SiteHeader from '@/components/SiteHeader';

export type HotModel = {
  slug: string;
  name: string;
  benchmark_arena_elo: number | null;
  released_at?: string | null;
  created_at?: string | null;
};
type FaqItem = { question: string; answer: string };

/**
 * The landing page markup. Still a client component for the language switcher
 * and the translation hook, but `hotModels` is a prop now: fetching it in an
 * effect meant the four links into /compare/plans/[model] — the site's only
 * homepage links to those pages — were invisible to crawlers.
 */
export default function HomeView({
  locale,
  hotModels,
  latestModels,
  faqs,
}: {
  locale: string;
  hotModels: HotModel[];
  latestModels: HotModel[];
  faqs: FaqItem[];
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900">
      <SiteHeader locale={locale} />

      {/* Hero Section */}
      <main className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold mb-6">
            {locale === 'zh' ? (
              <>主流 AI 模型与渠道价格对比</>
            ) : (
              <>Compare Leading AI Models and API Channels</>
            )}
          </h1>
          <p className="text-xl text-zinc-600 dark:text-zinc-400 mb-8 max-w-2xl mx-auto">
            {locale === 'zh' ? (
              '先比较各厂当前领先模型的性能与成本，再为选定模型找到最合适的 API 渠道。'
            ) : (
              'Compare each vendor’s current leading model, then find the best API channel for the model you choose.'
            )}
          </p>
          <div className="flex gap-4 justify-center">
            <Link href={`/${locale}/compare/models`}>
              <Button size="lg" className="gap-2">
                {locale === 'zh' ? '比较各厂领先模型' : 'Compare Vendor Leaders'}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href={`/${locale}/api-pricing`}>
              <Button size="lg" variant="outline">
                {locale === 'zh' ? '查看 API 价格' : 'View API Pricing'}
              </Button>
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <Card>
            <CardContent className="p-6 text-center">
              <GitCompare className="w-12 h-12 mx-auto mb-4 text-blue-600" />
              <h3 className="text-lg font-bold mb-2">
                {locale === 'zh' ? '全面对比' : 'Comprehensive Comparison'}
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {locale === 'zh'
                  ? '对比官方和第三方渠道的价格、限速、性能等关键指标'
                  : 'Compare prices, rate limits, and performance across official and third-party channels'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 text-center">
              <DollarSign className="w-12 h-12 mx-auto mb-4 text-green-600" />
              <h3 className="text-lg font-bold mb-2">
                {locale === 'zh' ? '省钱神器' : 'Save Money'}
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {locale === 'zh'
                  ? '找到最优惠的供应商，节省高达 70% 的 API 成本'
                  : 'Find the cheapest providers and save up to 70% on API costs'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 text-center">
              <Globe className="w-12 h-12 mx-auto mb-4 text-purple-600" />
              <h3 className="text-lg font-bold mb-2">
                {locale === 'zh' ? '国内可用' : 'China Accessible'}
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {locale === 'zh'
                  ? '标注国内可直连的渠道，支持支付宝/微信支付'
                  : 'Mark channels accessible from China with Alipay/WeChat support'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Recently released / first-seen models */}
        {latestModels.length > 0 && (
          <section className="mb-16" aria-labelledby="latest-models-heading">
            <div className="mb-6 flex items-center justify-between gap-4">
              <h2 id="latest-models-heading" className="flex items-center gap-2 text-2xl font-bold">
                <Sparkles className="h-6 w-6 text-emerald-600" />
                {locale === 'zh' ? '最新收录模型' : 'Recently Added Models'}
              </h2>
              <Link href={`/${locale}/api-pricing`} className="text-sm font-medium text-blue-600 hover:underline">
                {locale === 'zh' ? '查看全部' : 'View all'}
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {latestModels.slice(0, 4).map((model) => {
                const date = model.released_at ?? model.created_at;
                return (
                  <Link key={model.slug} href={`/${locale}/models/${model.slug}`}>
                    <Card className="h-full transition-shadow hover:shadow-lg">
                      <CardContent className="p-5">
                        <h3 className="font-bold">{model.name}</h3>
                        {date && (
                          <p className="mt-2 text-xs text-zinc-500">
                            {model.released_at
                              ? locale === 'zh' ? '发布时间' : 'Released'
                              : locale === 'zh' ? '收录时间' : 'Added'}{' '}
                            {new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
                              dateStyle: 'medium',
                              timeZone: 'Asia/Singapore',
                            }).format(new Date(date))}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        <section className="mb-16 border-y py-10" aria-labelledby="pricing-research-heading">
          <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <h2 id="pricing-research-heading" className="text-2xl font-bold">
                {locale === 'zh' ? '价格研究与市场数据' : 'Pricing research and market data'}
              </h2>
              <p className="mt-3 max-w-3xl leading-7 text-zinc-600 dark:text-zinc-400">
                {locale === 'zh'
                  ? '先用跨厂商横评确定模型，再深入查看该模型在官方、云厂商和聚合渠道的实际价格。历史价格作为趋势和迁移参考保留。'
                  : 'Choose a model through the cross-vendor comparison, then inspect its prices across official, cloud, and aggregator channels. Price history remains available for trend and migration research.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href={`/${locale}/compare/models`}>
                <Button variant="outline" className="gap-2">
                  <GitCompare className="h-4 w-4" />
                  {locale === 'zh' ? '旗舰模型横评' : 'Leading model comparison'}
                </Button>
              </Link>
              <Link href={`/${locale}/guides`}>
                <Button variant="outline" className="gap-2">
                  <BookOpen className="h-4 w-4" />
                  {locale === 'zh' ? '价格指南' : 'Pricing guides'}
                </Button>
              </Link>
              <Link href={`/${locale}/reports/api-price-index`}>
                <Button variant="outline" className="gap-2">
                  <BarChart3 className="h-4 w-4" />
                  {locale === 'zh' ? 'API 价格指数' : 'API Price Index'}
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Hot Models */}
        <div className="text-center">
          <h2 className="text-3xl font-bold mb-8">
            {locale === 'zh' ? '高性能模型渠道比价' : 'Channel Prices for Top Models'}
          </h2>
          <div className="grid md:grid-cols-4 gap-4">
            {hotModels.map((model) => (
              <Link key={model.slug} href={`/${locale}/models/${model.slug}`}>
                <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                  <CardContent className="p-6 text-center">
                    <h3 className="font-bold mb-2">
                      {model.name}
                    </h3>
                    <Button variant="outline" size="sm" className="w-full">
                      {locale === 'zh' ? '查看渠道价格' : 'Compare Channels'}
                    </Button>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* FAQ — visible mirror of the FAQPage JSON-LD emitted by page.tsx. */}
        {faqs.length > 0 && (
          <div className="mt-20 max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold mb-8 text-center flex items-center justify-center gap-2">
              <HelpCircle className="w-7 h-7 text-blue-600" />
              {locale === 'zh' ? '常见问题' : 'Frequently asked questions'}
            </h2>
            <div className="grid gap-4">
              {faqs.map((faq, i) => (
                <Card key={i}>
                  <CardContent className="py-4">
                    <h3 className="font-semibold mb-1">{faq.question}</h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                      {faq.answer}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
