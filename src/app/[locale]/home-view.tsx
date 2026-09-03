'use client';

import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, GitCompare, DollarSign, Globe, HelpCircle, Sparkles } from "lucide-react";
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useTranslations } from '@/lib/translations';

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
  const t = useTranslations('nav');

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50 dark:bg-black/80">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href={`/${locale}`} className="flex items-center gap-2">
            <span className="text-2xl">💰</span>
            <span className="text-xl font-bold">aiplans.dev</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link href={`/${locale}`} className="text-sm font-medium text-blue-600">
              {t('home')}
            </Link>
            <Link href={`/${locale}/compare/plans`} className="text-sm font-medium hover:text-blue-600">
              {t('comparePlans')}
            </Link>
            <Link href={`/${locale}/api-pricing`} className="text-sm font-medium hover:text-blue-600">
              {t('apiPricing')}
            </Link>
            <Link href={`/${locale}/coupons`} className="text-sm font-medium hover:text-blue-600">
              {t('coupons')}
            </Link>
            <a
              href="https://github.com/x2v-co/aiplans"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium hover:text-blue-600"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
              </svg>
            </a>
            <LanguageSwitcher />
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold mb-6">
            {locale === 'zh' ? (
              <>💰 全网 AI 价格对比平台</>
            ) : (
              <>💰 Compare AI Pricing & Save Money</>
            )}
          </h1>
          <p className="text-xl text-zinc-600 dark:text-zinc-400 mb-8 max-w-2xl mx-auto">
            {locale === 'zh' ? (
              '对比 GPT-4, Claude, DeepSeek 等主流 AI 模型在不同供应商的价格，找到最优惠的方案。'
            ) : (
              'Compare pricing for GPT-4, Claude, DeepSeek, and other AI models across providers to find the best deals.'
            )}
          </p>
          <div className="flex gap-4 justify-center">
            <Link href={`/${locale}/compare/plans`}>
              <Button size="lg" className="gap-2">
                {locale === 'zh' ? '开始对比' : 'Start Comparing'}
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

        {/* Hot Models */}
        <div className="text-center">
          <h2 className="text-3xl font-bold mb-8">
            {locale === 'zh' ? '🔥 热门模型对比' : '🔥 Popular Models'}
          </h2>
          <div className="grid md:grid-cols-4 gap-4">
            {hotModels.map((model) => (
              <Link key={model.slug} href={`/${locale}/compare/plans/${model.slug}`}>
                <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                  <CardContent className="p-6 text-center">
                    <h3 className="font-bold mb-2">
                      {model.name}
                    </h3>
                    <Button variant="outline" size="sm" className="w-full">
                      {locale === 'zh' ? '对比价格' : 'Compare Prices'}
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
